import React, { useState } from 'react';
import ConfirmationDialog from './ConfirmationDialog';
import { Tooltip } from './Tooltip';

type Props = { className?: string };

const Card: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`p-3 rounded-lg bg-white/60 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 flex flex-col justify-between ${className}`}>
    {children}
  </div>
);

const ActuatorControls: React.FC<Props> = ({ className = '' }) => {
  const [pumpOn, setPumpOn] = useState(false);
  const [solenoidOpen, setSolenoidOpen] = useState(false);
  const [autoPump, setAutoPump] = useState(true);
  const [confirm, setConfirm] = useState<{ open: boolean; action?: () => void } | null>(null);

  const doAction = (action: () => void) => setConfirm({ open: true, action: () => { action(); setConfirm(null); } });

  const callActuator = async (path: string, body: any) => {
    const token = localStorage.getItem('token') || localStorage.getItem('auth');
    const res = await fetch(`/api/actuators/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
    return res.json();
  };

  return (
    <div className={`p-3 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow ${className}`}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Actuator Controls</h3>

      <div className="grid grid-cols-1 gap-3">
        <Card className="min-h-[140px]">
          <div>
            <div className="text-sm font-semibold mb-1">Pump</div>
            <div className="text-xs text-gray-500">Controls irrigation pump</div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <Tooltip content={pumpOn ? 'Stop the pump' : 'Start the pump'}>
              <button
                onClick={() => doAction(async () => { setPumpOn(true); try { await callActuator('pump', { action: 'on' }); } catch (e) { setPumpOn(false); console.error(e); } })}
                className="w-full px-3 py-2 rounded-md bg-green-600 text-white text-sm"
              >
                On
              </button>
            </Tooltip>

            <Tooltip content="Turn pump off">
              <button
                onClick={() => doAction(async () => { setPumpOn(false); try { await callActuator('pump', { action: 'off' }); } catch (e) { setPumpOn(true); console.error(e); } })}
                className="w-full px-3 py-2 rounded-md bg-red-600 text-white text-sm"
              >
                Off
              </button>
            </Tooltip>

            <button
              onClick={() => doAction(async () => { setAutoPump(v => !v); try { await callActuator('pump', { action: autoPump ? 'manual' : 'auto' }); } catch (e) { setAutoPump(v => !v); console.error(e); } })}
              className={`w-full px-3 py-2 rounded-md text-sm ${autoPump ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              Auto
            </button>
          </div>

          <div className="text-xs text-gray-500 mt-3">State: <span className="font-medium">{pumpOn ? 'On' : 'Off'}</span> • Mode: <span className="font-medium">{autoPump ? 'Auto' : 'Manual'}</span></div>
        </Card>

        <div className="h-px bg-gray-200 dark:bg-gray-800" />

        <Card className="min-h-[140px]">
          <div>
            <div className="text-sm font-semibold mb-1">Solenoid Valve</div>
            <div className="text-xs text-gray-500">Opens/closes water to beds</div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <Tooltip content="Open valve">
              <button
                onClick={() => doAction(async () => { setSolenoidOpen(true); try { await callActuator('valve', { action: 'open' }); } catch (e) { setSolenoidOpen(false); console.error(e); } })}
                className="w-full px-3 py-2 rounded-md bg-green-600 text-white text-sm"
              >
                Open
              </button>
            </Tooltip>

            <Tooltip content="Close valve">
              <button
                onClick={() => doAction(async () => { setSolenoidOpen(false); try { await callActuator('valve', { action: 'close' }); } catch (e) { setSolenoidOpen(true); console.error(e); } })}
                className="w-full px-3 py-2 rounded-md bg-red-600 text-white text-sm"
              >
                Close
              </button>
            </Tooltip>

            <button onClick={() => doAction(async () => { try { await callActuator('valve', { action: 'auto' }); } catch (e) { console.error(e); } })} className="w-full px-3 py-2 rounded-md text-sm bg-gray-200 dark:bg-gray-700">Auto</button>
          </div>
          <div className="text-xs text-gray-500 mt-3">State: <span className="font-medium">{solenoidOpen ? 'Open' : 'Closed'}</span></div>
        </Card>

        <div className="h-px bg-gray-200 dark:bg-gray-800" />

        <Card className="min-h-[140px]">
          <div>
            <div className="text-sm font-semibold mb-1">Irrigation Cycle</div>
            <div className="text-xs text-gray-500">Run a timed irrigation cycle</div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <Tooltip content="Start irrigation cycle now">
              <button onClick={() => doAction(async () => { try { await callActuator('cycle', { action: 'start' }); } catch (e) { console.error(e); } })} className="w-full px-3 py-2 rounded-md bg-indigo-600 text-white text-sm">Start</button>
            </Tooltip>
            <Tooltip content="Stop running cycle">
              <button onClick={() => doAction(async () => { try { await callActuator('cycle', { action: 'stop' }); } catch (e) { console.error(e); } })} className="w-full px-3 py-2 rounded-md bg-gray-200 text-sm">Stop</button>
            </Tooltip>
          </div>
          <div className="text-xs text-gray-500 mt-3">Last run: <span className="font-medium">--</span></div>
        </Card>

      </div>

      {confirm && <ConfirmationDialog open={confirm.open} title="Confirm action" message="Proceed with the action?" onConfirm={() => confirm.action && confirm.action()} onCancel={() => setConfirm(null)} />}
    </div>
  );
};

export default ActuatorControls;
