import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { History, Loader2, Play, RefreshCw } from 'lucide-react';
import DarkModeToggle from '../components/DarkModeToggle';
import HeaderFrame from '../components/layout/HeaderFrame';
import { API_BASE_URL, systemTestService } from '../services/api';
import { SystemTestRecord, SystemTestRun, SystemTestSnapshot, SystemTestStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';

type SocketState = 'connecting' | 'connected' | 'disconnected';

type StatusTheme = {
  label: string;
  className: string;
  dotClass: string;
};

const SECTION_ORDER = [
  'Backend & Database',
  'ESP32 Communication',
  'Frontend Integration',
  'Safety Logic & Automation',
];

const STATUS_THEME: Record<SystemTestStatus, StatusTheme> = {
  ok: {
    label: 'Pass',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    dotClass: 'bg-emerald-500',
  },
  warn: {
    label: 'Warn',
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200',
    dotClass: 'bg-amber-500',
  },
  failed: {
    label: 'Fail',
    className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-900/25 dark:text-rose-200',
    dotClass: 'bg-rose-500',
  },
  error: {
    label: 'Error',
    className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/25 dark:text-red-200',
    dotClass: 'bg-red-500',
  },
  running: {
    label: 'Running',
    className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-200',
    dotClass: 'bg-sky-500',
  },
  pending: {
    label: 'Pending',
    className: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300',
    dotClass: 'bg-gray-400',
  },
};

const SOCKET_STATUS_THEME: Record<SocketState, StatusTheme> = {
  connected: {
    label: 'Socket Connected',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    dotClass: 'bg-emerald-500',
  },
  connecting: {
    label: 'Socket Connecting…',
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200',
    dotClass: 'bg-amber-500',
  },
  disconnected: {
    label: 'Socket Offline',
    className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-900/25 dark:text-rose-200',
    dotClass: 'bg-rose-500',
  },
};

const normalizeTimestamp = (value: unknown): string | null => {
  if (!value) return null;
  const date = new Date(String(value));
  const time = date.getTime();
  if (!Number.isFinite(time)) {
    return null;
  }
  return new Date(time).toISOString();
};

const canonicalStatus = (value: unknown): SystemTestStatus => {
  const normalized = (value ?? '').toString().toLowerCase();
  if (['ok', 'pass', 'passed', 'success', 'healthy'].includes(normalized)) return 'ok';
  if (['warn', 'warning', 'caution'].includes(normalized)) return 'warn';
  if (['fail', 'failed', 'critical'].includes(normalized)) return 'failed';
  if (['error', 'errors'].includes(normalized)) return 'error';
  if (['running', 'in-progress', 'progress', 'active'].includes(normalized)) return 'running';
  if (['pending', 'queued', 'waiting', 'scheduled'].includes(normalized)) return 'pending';
  return 'pending';
};

const normalizeRecord = (raw: any): SystemTestRecord => {
  if (!raw || typeof raw !== 'object') {
    return {
      runId: null,
      section: 'Unknown Section',
      status: 'pending',
      details: null,
      timestamp: null,
      metadata: null,
      durationMs: null,
    };
  }

  const rawMetadata = raw.metadata;
  const normalizedMetadata = rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)
    ? rawMetadata
    : null;

  const rawDuration = raw.durationMs ?? raw.duration_ms;
  const durationMs = typeof rawDuration === 'number' && Number.isFinite(rawDuration)
    ? rawDuration
    : null;

  return {
    id: typeof raw.id === 'number' ? raw.id : undefined,
    runId: raw.runId ? String(raw.runId) : (raw.run_id ? String(raw.run_id) : null),
    section: raw.section ? String(raw.section) : 'Unnamed Section',
    status: canonicalStatus(raw.status ?? raw.state),
    details: raw.details != null ? String(raw.details) : null,
    timestamp: normalizeTimestamp(raw.timestamp),
    metadata: normalizedMetadata,
    durationMs,
  };
};

const sectionOrderIndex = (section: string): number => {
  const idx = SECTION_ORDER.findIndex((item) => item.toLowerCase() === section.toLowerCase());
  return idx === -1 ? SECTION_ORDER.length + 1 : idx;
};

const orderRecords = (records: SystemTestRecord[]): SystemTestRecord[] =>
  [...records].sort((a, b) => {
    const aIdx = sectionOrderIndex(a.section);
    const bIdx = sectionOrderIndex(b.section);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.section.localeCompare(b.section);
  });

const ensureBaselineSections = (records: SystemTestRecord[]): SystemTestRecord[] => {
  const lookup = new Map(records.map((record) => [record.section.toLowerCase(), record]));
  const placeholders = SECTION_ORDER
    .filter((section) => !lookup.has(section.toLowerCase()))
    .map((section) => ({
      runId: null,
      section,
      status: 'pending' as SystemTestStatus,
      details: 'Awaiting first run',
      timestamp: null,
      metadata: null,
      durationMs: null,
    }));
  return orderRecords([...records, ...placeholders]);
};

const getEarliestTimestamp = (entries: SystemTestRecord[]): string | null => {
  const times = entries
    .map((entry) => entry.timestamp ? new Date(entry.timestamp).getTime() : null)
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (!times.length) {
    return null;
  }
  return new Date(Math.min(...times)).toISOString();
};

const getLatestTimestamp = (entries: SystemTestRecord[]): string | null => {
  const times = entries
    .map((entry) => entry.timestamp ? new Date(entry.timestamp).getTime() : null)
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (!times.length) {
    return null;
  }
  return new Date(Math.max(...times)).toISOString();
};

const summarizeRun = (entries: SystemTestRecord[]): SystemTestStatus => {
  if (!entries.length) {
    return 'pending';
  }
  let hasWarn = false;
  let hasRunning = false;
  let hasPending = false;
  for (const entry of entries) {
    if (entry.status === 'failed') {
      return 'failed';
    }
    if (entry.status === 'error') {
      return 'error';
    }
    if (entry.status === 'warn') {
      hasWarn = true;
    }
    if (entry.status === 'running') {
      hasRunning = true;
    }
    if (entry.status === 'pending') {
      hasPending = true;
    }
  }
  if (hasRunning) return 'running';
  if (hasPending) return 'pending';
  if (hasWarn) return 'warn';
  return 'ok';
};

const normalizeRun = (raw: any): SystemTestRun => {
  const entriesRaw = Array.isArray(raw?.entries) ? raw.entries.map(normalizeRecord) : [];
  const entriesMap = new Map<string, SystemTestRecord>();
  for (const entry of entriesRaw) {
    const key = entry.section.toLowerCase();
    const existing = entriesMap.get(key);
    if (!existing) {
      entriesMap.set(key, entry);
      continue;
    }
    const existingTime = existing.timestamp ? new Date(existing.timestamp).getTime() : -Infinity;
    const candidateTime = entry.timestamp ? new Date(entry.timestamp).getTime() : -Infinity;
    if (candidateTime >= existingTime) {
      entriesMap.set(key, entry);
    }
  }
  const entries = orderRecords(Array.from(entriesMap.values()));

  const runId = raw?.runId ? String(raw.runId) : (raw?.run_id ? String(raw.run_id) : `run-${Math.random().toString(36).slice(2, 10)}`);
  const startedAt = normalizeTimestamp(raw?.startedAt) || getEarliestTimestamp(entriesRaw);
  const completedAt = normalizeTimestamp(raw?.completedAt) || getLatestTimestamp(entriesRaw);
  const statusFromPayload = canonicalStatus(raw?.overallStatus ?? raw?.status);
  const overallStatus = statusFromPayload === 'pending' && entries.length
    ? summarizeRun(entries)
    : statusFromPayload;
  return {
    runId,
    startedAt,
    completedAt,
    overallStatus,
    entries,
  };
};

const sortRuns = (a: SystemTestRun, b: SystemTestRun): number => {
  const aTime = a.completedAt || a.startedAt;
  const bTime = b.completedAt || b.startedAt;
  if (aTime && bTime) {
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  }
  if (bTime) return 1;
  if (aTime) return -1;
  return b.runId.localeCompare(a.runId);
};

const normalizeSnapshot = (raw: any): SystemTestSnapshot => {
  if (!raw || typeof raw !== 'object') {
    return {
      latest: ensureBaselineSections([]),
      history: [],
    };
  }

  const latestRaw = Array.isArray(raw.latest) ? raw.latest : [];
  const historyRaw = Array.isArray(raw.history) ? raw.history : [];

  const latest = ensureBaselineSections(latestRaw.map(normalizeRecord));
  const history = historyRaw.map(normalizeRun).sort(sortRuns).slice(0, 10);

  return { latest, history };
};

const cloneSnapshot = (snapshot: SystemTestSnapshot | null): SystemTestSnapshot => {
  if (!snapshot) {
    return normalizeSnapshot({});
  }
  return {
    latest: snapshot.latest.map((entry) => ({ ...entry })),
    history: snapshot.history.map((run) => ({
      ...run,
      entries: run.entries.map((entry) => ({ ...entry })),
    })),
  };
};

const applyUpdate = (previous: SystemTestSnapshot | null, payload: any): SystemTestSnapshot => {
  if (payload && typeof payload === 'object' && (Array.isArray(payload.latest) || Array.isArray(payload.history))) {
    return normalizeSnapshot(payload);
  }

  const record = normalizeRecord(payload);
  const base = cloneSnapshot(previous);

  let latest = base.latest;
  const existingIndex = latest.findIndex((entry) => entry.section.toLowerCase() === record.section.toLowerCase());
  if (existingIndex === -1) {
    latest = ensureBaselineSections([...latest, record]);
  } else {
    latest = ensureBaselineSections([
      ...latest.slice(0, existingIndex),
      { ...latest[existingIndex], ...record },
      ...latest.slice(existingIndex + 1),
    ]);
  }

  let history = base.history;
  if (record.runId) {
    const runIndex = history.findIndex((run) => run.runId === record.runId);
    if (runIndex === -1) {
      const newRun = normalizeRun({ runId: record.runId, entries: [record] });
      history = [newRun, ...history];
    } else {
      const run = history[runIndex];
      const entryIndex = run.entries.findIndex((entry) => entry.section.toLowerCase() === record.section.toLowerCase());
      let entries: SystemTestRecord[];
      if (entryIndex === -1) {
        entries = orderRecords([...run.entries, record]);
      } else {
        entries = orderRecords([
          ...run.entries.slice(0, entryIndex),
          { ...run.entries[entryIndex], ...record },
          ...run.entries.slice(entryIndex + 1),
        ]);
      }
      history = history.map((existing, idx) => (
        idx === runIndex
          ? {
            runId: existing.runId,
            startedAt: getEarliestTimestamp(entries) || existing.startedAt,
            completedAt: getLatestTimestamp(entries) || existing.completedAt,
            overallStatus: summarizeRun(entries),
            entries,
          }
          : existing
      ));
    }
  }

  history = history.slice().sort(sortRuns).slice(0, 10);

  return { latest, history };
};

const shortRunId = (runId: string): string => {
  if (!runId) return '-';
  return runId.length > 10 ? runId.slice(0, 10).toUpperCase() : runId.toUpperCase();
};

const formatRelativeTime = (value: string | null | undefined): string => {
  if (!value) return 'Not run yet';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return 'Unknown time';
  }
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'Moments ago';
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes === 1) return '1 minute ago';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  const diffHours = Math.round(diffMs / 3600000);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
};

const formatAbsoluteTime = (value: string | null | undefined): string => {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
};

const formatDuration = (value: number | null | undefined): string | null => {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  if (value < 1000) return `${Math.round(value)} ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m${remainingSeconds ? ` ${remainingSeconds}s` : ''}`;
};

const formatMetadataValue = (value: unknown): string => {
  if (value == null) return 'n/a';
  if (typeof value === 'string') {
    return value.length > 60 ? `${value.slice(0, 57)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 60 ? `${serialized.slice(0, 57)}…` : serialized;
  } catch (error) {
    return String(value);
  }
};

const humanizeKey = (key: string): string => key
  .replace(/([A-Z])/g, ' $1')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/^./, (c) => c.toUpperCase());

const MetadataSummary: React.FC<{ metadata: Record<string, any> | null | undefined }> = ({ metadata }) => {
  if (!metadata) return null;
  const entries = Object.entries(metadata).slice(0, 3);
  if (!entries.length) return null;
  return (
    <div className="mt-3 grid gap-1 text-xs text-gray-500 dark:text-gray-400">
      {entries.map(([key, value]) => (
        <div key={key} className="flex justify-between gap-3">
          <span className="font-medium">{humanizeKey(key)}</span>
          <span className="max-w-[12rem] truncate text-right">{formatMetadataValue(value)}</span>
        </div>
      ))}
    </div>
  );
};

const StatusBadge: React.FC<{ status: SystemTestStatus }> = ({ status }) => {
  const theme = STATUS_THEME[status] ?? STATUS_THEME.pending;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${theme.className}`}>
      <span className={`h-2 w-2 rounded-full ${theme.dotClass}`} />
      {theme.label}
    </span>
  );
};

const AdminSystemTestsPage: React.FC = () => {
  const { token } = useAuth();
  const [snapshot, setSnapshot] = useState<SystemTestSnapshot>(() => normalizeSnapshot({}));
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [socketStatus, setSocketStatus] = useState<SocketState>('connecting');
  const [socketError, setSocketError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [runSubmitting, setRunSubmitting] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    setIsFetching(true);
    try {
      const response = await systemTestService.getSnapshot();
      const payload = response?.data?.data ?? response?.data ?? null;
      if (response?.data?.success === false) {
        throw new Error(response.data?.message || 'Failed to load system tests');
      }
      const normalized = normalizeSnapshot(payload);
      setSnapshot(normalized);
      setFetchError(null);
      setLastUpdate(new Date().toISOString());
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to load system tests';
      setFetchError(message);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  useEffect(() => {
    const url = API_BASE_URL.replace(/\/+$/, '');
    const socket = io(`${url}/system-tests`, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: token ? { token } : undefined,
    });

    socketRef.current = socket;
    setSocketStatus('connecting');
    setSocketError(null);

    socket.on('connect', () => {
      setSocketStatus('connected');
      setSocketError(null);
    });

    socket.on('disconnect', () => {
      setSocketStatus('disconnected');
    });

    socket.io.on('reconnect_attempt', () => {
      setSocketStatus('connecting');
    });

    socket.on('connect_error', (error) => {
      setSocketStatus('disconnected');
      setSocketError(error?.message || 'Unable to connect to system-test namespace');
    });

    socket.on('systemTestSnapshot', (payload) => {
      try {
        const normalized = normalizeSnapshot(payload);
        setSnapshot(normalized);
        setFetchError(null);
        setLastUpdate(new Date().toISOString());
      } catch (error) {
        console.warn('systemTestSnapshot normalization failed', error);
      }
    });

    socket.on('systemTestUpdate', (payload) => {
      setSnapshot((previous) => {
        try {
          const next = applyUpdate(previous, payload);
          return next;
        } catch (error) {
          console.warn('systemTestUpdate apply failed', error);
          return previous ?? normalizeSnapshot({});
        }
      });
      setLastUpdate(new Date().toISOString());
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const activeRun = useMemo(() => {
    if (activeRunId) {
      return snapshot.history.find((run) => run.runId === activeRunId) ?? null;
    }
    return snapshot.history.find((run) => run.overallStatus === 'running' || run.overallStatus === 'pending') ?? null;
  }, [activeRunId, snapshot.history]);

  useEffect(() => {
    if (!activeRunId) {
      return;
    }
    const run = snapshot.history.find((item) => item.runId === activeRunId);
    if (run && run.overallStatus !== 'pending' && run.overallStatus !== 'running') {
      setActiveRunId(null);
      setRunMessage(`Run ${shortRunId(run.runId)} completed`);
    }
  }, [activeRunId, snapshot.history]);

  useEffect(() => {
    if (!runMessage) return undefined;
    const timer = window.setTimeout(() => setRunMessage(null), 7000);
    return () => window.clearTimeout(timer);
  }, [runMessage]);

  const runBlockedBy = useMemo(() => snapshot.history.find((run) => run.overallStatus === 'running' || run.overallStatus === 'pending')?.runId ?? null, [snapshot.history]);
  const runButtonDisabled = runSubmitting || Boolean(runBlockedBy && (!activeRunId || runBlockedBy !== activeRunId));

  const handleRunClick = useCallback(async () => {
    setRunSubmitting(true);
    setRunError(null);
    try {
      const response = await systemTestService.run();
      if (response?.data?.success) {
        const runId = response?.data?.data?.runId || null;
        setRunMessage('System tests started');
        if (runId) {
          setActiveRunId(runId);
        }
      } else {
        const message = response?.data?.message || 'Failed to start system tests';
        setRunError(message);
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to start system tests';
      setRunError(message);
    } finally {
      setRunSubmitting(false);
    }
  }, []);

  const handleRefreshClick = useCallback(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  const latestSections = snapshot.latest;
  const latestRun = snapshot.history.length > 0 ? snapshot.history[0] : null;

  const socketStatusTag = (() => {
    const theme = SOCKET_STATUS_THEME[socketStatus];
    return (
      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${theme.className}`}>
        <span className={`h-2 w-2 rounded-full ${theme.dotClass}`} />
        {theme.label}
      </span>
    );
  })();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <HeaderFrame
        subtitle="Real-time readiness verification"
        badgeLabel="System Tests"
        badgeTone="emerald"
        contextTag={socketStatusTag}
        rightSlot={(
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {socketError ? (
              <span className="text-xs font-medium text-rose-600 dark:text-rose-300">
                {socketError}
              </span>
            ) : null}
            <Link
              to="/admin/dashboard"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              Back to Dashboard
            </Link>
            <DarkModeToggle />
          </div>
        )}
      />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24 space-y-8">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">System Test Orchestration</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Track the full stack validation workflow and trigger new runs when changes land.
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                {lastUpdate ? <span>Last update {formatRelativeTime(lastUpdate)}</span> : <span>No updates yet</span>}
                {activeRun ? (
                  <span>Active run {shortRunId(activeRun.runId)}</span>
                ) : latestRun ? (
                  <span>Last run {shortRunId(latestRun.runId)} • {formatRelativeTime(latestRun.completedAt || latestRun.startedAt)}</span>
                ) : (
                  <span>No historical runs</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleRefreshClick}
                disabled={isFetching}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-600"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleRunClick}
                disabled={runButtonDisabled}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500 bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {runSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run System Tests
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {runBlockedBy && (!activeRunId || runBlockedBy !== activeRunId) ? (
              <p className="text-amber-600 dark:text-amber-300">
                Run {shortRunId(runBlockedBy)} is currently in progress.
              </p>
            ) : null}
            {runMessage ? (
              <p className="text-emerald-600 dark:text-emerald-300">{runMessage}</p>
            ) : null}
            {runError ? (
              <p className="text-rose-600 dark:text-rose-300">{runError}</p>
            ) : null}
          </div>
        </section>

        {fetchError ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-200">
            {fetchError}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2">
          {latestSections.map((record) => (
            <div
              key={record.section}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{record.section}</h3>
                  {record.runId ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Run {shortRunId(record.runId)}</p>
                  ) : null}
                </div>
                <StatusBadge status={record.status} />
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">
                {record.details || 'Awaiting diagnostics'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>Updated {formatRelativeTime(record.timestamp)}</span>
                {record.timestamp ? <span>{formatAbsoluteTime(record.timestamp)}</span> : null}
                {formatDuration(record.durationMs) ? (
                  <span>Duration {formatDuration(record.durationMs)}</span>
                ) : null}
              </div>
              <MetadataSummary metadata={record.metadata ?? null} />
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Runs</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Timeline of the latest automated verification cycles.</p>
            </div>
          </div>
          {snapshot.history.length === 0 ? (
            <div className="px-6 py-8 text-sm text-gray-500 dark:text-gray-400">No runs recorded yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {snapshot.history.map((run) => (
                <div key={run.runId} className="px-6 py-5 space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                        <History className="h-4 w-4" />
                        <span className="text-sm font-semibold">Run {shortRunId(run.runId)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        {run.startedAt ? <span>Started {formatAbsoluteTime(run.startedAt)}</span> : null}
                        {run.completedAt ? <span>Completed {formatAbsoluteTime(run.completedAt)}</span> : null}
                      </div>
                    </div>
                    <StatusBadge status={run.overallStatus} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {run.entries.map((entry) => (
                      <div
                        key={`${run.runId}-${entry.section}`}
                        className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{entry.section}</span>
                          <StatusBadge status={entry.status} />
                        </div>
                        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line">
                          {entry.details || 'No additional details provided.'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                          {entry.timestamp ? <span>Updated {formatRelativeTime(entry.timestamp)}</span> : null}
                          {formatDuration(entry.durationMs) ? (
                            <span>Duration {formatDuration(entry.durationMs)}</span>
                          ) : null}
                        </div>
                        <MetadataSummary metadata={entry.metadata ?? null} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminSystemTestsPage;
