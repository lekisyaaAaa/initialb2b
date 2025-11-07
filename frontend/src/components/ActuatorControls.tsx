import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RefreshCw, Settings2, WifiOff } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { actuatorService, API_BASE_URL, commandService } from '../services/api';
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
  const [pending, setPending] = useState<Record<number, boolean>>({});
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

  const updateControlCard = useCallback((key: ActuatorKey, updater: (card: ControlCardState) => ControlCardState) => {
    setControlCards((prev) => prev.map((card) => (card.key === key ? updater(card) : card)));
  }, []);
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const { logout } = useAuth();

  const socketUrl = useMemo(() => API_BASE_URL.replace(/\/+$/, ''), []);
  const socketHosts = useMemo(() => {
    const candidates = new Set<string>();
    if (socketUrl) {
      candidates.add(socketUrl.replace(/\/+$/, ''));
    }
    if (typeof process !== 'undefined') {
      const envSocket = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_WS_URL;
      if (envSocket) {
        const envUrl = envSocket.toString().trim();
        if (envUrl) {
          candidates.add(envUrl.replace(/\/+$/, ''));
        }
      }
    }
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      candidates.add(window.location.origin.replace(/\/+$/, ''));
    }
    return Array.from(candidates);
  }, [socketUrl]);

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
    };

    socket.on('actuator_snapshot', handleSnapshot);
    socket.on('actuatorSnapshot', handleSnapshot);
    socket.on('actuatorUpdate', handleUpdate);
    socket.on('actuator_update', handleUpdate);
    socket.on('actuator_command_update', handleCommandUpdate);
    socket.on('solenoid_command_update', handleCommandUpdate);

    return () => {
      socket.off('actuator_snapshot', handleSnapshot);
      socket.off('actuatorSnapshot', handleSnapshot);
      socket.off('actuatorUpdate', handleUpdate);
      socket.off('actuator_update', handleUpdate);
      socket.off('actuator_command_update', handleCommandUpdate);
      socket.off('solenoid_command_update', handleCommandUpdate);
    };
  }, [applyActuatorUpdate, sanitizeActuator, updateControlCard]);

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

  useEffect(() => {
    let cancelled = false;
    let cleanupHandlers: (() => void) | null = null;
    let attempt = 0;

    const disconnectActive = () => {
      if (cleanupHandlers) {
        cleanupHandlers();
        cleanupHandlers = null;
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };

    const tryNextHost = () => {
      if (cancelled) return;
      disconnectActive();

      if (attempt >= socketHosts.length) {
        setSocketState('disconnected');
        setSocketMeta((prev) => ({ ...prev, lastError: prev.lastError || 'No reachable socket endpoint', attempts: attempt }));
        return;
      }

      const host = socketHosts[attempt++];
      setSocketState('connecting');
      setSocketMeta({ host, lastError: undefined, attempts: attempt });

      const socket = io(host, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        withCredentials: false,
        reconnection: false,
        timeout: 5000,
      });

      socketRef.current = socket;
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
        setSocketMeta({ host, lastError: undefined, attempts: attempt });
        fetchActuators().catch(() => null);
        loadCommandStatus().catch(() => null);
      });

      const onFailure = (err?: Error) => {
        if (cancelled) {
          return;
        }
        const message = err?.message || 'Socket connection failed';
        setSocketState('disconnected');
        setSocketMeta({ host, lastError: message, attempts: attempt });
        cleanupHandlers?.();
        cleanupHandlers = null;
        setTimeout(tryNextHost, 250);
      };

      socket.once('connect_error', onFailure);
      socket.once('error', onFailure);
      socket.on('disconnect', (reason) => {
        if (cancelled) {
          return;
        }
        if (reason === 'io client disconnect') {
          return;
        }
        setSocketState('disconnected');
        setSocketMeta((prev) => ({ ...prev, lastError: reason }));
      });
    };

    if (socketHosts.length === 0) {
      setSocketState('disconnected');
      setSocketMeta({ host: undefined, lastError: 'No socket candidates available', attempts: 0 });
      return () => {
        cancelled = true;
      };
    }

    tryNextHost();

    return () => {
      cancelled = true;
      disconnectActive();
    };
  }, [fetchActuators, loadCommandStatus, registerSocketHandlers, socketHosts, reconnectVersion]);

  const setPendingState = useCallback((id: number, value: boolean) => {
    setPending((prev) => ({ ...prev, [id]: value }));
  }, []);

  useEffect(() => {
    loadCommandStatus();
  }, [loadCommandStatus]);

  const handleActuatorCommand = useCallback(async (key: ActuatorKey, action: 'on' | 'off') => {
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
    }
  }, [setError, updateControlCard]);

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
    }
  }, [actuators, applyActuatorUpdate, sanitizeActuator, setError, updateControlCard]);

  const handleToggle = useCallback(async (actuator: Actuator) => {
    if (!deviceOnline) {
      setError('No devices are currently online. Wait for a device to reconnect before sending commands.');
      return;
    }

    if (socketState !== 'connected') {
      setError('Socket connection unavailable. Commands are disabled until the realtime link is restored.');
      return;
    }

    if (actuator.mode !== 'manual') {
      setError('Switch actuator to manual mode before toggling.');
      return;
    }

    setPendingState(actuator.id, true);
    try {
      const response = await actuatorService.toggle(actuator.id);
      const updated = sanitizeActuator(response?.data?.data ?? response?.data);
      if (updated) {
        applyActuatorUpdate(updated);
      }
      setError(null);
    } catch (err: any) {
      const fallback = err?.response?.data?.data;
      if (fallback) {
        const normalized = sanitizeActuator(fallback);
        if (normalized) {
          applyActuatorUpdate(normalized);
        }
      }

      const message = err?.response?.data?.message || err?.message || 'Unable to toggle actuator';
      setError(message);
      await fetchActuators().catch(() => null);
    } finally {
      setPendingState(actuator.id, false);
    }
  }, [applyActuatorUpdate, deviceOnline, fetchActuators, sanitizeActuator, setPendingState, socketState]);

  const handleModeSwitch = useCallback(async (actuator: Actuator) => {
    if (!deviceOnline) {
      setError('No devices are currently online. Wait for a device to reconnect before sending commands.');
      return;
    }

    if (socketState !== 'connected') {
      setError('Socket connection unavailable. Commands are disabled until the realtime link is restored.');
      return;
    }

    const nextMode: 'manual' | 'auto' = actuator.mode === 'manual' ? 'auto' : 'manual';
    setPendingState(actuator.id, true);
    try {
      const response = await actuatorService.setMode(actuator.id, nextMode);
      const updated = sanitizeActuator(response?.data?.data ?? response?.data);
      if (updated) {
        applyActuatorUpdate(updated);
      }
      setError(null);
    } catch (err: any) {
      const fallback = err?.response?.data?.data;
      if (fallback) {
        const normalized = sanitizeActuator(fallback);
        if (normalized) {
          applyActuatorUpdate(normalized);
        }
      }

      const message = err?.response?.data?.message || err?.message || 'Unable to change actuator mode';
      setError(message);
      await fetchActuators().catch(() => null);
    } finally {
      setPendingState(actuator.id, false);
    }
  }, [applyActuatorUpdate, deviceOnline, fetchActuators, sanitizeActuator, setPendingState, socketState]);

  const isPending = useCallback((id: number) => Boolean(pending[id]), [pending]);

  const formatTimestamp = useCallback((value?: string) => {
    if (!value) return 'Never';
    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return value;
    }
  }, []);

  const realtimeUnavailable = socketState !== 'connected' || !deviceOnline;

  return (
    <section className={`${className} bg-white dark:bg-gray-900/80 border border-gray-100 dark:border-gray-800 rounded-xl shadow p-6`}>
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

      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Pump & Valve Controls</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {controlCards.map((card) => {
            const statusLabel = card.status === 'on' ? 'ON' : 'OFF';
            const statusClasses = card.status === 'on'
              ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
              : 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300';
            const modeLabel = card.mode === 'manual' ? 'Manual' : 'Auto';
            const modeClasses = card.mode === 'manual'
              ? 'text-amber-600 dark:text-amber-300'
              : 'text-emerald-600 dark:text-emerald-300';
            const hasInFlightCommand = card.commandStatus === 'pending' || card.commandStatus === 'dispatched';
            const hasActuatorRecord = Boolean(card.actuatorId);
            const isCommandBusy = card.pending || card.modePending || realtimeUnavailable || hasInFlightCommand;
            const disabledOn = isCommandBusy || card.status === 'on' || card.mode !== 'manual';
            const disabledOff = isCommandBusy || card.status === 'off' || card.mode !== 'manual';
            const disabledAuto = card.modePending || card.mode === 'auto' || !hasActuatorRecord;
            const disabledManual = card.modePending || card.mode === 'manual' || !hasActuatorRecord;

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
                  Last updated: {card.lastUpdated ? formatTimestamp(card.lastUpdated) : 'Not yet'}
                </p>

                {!hasActuatorRecord && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                    Awaiting actuator registration from backend — mode switching is temporarily disabled.
                  </p>
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
                      disabled={disabledAuto}
                      onClick={() => handleControlModeSwitch(card.key, 'auto')}
                      className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Switch to Auto
                    </button>
                    <button
                      type="button"
                      disabled={disabledManual}
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

      {realtimeUnavailable && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
          Realtime control disabled — {
            socketState !== 'connected'
              ? `socket connection is offline${socketMeta.lastError ? ` (${socketMeta.lastError})` : ''}`
              : 'no devices are currently online'
          }.
          {socketMeta.host && (
            <span className="block text-xs text-amber-600 dark:text-amber-300 mt-1">Last attempted host: {socketMeta.host}</span>
          )}
        </div>
      )}

      {isLoading && actuators.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading actuators…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {actuators.map((actuator) => {
            const statusLabel = actuator.status ? 'ON' : 'OFF';
            const statusClasses = actuator.status
              ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
              : 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300';
            const modeLabel = actuator.mode === 'manual' ? 'Manual' : 'Auto';
            const modeClasses = actuator.mode === 'manual'
              ? 'text-amber-600 dark:text-amber-300'
              : 'text-emerald-600 dark:text-emerald-300';
            const hasAckIssue = actuator.deviceAck === false;

            return (
              <div key={actuator.id} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/80 p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{actuator.name}</h3>
                    <p className={`text-sm font-medium mt-1 ${modeClasses}`}>Mode: {modeLabel}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusClasses}`}>
                    Status: {statusLabel}
                  </span>
                </div>

                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  Last updated: {formatTimestamp(actuator.lastUpdated)}
                </p>

                {hasAckIssue && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">
                    <WifiOff className="w-4 h-4" />
                    <span>{actuator.deviceAckMessage || 'ESP32 unreachable. Command not applied.'}</span>
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={actuator.mode !== 'manual' || isPending(actuator.id) || realtimeUnavailable}
                    onClick={() => handleToggle(actuator)}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      actuator.mode !== 'manual'
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                        : realtimeUnavailable
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                          : actuator.status
                          ? 'bg-rose-500 text-white hover:bg-rose-600'
                          : 'bg-emerald-500 text-white hover:bg-emerald-600'
                    }`}
                  >
                    {actuator.status ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {actuator.status ? 'Turn OFF' : 'Turn ON'}
                  </button>

                  <button
                    type="button"
                    disabled={isPending(actuator.id) || realtimeUnavailable}
                    onClick={() => handleModeSwitch(actuator)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    <Settings2 className="w-4 h-4" /> Switch to {actuator.mode === 'manual' ? 'Auto' : 'Manual'}
                  </button>
                </div>

                {actuator.mode !== 'manual' && (
                  <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">
                    Automatic mode is active. Toggle control is disabled until manual mode is selected.
                  </p>
                )}
              </div>
            );
          })}
        </div>
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
