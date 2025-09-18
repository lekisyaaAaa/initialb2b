import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Droplet, Zap, SlidersHorizontal } from 'lucide-react';
import ActuatorControlCard from './ActuatorControlCard';
import ActuatorButton from './ActuatorButton';
import ConfirmationDialog from './ConfirmationDialog';

type Props = { className?: string };

const ActuatorControls: React.FC<Props> = ({ className = '' }) => {
  const [pumpState, setPumpState] = useState<'ON' | 'OFF' | 'AUTO'>('OFF');
  const [valveState, setValveState] = useState<'OPEN' | 'CLOSED' | 'AUTO'>('CLOSED');
  const [irrigationRunning, setIrrigationRunning] = useState(false);
  const [lastPumpAction, setLastPumpAction] = useState<string | null>(null);
  const [lastIrrigation, setLastIrrigation] = useState<string | null>(null);
  const [loading, setLoading] = useState<{ [k: string]: boolean }>({});
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ open: boolean; title?: string; message?: string; action?: () => void } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);

  const toast = (msg: string) => { alert(msg); };

  const callApi = useCallback(async (url: string, body: any) => {
    const token = localStorage.getItem('token') || localStorage.getItem('auth');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    if (!res.ok) {
      let text = '';
      try { const j = await res.json(); text = j && j.message ? j.message : JSON.stringify(j); } catch (_) { text = await res.text().catch(() => res.statusText); }
      const err = new Error(text || `Request failed (${res.status})`);
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }, []);

  // load a default deviceId (use latest sensor device as default target)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/sensors/latest');
        if (!res.ok) return;
        const b = await res.json().catch(() => ({}));
        const s = b && b.data ? b.data : null;
        if (mounted && s && s.deviceId) setDeviceId(s.deviceId);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  const doPump = useCallback(async (next: 'ON' | 'OFF' | 'AUTO') => {
    setLoading(l => ({ ...l, pump: true }));
    try {
      if (!deviceId) throw new Error('No device selected');
      const action = next === 'ON' ? 'on' : next === 'OFF' ? 'off' : 'auto';
      await callApi('/api/actuators/pump', { deviceId, action });
      setPumpState(next);
      setLastPumpAction(new Date().toISOString());
    } catch (e: any) {
      toast(e.message || 'Error');
    } finally { setLoading(l => ({ ...l, pump: false })); }
  }, [callApi, deviceId]);

  const doValve = useCallback(async (next: 'OPEN' | 'CLOSED' | 'AUTO') => {
    setLoading(l => ({ ...l, valve: true }));
    try {
      if (!deviceId) throw new Error('No device selected');
      const action = next === 'OPEN' ? 'open' : next === 'CLOSED' ? 'close' : 'auto';
      await callApi('/api/actuators/valve', { deviceId, action });
      setValveState(next);
    } catch (e: any) {
      toast(e.message || 'Error');
    } finally { setLoading(l => ({ ...l, valve: false })); }
  }, [callApi, deviceId]);

  const doIrrigation = useCallback(async (action: 'START' | 'STOP') => {
    setLoading(l => ({ ...l, irrigation: true }));
    try {
      if (!deviceId) throw new Error('No device selected');
      const act = action === 'START' ? 'start' : 'stop';
      // backend endpoint is /api/actuators/cycle
      await callApi('/api/actuators/cycle', { deviceId, action: act });
      setIrrigationRunning(action === 'START');
      if (action === 'START') setLastIrrigation(new Date().toISOString());
    } catch (e: any) {
      toast(e.message || 'Error');
    } finally { setLoading(l => ({ ...l, irrigation: false })); }
  }, [callApi, deviceId]);

  // WebSocket for real-time actuator updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    function connect() {
      try {
        wsRef.current = new WebSocket(wsUrl);
      } catch (e) {
        scheduleReconnect();
        return;
      }

      wsRef.current.onopen = () => {
        reconnectAttempts.current = 0;
        // Optionally send an auth or subscription message here if backend expects it
        // const token = localStorage.getItem('token') || localStorage.getItem('auth');
        // if (token) wsRef.current?.send(JSON.stringify({ type: 'auth', token }));
      };

      wsRef.current.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          // handle different message shapes
          if (data && data.type && data.payload) {
            const p = data.payload;
            if (data.type === 'actuator:update' || data.type === 'actuator:log') {
              const at = String(p.actuatorType || p.type || '').toLowerCase();
              const action = String(p.action || p.state || '').toLowerCase();
              const ts = p.timestamp || p.time || new Date().toISOString();
              if (at === 'pump' || at === 'pump_actuator') {
                setPumpState(action === 'on' ? 'ON' : action === 'off' ? 'OFF' : 'AUTO');
                setLastPumpAction(ts);
              } else if (at === 'solenoid' || at === 'valve') {
                setValveState(action === 'on' ? 'OPEN' : action === 'off' ? 'CLOSED' : 'AUTO');
              } else if (at === 'cycle' || at === 'irrigation') {
                setIrrigationRunning(action === 'start' || action === 'running');
                if (action === 'start' || action === 'running') setLastIrrigation(ts);
              }
            }
          }
        } catch (e) {
          // ignore malformed messages
        }
      };

      wsRef.current.onclose = () => {
        scheduleReconnect();
      };

      wsRef.current.onerror = () => {
        // close will trigger reconnect
        wsRef.current?.close();
      };
    }

    function scheduleReconnect() {
      if (reconnectRef.current) return;
      reconnectAttempts.current = Math.min(10, reconnectAttempts.current + 1);
      const timeout = Math.min(30000, 500 * Math.pow(1.5, reconnectAttempts.current));
      reconnectRef.current = window.setTimeout(() => {
        reconnectRef.current = null;
        connect();
      }, timeout);
    }

    connect();

    return () => {
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
      try { wsRef.current?.close(); } catch (e) { /* ignore */ }
      wsRef.current = null;
    };
  }, []);

  

  // UI
  return (
    <div className={`${className} h-full`}> 
      <ActuatorControlCard title="Actuator Controls" className="w-full h-full">
        <div ref={containerRef} className={`grid grid-cols-1 gap-6 items-stretch auto-rows-[minmax(0,1fr)] w-full h-full overflow-auto`}>
        <ActuatorControlCard
          title="Pump"
          icon={<Droplet className={`w-6 h-6 ${pumpState === 'ON' ? 'text-green-500' : pumpState === 'OFF' ? 'text-red-500' : 'text-indigo-400'}`} />}
          status={pumpState + (lastPumpAction ? ` • ${new Date(lastPumpAction).toLocaleTimeString()}` : '')}
        >
          <div className="grid grid-cols-1 gap-2 h-full min-h-[120px]">
            <div className="flex gap-2">
              <div className="flex-1"><ActuatorButton label="On" variant="primary" onClick={() => setConfirm({ open: true, title: 'Start pump', message: 'Are you sure you want to start the pump?', action: () => doPump('ON') })} loading={loading.pump} disabled={pumpState === 'ON'} tooltip="Turn pump ON manually" /></div>
              <div className="flex-1"><ActuatorButton label="Off" variant="danger" onClick={() => setConfirm({ open: true, title: 'Stop pump', message: 'Stop the pump?', action: () => doPump('OFF') })} loading={loading.pump} disabled={pumpState === 'OFF'} tooltip="Turn pump OFF manually" /></div>
            </div>
            <div><ActuatorButton label="Auto" variant="accent" onClick={() => doPump('AUTO')} loading={loading.pump} disabled={pumpState === 'AUTO'} tooltip="Set pump to automatic mode" /></div>
          </div>
        </ActuatorControlCard>

        <ActuatorControlCard
          title="Solenoid Valve"
          icon={<SlidersHorizontal className={`w-6 h-6 ${valveState === 'OPEN' ? 'text-green-500' : valveState === 'CLOSED' ? 'text-red-500' : 'text-indigo-400'}`} />}
          status={valveState}
        >
          <div className="grid grid-cols-1 gap-2 h-full min-h-[120px]">
            <div className="flex gap-2">
              <div className="flex-1"><ActuatorButton label="Open" variant="primary" onClick={() => doValve('OPEN')} loading={loading.valve} disabled={valveState === 'OPEN'} tooltip="Open valve" /></div>
              <div className="flex-1"><ActuatorButton label="Close" variant="danger" onClick={() => doValve('CLOSED')} loading={loading.valve} disabled={valveState === 'CLOSED'} tooltip="Close valve" /></div>
            </div>
            <div><ActuatorButton label="Auto" variant="neutral" onClick={() => doValve('AUTO')} loading={loading.valve} disabled={valveState === 'AUTO'} tooltip="Set valve to automatic mode" /></div>
          </div>
        </ActuatorControlCard>

        <ActuatorControlCard
          title="Irrigation Cycle"
          icon={<Zap className="w-6 h-6 text-indigo-500" />}
          status={(irrigationRunning ? 'Running' : 'Stopped') + (lastIrrigation ? ` • ${new Date(lastIrrigation).toLocaleTimeString()}` : '')}
        >
          <div className="grid grid-cols-1 gap-2 h-full min-h-[120px]">
            <div className="flex gap-2">
              <div className="flex-1"><ActuatorButton label="Start" variant="accent" onClick={() => setConfirm({ open: true, title: 'Start irrigation', message: 'Start irrigation cycle now?', action: () => doIrrigation('START') })} loading={loading.irrigation} disabled={irrigationRunning} tooltip="Start irrigation cycle now" /></div>
              <div className="flex-1"><ActuatorButton label="Stop" variant="neutral" onClick={() => doIrrigation('STOP')} loading={loading.irrigation} disabled={!irrigationRunning} tooltip="Stop running cycle" /></div>
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-300">Last run: <span className="font-medium">{lastIrrigation ? new Date(lastIrrigation).toLocaleString() : '--'}</span></div>
          </div>
        </ActuatorControlCard>
        </div>
      </ActuatorControlCard>

      {confirm && <ConfirmationDialog open={confirm.open} title={confirm.title || 'Confirm'} message={confirm.message || ''} onConfirm={() => { confirm.action && confirm.action(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}
    </div>
  );
};

export default ActuatorControls;
