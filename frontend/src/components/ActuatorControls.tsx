import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Settings2, WifiOff } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { actuatorService, commandService, sensorService } from '../services/api';
import { createSocket, SOCKET_URL } from '../socket';
import { Actuator } from '../types';
import { useAuth } from '../contexts/AuthContext';

type Props = { className?: string; deviceOnline?: boolean };

const TARGET_DEVICE_ID = 'ESP32-01';

type ActuatorKey = 'pump' | 'solenoid1' | 'solenoid2' | 'solenoid3';

const CONTROL_ACTUATORS: Array<{ key: ActuatorKey; label: string }> = [
  { key: 'pump', label: 'Water Pump' },
  { key: 'solenoid1', label: 'Solenoid Valve 1' },
  { key: 'solenoid2', label: 'Solenoid Valve 2' },
  { key: 'solenoid3', label: 'Solenoid Valve 3' },
];

const CONTROL_ACTUATOR_KEYS: ActuatorKey[] = CONTROL_ACTUATORS.map(({ key }) => key);

const isActuatorKey = (value: unknown): value is ActuatorKey =>
  typeof value === 'string' && CONTROL_ACTUATOR_KEYS.includes(value as ActuatorKey);

const normalizeActuatorKey = (raw?: string | null): ActuatorKey | null => {
  if (!raw) return null;
  const value = raw.toString().trim().toLowerCase();
  return isActuatorKey(value) ? (value as ActuatorKey) : null;
};

const inferActuatorKeyFromName = (name?: string | null): ActuatorKey | null => {
  if (!name) return null;
  const normalized = name.toString().trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('pump')) {
    return 'pump';
  }
  const solenoidMatch = normalized.match(/solenoid(?:\s+valve)?\s*(\d)/);
  if (solenoidMatch) {
    const index = Number(solenoidMatch[1]);
    const key = `solenoid${index}` as ActuatorKey;
    if (isActuatorKey(key)) {
      return key;
    }
  }
  return null;
};

type FloatLockoutSource = 'sensor' | 'command' | 'manual' | null;

type FloatLockoutState = {
  active: boolean;
  floatValue: number | null;
  timestamp: string | null;
  reason: string | null;
  source: FloatLockoutSource;
};

type FloatLockoutUpdate = {
  active?: boolean;
  floatValue?: number | null;
  timestamp?: string | null;
  reason?: string | null;
  source?: FloatLockoutSource;
};

const normalizeFloatValue = (value: unknown): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const ensureIsoTimestamp = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return trimmed;
  }
  const parsed = new Date(value as any);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const extractFloatStateFromPayload = (payload: any): { value?: number | null; timestamp?: string | null } => {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const baseFloat = normalizeFloatValue((payload as any).floatSensor ?? (payload as any).float_sensor);
  if (baseFloat !== undefined) {
    return {
      value: baseFloat,
      timestamp: ensureIsoTimestamp(
        (payload as any).floatSensorTimestamp || (payload as any).timestamp || (payload as any).createdAt || (payload as any).receivedAt,
      ) ?? null,
    };
  }

  const summary = Array.isArray((payload as any).sensorSummary) ? (payload as any).sensorSummary : null;
  if (summary) {
    const entry = summary.find((item: any) => item && item.key === 'floatSensor');
    if (entry) {
      const value = normalizeFloatValue(entry.value ?? entry.sensorValue);
      return {
        value,
        timestamp: ensureIsoTimestamp(entry.timestamp || entry.recordedAt || entry.updatedAt || (payload as any).timestamp) ?? null,
      };
    }
  }

  const sensors = Array.isArray((payload as any).sensors) ? (payload as any).sensors : null;
  if (sensors) {
    const entry = sensors.find((item: any) => item && item.key === 'floatSensor');
    if (entry) {
      const value = normalizeFloatValue(entry.value ?? entry.sensorValue);
      return {
        value,
        timestamp: ensureIsoTimestamp(entry.timestamp || entry.recordedAt || entry.updatedAt || (payload as any).timestamp) ?? null,
      };
    }
  }

  if ((payload as any).sensorData) {
    return extractFloatStateFromPayload((payload as any).sensorData);
  }

  return {};
};

type ControlCardState = {
  key: ActuatorKey;
  label: string;
  status: 'on' | 'off';
  mode: 'auto' | 'manual';
  pending: boolean;
  modePending: boolean;
  commandStatus: 'idle' | 'pending' | 'dispatched' | 'done' | 'failed';
  message: string | null;
  lastUpdated: string | null;
  actuatorId?: number | null;
};

const ActuatorControls: React.FC<Props> = ({ className = '', deviceOnline = true }) => {
  const [actuators, setActuators] = useState<Actuator[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [socketConnected, setSocketConnected] = useState(false);
  const [controlCards, setControlCards] = useState<ControlCardState[]>(() =>
    CONTROL_ACTUATORS.map(({ key, label }) => ({
      key,
      label,
      status: 'off',
      mode: 'manual',
      pending: false,
      modePending: false,
      commandStatus: 'idle',
      message: null,
      lastUpdated: null,
      actuatorId: null,
    }))
  );
  const [socketMeta, setSocketMeta] = useState<{ host?: string; lastError?: string; attempts: number }>({ attempts: 0 });
  // Track float sensor lockout so ON commands mirror backend safety guardrails.
  const [lockoutState, setLockoutState] = useState<FloatLockoutState>({
    active: false,
    floatValue: null,
    timestamp: null,
    reason: null,
    source: null,
  });
  const lockoutStateRef = useRef(lockoutState);

  const updateLockoutState = useCallback((update: FloatLockoutUpdate) => {
    setLockoutState((prev) => {
      const nextFloat = update.floatValue !== undefined ? normalizeFloatValue(update.floatValue) : prev.floatValue;
      const nextTimestampRaw = ensureIsoTimestamp(update.timestamp);
      const nextTimestamp = nextTimestampRaw === undefined ? prev.timestamp : nextTimestampRaw;
      const nextSource = update.source === undefined ? prev.source : update.source;

      let nextActive = update.active === undefined ? prev.active : Boolean(update.active);
      if (update.floatValue !== undefined) {
        if (nextFloat !== null && nextFloat !== undefined) {
          nextActive = Number(nextFloat) === 0;
        }
      }

      let nextReason = update.reason === undefined ? prev.reason : update.reason;
      if (update.floatValue !== undefined) {
        if (nextFloat !== null && nextFloat !== undefined) {
          nextReason = Number(nextFloat) === 0
            ? nextReason || prev.reason || 'Float sensor lockout active — manual ON commands disabled.'
            : null;
        }
      }

      const nextState: FloatLockoutState = {
        active: nextActive,
        floatValue: nextFloat ?? null,
        timestamp: nextTimestamp ?? null,
        reason: nextReason ?? null,
        source: nextSource ?? null,
      };

      if (
        nextState.active === prev.active &&
        nextState.floatValue === prev.floatValue &&
        nextState.timestamp === prev.timestamp &&
        nextState.reason === prev.reason &&
        nextState.source === prev.source
      ) {
        return prev;
      }

      return nextState;
    });
  }, []);

  const [systemLocked, setSystemLocked] = useState(lockoutState.active);
  const lockoutReason = lockoutState.reason;

  useEffect(() => {
    lockoutStateRef.current = lockoutState;
  }, [lockoutState]);

  const updateControlCard = useCallback((key: ActuatorKey, updater: (card: ControlCardState) => ControlCardState) => {
    setControlCards((prev) => prev.map((card) => (card.key === key ? updater(card) : card)));
  }, []);
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const { logout } = useAuth();

  const sanitizeActuator = useCallback((value: any): Actuator | null => {
    if (!value || typeof value !== 'object') return null;
    return {
      id: Number(value.id),
      name: String(value.name || ''),
      type: value.type ? String(value.type) : undefined,
      status: Boolean(value.status),
      mode: value.mode === 'manual' ? 'manual' : 'auto',
      lastUpdated: value.lastUpdated || new Date().toISOString(),
      deviceAck: typeof value.deviceAck === 'boolean' ? value.deviceAck : undefined,
      deviceAckMessage: value.deviceAckMessage ? String(value.deviceAckMessage) : null,
    };
  }, []);

  const applyActuatorUpdate = useCallback((update: Actuator) => {
    setActuators((prev) => {
      const exists = prev.find((item) => item.id === update.id);
      if (exists) {
        return prev.map((item) => (item.id === update.id ? { ...item, ...update } : item));
      }
      return [...prev, update].sort((a, b) => a.id - b.id);
    });
    const inferredKey = inferActuatorKeyFromName(update.name);
    if (inferredKey) {
      updateControlCard(inferredKey, (card) => ({
        ...card,
        actuatorId: update.id,
        mode: update.mode,
        status: update.status ? 'on' : 'off',
        lastUpdated: update.lastUpdated || card.lastUpdated,
        pending: false,
        modePending: false,
      }));
    }
  }, [updateControlCard]);

  const fetchActuators = useCallback(async () => {
    const response = await actuatorService.list();
    const payload = (response?.data?.data ?? response?.data ?? []) as Actuator[];
    if (Array.isArray(payload)) {
      const sanitized = payload.map(sanitizeActuator).filter(Boolean) as Actuator[];
      setActuators(sanitized);
      setControlCards((prev) =>
        prev.map((card) => {
          const match = sanitized.find((act) => inferActuatorKeyFromName(act.name) === card.key);
          if (!match) {
            return card;
          }
          return {
            ...card,
            actuatorId: match.id,
            mode: match.mode,
            status: match.status ? 'on' : 'off',
            lastUpdated: match.lastUpdated || card.lastUpdated,
          };
        })
      );
    }
  }, [sanitizeActuator]);

  const loadActuators = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchActuators();
      setError(null);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        logout();
        setError('Session expired. Please sign in again.');
        return;
      }

      const message = err?.response?.data?.message || err?.message || 'Unable to load actuators';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchActuators, logout]);

  useEffect(() => {
    loadActuators();
  }, [loadActuators]);

  const registerSocketHandlers = useCallback((socket: Socket) => {
    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('floatLockout', () => setSystemLocked(true));
    socket.on('floatLockoutCleared', () => setSystemLocked(false));

    // Initial state sync
    setSocketConnected(socket.connected);
    setSystemLocked(lockoutStateRef.current.active);
    const handleSnapshot = (snapshot: any) => {
      if (Array.isArray(snapshot)) {
        const sanitized = snapshot.map(sanitizeActuator).filter(Boolean) as Actuator[];
        setActuators(sanitized);
        setControlCards((prev) =>
          prev.map((card) => {
            const match = sanitized.find((act) => inferActuatorKeyFromName(act.name) === card.key);
            if (!match) {
              return card;
            }
            return {
              ...card,
              actuatorId: match.id,
              mode: match.mode,
              status: match.status ? 'on' : 'off',
              lastUpdated: match.lastUpdated || card.lastUpdated,
            };
          })
        );
      }
    };

    const handleUpdate = (payload: any) => {
      const normalized = sanitizeActuator(payload);
      if (normalized) {
        applyActuatorUpdate(normalized);
      }
    };
    const handleCommandUpdate = (payload: any) => {
      if (!payload) {
        return;
      }
      const targetDevice = (payload.deviceId || payload.device_id || payload.deviceID || '').toString();
      if (targetDevice && targetDevice !== TARGET_DEVICE_ID) {
        return;
      }

      let actuatorKey = normalizeActuatorKey(payload.actuator || payload.actuator_key || payload.actuatorKey);
      if (!actuatorKey) {
        const solenoidIndex = Number(payload.solenoid ?? payload.channel);
        if (Number.isFinite(solenoidIndex) && solenoidIndex >= 1 && solenoidIndex <= 3) {
          actuatorKey = `solenoid${solenoidIndex}` as ActuatorKey;
        }
      }
      if (!actuatorKey) {
        return;
      }

      updateControlCard(actuatorKey, (card) => {
        const status = typeof payload.status === 'string' ? payload.status : card.commandStatus;
        const action = typeof payload.action === 'string' ? payload.action.toLowerCase() : null;
        const nextState = status === 'done' && action ? (action === 'on' ? 'on' : 'off') : card.status;
        const allowedStatuses: ControlCardState['commandStatus'][] = ['idle', 'pending', 'dispatched', 'done', 'failed'];
        const commandStatus = allowedStatuses.includes(status as ControlCardState['commandStatus'])
          ? (status as ControlCardState['commandStatus'])
          : card.commandStatus;
        return {
          ...card,
          status: nextState,
          commandStatus,
          pending: false,
          message: payload.message || payload.responseMessage || null,
          lastUpdated: payload.ackReceivedAt || payload.updatedAt || new Date().toISOString(),
        };
      });

      if (payload.code === 'float_lockout') {
        const details = payload.data || payload.details || {};
        const floatCandidate = normalizeFloatValue(details.floatSensor ?? details.float_sensor ?? payload.floatSensor);
        const timestamp = ensureIsoTimestamp(details.floatSensorTimestamp || payload.timestamp || payload.updatedAt) ?? new Date().toISOString();
        updateLockoutState({
          active: true,
          floatValue: floatCandidate === undefined ? 0 : floatCandidate,
          timestamp,
          reason: payload.message || payload.responseMessage || 'Float sensor lockout active — manual ON commands disabled.',
          source: 'command',
        });
      }
    };

    const handleSensorUpdate = (payload: any) => {
      const deviceId = (payload?.deviceId || payload?.device_id || payload?.hardwareId || payload?.deviceID || '').toString();
      if (deviceId && deviceId !== TARGET_DEVICE_ID) {
        return;
      }
      const { value, timestamp } = extractFloatStateFromPayload(payload);
      if (value !== undefined) {
        updateLockoutState({
          floatValue: value,
          timestamp: timestamp ?? null,
          source: 'sensor',
        });
      }
    };

    const handleFloatLockout = (payload: any) => {
      const deviceId = (payload?.deviceId || payload?.device_id || payload?.hardwareId || payload?.deviceID || '').toString();
      if (deviceId && deviceId !== TARGET_DEVICE_ID) {
        return;
      }
      const { value, timestamp } = extractFloatStateFromPayload(payload);
      updateLockoutState({
        active: true,
        floatValue: value === undefined ? 0 : value,
        timestamp: timestamp ?? ensureIsoTimestamp(payload?.timestamp) ?? new Date().toISOString(),
        reason: payload?.message || 'Float sensor lockout active — manual ON commands disabled.',
        source: 'command',
      });
    };

    const handleFloatLockoutCleared = (payload: any) => {
      const deviceId = (payload?.deviceId || payload?.device_id || payload?.hardwareId || payload?.deviceID || '').toString();
      if (deviceId && deviceId !== TARGET_DEVICE_ID) {
        return;
      }
      const { value, timestamp } = extractFloatStateFromPayload(payload);
      updateLockoutState({
        active: false,
        floatValue: value ?? 1,
        timestamp: timestamp ?? ensureIsoTimestamp(payload?.timestamp) ?? new Date().toISOString(),
        reason: null,
        source: 'sensor',
      });
    };

    socket.on('actuator_snapshot', handleSnapshot);
    socket.on('actuatorSnapshot', handleSnapshot);
    socket.on('actuatorUpdate', handleUpdate);
    socket.on('actuator_update', handleUpdate);
    socket.on('actuatorModeUpdate', handleUpdate);
    socket.on('actuator_mode_update', handleUpdate);
    socket.on('actuator_command_update', handleCommandUpdate);
    socket.on('solenoid_command_update', handleCommandUpdate);
    socket.on('sensor_update', handleSensorUpdate);
    socket.on('device_sensor_update', handleSensorUpdate);
    socket.on('float_lockout', handleFloatLockout);
    socket.on('float_lockout_cleared', handleFloatLockoutCleared);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('floatLockout');
      socket.off('floatLockoutCleared');
      socket.off('actuator_snapshot', handleSnapshot);
      socket.off('actuatorSnapshot', handleSnapshot);
      socket.off('actuatorUpdate', handleUpdate);
      socket.off('actuator_update', handleUpdate);
      socket.off('actuatorModeUpdate', handleUpdate);
      socket.off('actuator_mode_update', handleUpdate);
      socket.off('actuator_command_update', handleCommandUpdate);
      socket.off('solenoid_command_update', handleCommandUpdate);
      socket.off('sensor_update', handleSensorUpdate);
      socket.off('device_sensor_update', handleSensorUpdate);
      socket.off('float_lockout', handleFloatLockout);
      socket.off('float_lockout_cleared', handleFloatLockoutCleared);
    };
  }, [applyActuatorUpdate, sanitizeActuator, updateControlCard, updateLockoutState]);

  const handleManualReconnect = useCallback(() => {
    setSocketMeta((prev) => ({ ...prev, lastError: undefined }));
    setReconnectVersion((value) => value + 1);
  }, []);

  const loadCommandStatus = useCallback(async () => {
    try {
      const response = await commandService.status(TARGET_DEVICE_ID);
      const latest = response?.data?.data?.latestByActuator;
      if (Array.isArray(latest)) {
        const latestMap = new Map<ActuatorKey, any>();
        latest.forEach((entry: any) => {
          const key =
            normalizeActuatorKey(entry?.actuator || entry?.actuator_key || entry?.actuatorKey) ||
            (() => {
              const idx = Number(entry?.solenoid);
              if (Number.isFinite(idx) && idx >= 1 && idx <= 3) {
                return `solenoid${idx}` as ActuatorKey;
              }
              return null;
            })();
          if (key) {
            latestMap.set(key, entry);
          }
        });

        setControlCards((prev) =>
          prev.map((card) => {
            const match = latestMap.get(card.key);
            if (!match) {
              return card;
            }
            const status = typeof match.status === 'string' ? match.status : card.commandStatus;
            const action = typeof match.action === 'string' ? match.action.toLowerCase() : null;
            const nextState = status === 'done' && action ? (action === 'on' ? 'on' : 'off') : card.status;
            const allowedStatuses: ControlCardState['commandStatus'][] = ['idle', 'pending', 'dispatched', 'done', 'failed'];
            const commandStatus = allowedStatuses.includes(status as ControlCardState['commandStatus'])
              ? (status as ControlCardState['commandStatus'])
              : card.commandStatus;
            return {
              ...card,
              status: nextState,
              commandStatus,
              message: match.responseMessage || match.message || null,
              lastUpdated: match.updatedAt || match.createdAt || card.lastUpdated,
              pending: false,
              modePending: false,
            };
          })
        );
      }
    } catch (err: any) {
      console.debug('Failed to load command status', err?.message || err);
    }
  }, []);

  const loadFloatSensorSnapshot = useCallback(async () => {
    try {
      const response = await sensorService.getLatestData(TARGET_DEVICE_ID);
      const payload = response?.data?.data;
      const latestRecord = Array.isArray(payload) ? payload[0] : payload;
      if (latestRecord) {
        const { value, timestamp } = extractFloatStateFromPayload(latestRecord);
        if (value !== undefined) {
          updateLockoutState({
            floatValue: value,
            timestamp: timestamp ?? null,
            source: 'sensor',
          });
        }
      }
    } catch (err: any) {
      console.debug('Failed to load float sensor snapshot', err?.message || err);
    }
  }, [updateLockoutState]);

  useEffect(() => {
    let cancelled = false;
    let cleanupHandlers: (() => void) | null = null;
    let attempts = 1;

    const connect = () => {
      const socket = createSocket();
      socketRef.current = socket;
      setSocketState(socket.connected ? 'connected' : 'connecting');
      setSocketMeta({ host: SOCKET_URL, lastError: undefined, attempts });

      const detachHandlers = registerSocketHandlers(socket);
      cleanupHandlers = () => {
        detachHandlers();
        socket.removeAllListeners();
        socket.disconnect();
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
      };

      socket.once('connect', () => {
        if (cancelled) {
          cleanupHandlers?.();
          return;
        }
        setSocketState('connected');
        setSocketMeta({ host: SOCKET_URL, lastError: undefined, attempts });
        fetchActuators().catch(() => null);
        loadCommandStatus().catch(() => null);
        loadFloatSensorSnapshot().catch(() => null);
      });

      const onFailure = (err?: Error) => {
        if (cancelled) {
          return;
        }
        const message = err?.message || 'Socket connection failed';
        attempts += 1;
        setSocketState('disconnected');
        setSocketMeta({ host: SOCKET_URL, lastError: message, attempts });
      };

      socket.on('connect_error', onFailure);
      socket.on('error', onFailure);
      socket.on('disconnect', (reason) => {
        if (cancelled) {
          return;
        }
        if (reason === 'io client disconnect') {
          return;
        }
        setSocketState('disconnected');
        setSocketMeta((prev) => ({ host: SOCKET_URL, lastError: reason, attempts: prev.attempts + 1 }));
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (cleanupHandlers) {
        cleanupHandlers();
        cleanupHandlers = null;
      }
    };
  }, [fetchActuators, loadCommandStatus, loadFloatSensorSnapshot, registerSocketHandlers, reconnectVersion]);

  useEffect(() => {
    loadCommandStatus();
  }, [loadCommandStatus]);

  useEffect(() => {
    loadFloatSensorSnapshot();
  }, [loadFloatSensorSnapshot]);

  const handleActuatorCommand = useCallback(async (key: ActuatorKey, action: 'on' | 'off') => {
    if (systemLocked && action === 'on') {
      const message = lockoutReason || 'Float sensor lockout active — manual ON commands disabled.';
      updateControlCard(key, (card) => ({
        ...card,
        pending: false,
        commandStatus: 'failed',
        message,
      }));
      setError(message);
      return;
    }

    updateControlCard(key, (card) => ({
      ...card,
      pending: true,
      commandStatus: 'pending',
      message: null,
    }));

    try {
      const response = await commandService.queue({ device_id: TARGET_DEVICE_ID, actuator: key, action });
      const dispatched = Boolean(response?.data?.data?.dispatched);
      updateControlCard(key, (card) => ({
        ...card,
        pending: false,
        commandStatus: dispatched ? 'dispatched' : 'pending',
        lastUpdated: new Date().toISOString(),
        message: !deviceOnline
          ? 'Device offline — command queued and will execute once hardware reconnects.'
          : null,
      }));
      setError(null);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Unable to queue actuator command';
      updateControlCard(key, (card) => ({
        ...card,
        pending: false,
        commandStatus: 'failed',
        message,
      }));
      setError(message);

      const code = err?.response?.data?.code;
      if (code === 'float_lockout') {
        const details = err?.response?.data?.data || {};
        const floatCandidate = normalizeFloatValue(details.floatSensor ?? details.float_sensor ?? err?.response?.data?.floatSensor);
        const timestamp = ensureIsoTimestamp(details.floatSensorTimestamp || details.timestamp || new Date()) ?? new Date().toISOString();
        updateLockoutState({
          active: true,
          floatValue: floatCandidate === undefined ? 0 : floatCandidate,
          timestamp,
          reason: message,
          source: 'command',
        });
      }
    }
  }, [deviceOnline, lockoutReason, setError, systemLocked, updateControlCard, updateLockoutState]);

  const handleControlModeSwitch = useCallback(async (key: ActuatorKey, nextMode: 'auto' | 'manual') => {
    updateControlCard(key, (card) => ({ ...card, modePending: true, message: null }));
    try {
      const match = actuators.find((act) => inferActuatorKeyFromName(act.name) === key);
      if (match) {
        const response = await actuatorService.setMode(match.id, nextMode);
        const updated = sanitizeActuator(response?.data?.data ?? response?.data);
        if (updated) {
          applyActuatorUpdate(updated);
        }
        updateControlCard(key, (card) => ({
          ...card,
          mode: nextMode,
          modePending: false,
          actuatorId: match.id,
          lastUpdated: new Date().toISOString(),
        }));
      } else {
        updateControlCard(key, (card) => ({
          ...card,
          mode: nextMode,
          modePending: false,
          lastUpdated: new Date().toISOString(),
        }));
      }
      setError(null);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Unable to change actuator mode';
      updateControlCard(key, (card) => ({ ...card, modePending: false, message }));
      setError(message);

      const code = err?.response?.data?.code;
      if (code === 'float_lockout') {
        const details = err?.response?.data?.data || {};
        const floatCandidate = normalizeFloatValue(details.floatSensor ?? details.float_sensor ?? err?.response?.data?.floatSensor);
        const timestamp = ensureIsoTimestamp(details.floatSensorTimestamp || details.timestamp || new Date()) ?? new Date().toISOString();
        updateLockoutState({
          active: true,
          floatValue: floatCandidate === undefined ? 0 : floatCandidate,
          timestamp,
          reason: message,
          source: 'command',
        });
      }
    }
  }, [actuators, applyActuatorUpdate, sanitizeActuator, setError, updateControlCard, updateLockoutState]);

  const formatTimestamp = useCallback((value?: string) => {
    if (!value) return 'Never';
    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return value;
    }
  }, []);

  // Consider socket online based on actual connection boolean; don't block
  // controls during transient "connecting" states.
  const socketOffline = !socketConnected;
  const deviceOffline = !deviceOnline;

  return (
    <section className={`${className} bg-white dark:bg-gray-900/80 border border-gray-100 dark:border-gray-800 rounded-xl shadow p-6`}>
      {!socketConnected && (
        <div className="rounded-md bg-yellow-900/40 text-yellow-300 text-center py-2 mb-3">
          ⚠️ Realtime control disabled — socket connection offline.
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-emerald-500" />
            Actuator Controls
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Monitor and manage the water pump and solenoid valves in real time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-end text-right">
          <span className={`text-xs px-3 py-1 rounded-full border ${
            socketState === 'connected'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700'
              : socketState === 'connecting'
                ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700'
                : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-700'
          }`}
          >
            Socket: {socketState}
          </span>
          {socketMeta.host && (
            <span className="text-xs text-gray-500 dark:text-gray-400" title={`Socket host: ${socketMeta.host}`}>
              {socketMeta.host}
            </span>
          )}
          {socketMeta.lastError && socketState !== 'connected' && (
            <span className="text-xs text-rose-600 dark:text-rose-300" title={socketMeta.lastError}>
              {socketMeta.lastError}
            </span>
          )}
          <button
            type="button"
            onClick={handleManualReconnect}
            disabled={socketState === 'connecting'}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reconnect
          </button>
          <button
            type="button"
            onClick={loadActuators}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {systemLocked && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
          Float sensor lockout active — manual ON commands remain disabled until the float sensor reports a safe level.
          {typeof lockoutState.floatValue === 'number' && (
            <span className="block text-xs text-rose-600 dark:text-rose-300 mt-1">
              Last float sensor reading: {lockoutState.floatValue}
            </span>
          )}
          {lockoutState.timestamp && (
            <span className="block text-xs text-rose-600 dark:text-rose-300">
              Updated: {formatTimestamp(lockoutState.timestamp)}
            </span>
          )}
          {lockoutReason && (
            <span className="block text-xs text-rose-600 dark:text-rose-300">
              {lockoutReason}
            </span>
          )}
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Pump & Valve Controls</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {controlCards.map((card) => {
            const linkedActuator = actuators.find((act) => inferActuatorKeyFromName(act.name) === card.key);
            const statusLabel = card.status === 'on' ? 'ON' : 'OFF';
            const statusClasses = card.status === 'on'
              ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
              : 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300';
            const modeLabel = card.mode === 'manual' ? 'Manual' : 'Auto';
            const modeClasses = card.mode === 'manual'
              ? 'text-amber-600 dark:text-amber-300'
              : 'text-emerald-600 dark:text-emerald-300';
            // Only block while a command is pending; once dispatched, allow
            // follow-up actions (e.g., to correct a mistaken toggle).
            const hasInFlightCommand = card.commandStatus === 'pending';
            const hasActuatorRecord = Boolean(card.actuatorId || linkedActuator?.id);
            // Allow queuing commands even if socket is offline — backend will
            // queue to device and execute on reconnect.
            const baseCommandDisabled = card.pending || card.modePending || hasInFlightCommand;
            const manualUnavailable = card.mode !== 'manual';
            const disabledOn = baseCommandDisabled || card.status === 'on' || manualUnavailable || systemLocked;
            const disabledOff = baseCommandDisabled || card.status === 'off' || manualUnavailable;
            // `disabledAuto` and `disabledManual` were unused; remove to satisfy ESLint no-unused-vars
            const ackIssue = linkedActuator?.deviceAck === false;
            const ackMessage = linkedActuator?.deviceAckMessage;
            const lastUpdated = linkedActuator?.lastUpdated || card.lastUpdated;

            return (
              <div key={card.key} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/80 p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{card.label}</h4>
                    <p className={`text-sm font-medium mt-1 ${modeClasses}`}>Mode: {modeLabel}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusClasses}`}>
                    Status: {statusLabel}
                  </span>
                </div>

                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  Last updated: {lastUpdated ? formatTimestamp(lastUpdated) : 'Not yet'}
                </p>

                {!hasActuatorRecord && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                    Awaiting actuator registration from backend — mode switching is temporarily disabled.
                  </p>
                )}

                {ackIssue && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">
                    <WifiOff className="w-4 h-4" />
                    <span>{ackMessage || 'ESP32 unreachable. Command not applied.'}</span>
                  </div>
                )}

                <div className="mt-5 grid gap-2">
                  <button
                    type="button"
                    disabled={disabledOn}
                    onClick={() => handleActuatorCommand(card.key, 'on')}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      disabledOn
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600'
                    }`}
                  >
                    Turn ON
                  </button>
                  <button
                    type="button"
                    disabled={disabledOff}
                    onClick={() => handleActuatorCommand(card.key, 'off')}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      disabledOff
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                        : 'bg-rose-500 text-white hover:bg-rose-600'
                    }`}
                  >
                    Turn OFF
                  </button>

                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={
                        card.mode === 'auto' ||
                        !(card.actuatorId || linkedActuator?.id) ||
                        card.modePending ||
                        systemLocked
                      }
                      onClick={() => handleControlModeSwitch(card.key, 'auto')}
                      className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Switch to Auto
                    </button>
                    <button
                      type="button"
                      disabled={
                        card.mode === 'manual' ||
                        !(card.actuatorId || linkedActuator?.id) ||
                        card.modePending ||
                        systemLocked
                      }
                      onClick={() => handleControlModeSwitch(card.key, 'manual')}
                      className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Switch to Manual
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="block font-medium">Command status: {card.commandStatus}</span>
                  {card.message && (
                    <span className="mt-1 block text-rose-600 dark:text-rose-300">{card.message}</span>
                  )}
                  {systemLocked && card.mode === 'manual' && (
                    <span className="mt-2 block text-rose-600 dark:text-rose-300">
                      Float sensor lockout active — ON commands will resume automatically once the float sensor recovers.
                    </span>
                  )}
                  {card.mode !== 'manual' && (
                    <span className="mt-2 block text-amber-600 dark:text-amber-300">
                      Automatic mode active — manual toggles are disabled until manual mode is selected.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
          {error}
        </div>
      )}

      {socketOffline && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
          Realtime control disabled — socket connection is offline
          {socketMeta.lastError ? ` (${socketMeta.lastError})` : ''}.
          {socketMeta.host && (
            <span className="block text-xs text-amber-600 dark:text-amber-300 mt-1">Last attempted host: {socketMeta.host}</span>
          )}
        </div>
      )}

      {!socketOffline && deviceOffline && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
          No devices are currently online — commands will remain queued and run automatically once hardware reconnects.
          {socketMeta.host && (
            <span className="block text-xs text-amber-600 dark:text-amber-300 mt-1">Socket host: {socketMeta.host}</span>
          )}
        </div>
      )}

      {isLoading && actuators.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading actuators…</div>
      )}

      {actuators.length === 0 && !isLoading && !error && (
        <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          No actuators registered yet.
        </div>
      )}
    </section>
  );
};

export default ActuatorControls;
