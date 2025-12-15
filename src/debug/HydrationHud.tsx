import { getServiceThresholds } from '@/config/serviceRecords';
import { isDev } from '@/env';
import {
  getHydrationSpans,
  isHudExplicitlyEnabled,
  subscribeHydrationSpans,
  type HydrationSpan
} from '@/lib/hydrationHud';
import {
  getPrefetchEntries,
  subscribePrefetchEntries,
  type PrefetchEntry
} from '@/prefetch/tracker';
import {
  getTelemetrySampleRate,
  sendHydrationSpans,
  toTelemetrySpan,
  type HydrationTelemetrySpan,
} from '@/telemetry/hydrationBeacon';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';

const STORAGE_KEY = 'prefetch:hud:visible';
const STATUS_COLORS: Record<'good' | 'warn' | 'bad', string> = {
  good: '#34d399',
  warn: '#fbbf24',
  bad: '#f87171',
};

const containerStyle: CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  zIndex: 2147483647,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 8,
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: '#fff',
  pointerEvents: 'none',
};

const buttonStyle: CSSProperties = {
  pointerEvents: 'auto',
  borderRadius: 999,
  backgroundColor: 'rgba(15, 23, 42, 0.85)',
  border: '1px solid rgba(148, 163, 184, 0.5)',
  color: '#e2e8f0',
  padding: '6px 14px',
  fontSize: 13,
  cursor: 'pointer',
  transition: 'background-color 0.2s ease',
};

const panelStyle: CSSProperties = {
  pointerEvents: 'none',
  minWidth: 240,
  maxWidth: 320,
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  borderRadius: 12,
  padding: '12px 16px',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.45)',
  border: '1px solid rgba(100, 116, 139, 0.35)',
  backdropFilter: 'blur(6px)',
};

const panelContentStyle: CSSProperties = {
  pointerEvents: 'none',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 13,
  marginBottom: 8,
};

const totalStyle: CSSProperties = {
  fontWeight: 600,
  letterSpacing: 0.2,
};

const sectionLabelStyle: CSSProperties = {
  ...headerStyle,
  marginTop: 12,
};

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  alignItems: 'center',
  gap: 12,
  fontSize: 12,
  lineHeight: 1.4,
  padding: '6px 8px 6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(148, 163, 184, 0.2)',
  backgroundColor: 'rgba(30, 41, 59, 0.7)',
  position: 'relative',
};

const telemetryRowStyle: CSSProperties = {
  ...rowStyle,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 6,
};

const thresholdsRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  lineHeight: 1.4,
  padding: '6px 8px 6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(148, 163, 184, 0.2)',
  backgroundColor: 'rgba(30, 41, 59, 0.7)',
};

const emptyStateStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  textAlign: 'center',
  padding: '12px 0',
};

const isTruthy = (value?: string | null): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
};

const detectHudEnabled = (): boolean => {
  if (isHudExplicitlyEnabled()) {
    return true;
  }
  const mode = (import.meta as ImportMeta).env?.MODE;
  if (typeof mode === 'string' && mode.toLowerCase() === 'test') {
    return true;
  }
  return isDev;
};

const readInitialVisibility = (enabled: boolean): boolean => {
  if (!enabled || typeof window === 'undefined') {
    return false;
  }
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return false;
    }
    return isTruthy(stored);
  } catch {
    return false;
  }
};

const persistVisibility = (visible: boolean): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, visible ? '1' : '0');
  } catch {
    // ignore storage errors (private mode, etc.)
  }
};

const formatDuration = (duration?: number): string => {
  if (duration === undefined) {
    return '…';
  }
  return `${duration.toFixed(1)} ms`;
};

const readBudget = (span: HydrationSpan): number | null => {
  const candidate = span.meta && 'budget' in span.meta ? span.meta.budget : null;
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }
  return null;
};

const spanStatus = (span: HydrationSpan): 'good' | 'warn' | 'bad' => {
  if (span.error) return 'bad';
  const duration = span.duration ?? 0;
  const budget = readBudget(span);
  if (budget !== null) {
    if (duration <= budget) return 'good';
    if (duration <= budget * 1.25) return 'warn';
    return 'bad';
  }
  if (duration <= 60) return 'good';
  if (duration <= 100) return 'warn';
  return 'bad';
};

const PREFETCH_STATUS_STYLE: Record<PrefetchEntry['status'], 'good' | 'warn' | 'bad'> = {
  pending: 'warn',
  completed: 'good',
  error: 'bad',
  aborted: 'warn',
  skipped: 'warn',
  reused: 'good',
};

const formatPrefetchMeta = (entry: PrefetchEntry): string => {
  const metaPairs: Array<[string, unknown]> = [
    ['source', entry.source],
    ['status', entry.status],
    ['ttl', entry.ttlMs],
  ];
  if (entry.meta) {
    Object.entries(entry.meta).forEach(([key, value]) => {
      metaPairs.push([key, value]);
    });
  }
  return metaPairs
    .map(([key, value]) => `${key}:${String(value)}`)
    .join(' ');
};

const readPrefetchDuration = (entry: PrefetchEntry): number | undefined => {
  if (entry.finishedAt && entry.startedAt) {
    return Math.max(0, entry.finishedAt - entry.startedAt);
  }
  return undefined;
};

export const HydrationHud: React.FC = () => {
  const hudEnabled = useMemo(() => detectHudEnabled(), []);
  const [visible, setVisible] = useState(() => readInitialVisibility(hudEnabled));
  const [spans, setSpans] = useState<HydrationSpan[]>(() => getHydrationSpans());
  const [prefetchEntries, setPrefetchEntries] = useState<PrefetchEntry[]>(() => getPrefetchEntries());
  const [telemetryStats, setTelemetryStats] = useState({
    sent: 0,
    skipped: 0,
    failed: 0,
    lastCount: 0,
    lastReason: null as 'manual' | 'beforeunload' | null,
  });
  const sampleDisplay = useMemo(() => Math.round(getTelemetrySampleRate() * 100), []);
  const completedSpans = useMemo(() => spans.filter((span) => span.end !== undefined), [spans]);
  const thresholds = useMemo(() => getServiceThresholds(), []);

  useEffect(() => {
    if (!hudEnabled) {
      return undefined;
    }
    setSpans(getHydrationSpans());
    const unsubscribe = subscribeHydrationSpans(setSpans);
    return () => {
      unsubscribe();
    };
  }, [hudEnabled]);

  useEffect(() => {
    if (!hudEnabled) {
      return undefined;
    }
    setPrefetchEntries(getPrefetchEntries());
    const unsubscribe = subscribePrefetchEntries(setPrefetchEntries);
    return () => {
      unsubscribe();
    };
  }, [hudEnabled]);

  useEffect(() => {
    if (!hudEnabled) {
      return;
    }
    persistVisibility(visible);
  }, [hudEnabled, visible]);

  useEffect(() => {
    if (!hudEnabled || typeof window === 'undefined') {
      return;
    }
    const target = window as typeof window & {
      __HYDRATION_HUD__?: Record<string, unknown>;
    };
    if (!target.__HYDRATION_HUD__) {
      target.__HYDRATION_HUD__ = {};
    }
    target.__HYDRATION_HUD__.telemetry = {
      pending: completedSpans.length,
      stats: telemetryStats,
      sample: getTelemetrySampleRate(),
    };
    // サービス記録しきい値をコンソールからも確認可能に
    target.__HYDRATION_HUD__.thresholds = thresholds;
  }, [completedSpans.length, hudEnabled, telemetryStats, thresholds]);

  const flushTelemetry = useCallback((reason: 'manual' | 'beforeunload') => {
    if (!hudEnabled) {
      return false;
    }
    const snapshot = getHydrationSpans();
    const payload: HydrationTelemetrySpan[] = snapshot
      .map((span) => toTelemetrySpan(span))
      .filter((value): value is HydrationTelemetrySpan => Boolean(value));

    if (payload.length === 0) {
      setTelemetryStats((prev) => ({
        ...prev,
        skipped: prev.skipped + 1,
        lastCount: 0,
        lastReason: reason,
      }));
      return false;
    }

    const sample = getTelemetrySampleRate();
    if (sample <= 0) {
      setTelemetryStats((prev) => ({
        ...prev,
        skipped: prev.skipped + 1,
        lastCount: payload.length,
        lastReason: reason,
      }));
      return false;
    }

    const rng = Math.random();
    if (sample < 1 && rng > sample) {
      setTelemetryStats((prev) => ({
        ...prev,
        skipped: prev.skipped + 1,
        lastCount: payload.length,
        lastReason: reason,
      }));
      return false;
    }

    const result = sendHydrationSpans(payload, { rand: () => rng });
    setTelemetryStats((prev) => ({
      sent: prev.sent + (result ? 1 : 0),
      failed: prev.failed + (result ? 0 : 1),
      skipped: prev.skipped,
      lastCount: payload.length,
      lastReason: reason,
    }));
    return result;
  }, [hudEnabled]);

  useEffect(() => {
    if (!hudEnabled) {
      return undefined;
    }
    const handler = () => {
      flushTelemetry('beforeunload');
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [flushTelemetry, hudEnabled]);

  if (!hudEnabled) {
    return null;
  }

  const totalDuration = spans.reduce((acc, span) => acc + (span.duration ?? 0), 0);

  return (
    <div style={containerStyle}>
      <button
        type="button"
        data-testid="prefetch-hud-toggle"
        style={buttonStyle}
        onClick={() => setVisible((prev) => !prev)}
      >
        HUD
      </button>
      {visible ? (
        <div data-testid="prefetch-hud" style={panelStyle}>
          <div style={panelContentStyle}>
            <div style={headerStyle}>
            <span style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Hydration</span>
            <span data-testid="prefetch-hud-total" style={totalStyle}>{formatDuration(totalDuration)}</span>
            </div>
            <div data-testid="hud-hydration" style={listStyle}>
            {spans.length === 0 ? (
              <div style={emptyStateStyle}>No spans captured yet</div>
            ) : (
              spans.map((span) => {
                const status = spanStatus(span);
                return (
                  <div
                    key={span.id}
                    style={{
                      ...rowStyle,
                      borderLeft: `3px solid ${STATUS_COLORS[status]}`,
                      boxShadow: status === 'bad' ? '0 0 0 1px rgba(248, 113, 113, 0.35)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 600 }}>{span.label}</span>
                      {span.meta && Object.keys(span.meta).length > 0 ? (
                        <span style={{ opacity: 0.7 }}>
                          {Object.entries(span.meta)
                            .map(([key, value]) => `${key}:${String(value)}`)
                            .join(' ')}
                        </span>
                      ) : null}
                      {span.error ? (
                        <span style={{ color: STATUS_COLORS.bad }}>⚠︎ {span.error}</span>
                      ) : null}
                    </div>
                    <span>{formatDuration(span.duration)}</span>
                  </div>
                );
              })
            )}
            </div>
            <div style={sectionLabelStyle}>
              <span style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Thresholds</span>
            </div>
            <div data-testid="hud-thresholds" style={{ ...listStyle, gap: 4 }}>
              <div style={thresholdsRowStyle}>
                <span data-testid="hud-threshold-discrepancy" data-value={`${thresholds.discrepancyMinutes}m`}>
                  乖離しきい値: {thresholds.discrepancyMinutes} 分
                </span>
                <span data-testid="hud-threshold-absence" data-value={String(thresholds.absenceMonthlyLimit)}>
                  月間欠席上限: {thresholds.absenceMonthlyLimit} 回
                </span>
                <span data-testid="hud-threshold-closeTime" data-value={thresholds.facilityCloseTime}>
                  施設閉所時刻: {thresholds.facilityCloseTime} ({thresholds.facilityCloseMinutes}分)
                </span>
              </div>
            </div>
            <div style={sectionLabelStyle}>
            <span style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Prefetch</span>
            <span style={totalStyle}>{prefetchEntries.length}</span>
            </div>
            <div data-testid="hud-prefetch" style={listStyle}>
            {prefetchEntries.length === 0 ? (
              <div style={emptyStateStyle}>No prefetch intents yet</div>
            ) : (
              prefetchEntries.map((entry) => {
                const status = PREFETCH_STATUS_STYLE[entry.status];
                return (
                  <div
                    key={`${entry.key}:${entry.startedAt}:${entry.source}`}
                    style={{
                      ...rowStyle,
                      borderLeft: `3px solid ${STATUS_COLORS[status]}`,
                      boxShadow: status === 'bad' ? '0 0 0 1px rgba(248, 113, 113, 0.35)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 600 }}>{entry.key}</span>
                      <span style={{ opacity: 0.7 }}>{formatPrefetchMeta(entry)}</span>
                      {entry.error ? (
                        <span style={{ color: STATUS_COLORS.bad }}>⚠︎ {entry.error}</span>
                      ) : null}
                    </div>
                    <span>{formatDuration(readPrefetchDuration(entry))}</span>
                  </div>
                );
              })
            )}
            </div>
          </div>
          <div style={sectionLabelStyle}>
            <span style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Telemetry</span>
            <span style={totalStyle}>{completedSpans.length}</span>
          </div>
          <div data-testid="hud-telemetry" style={{ ...listStyle, gap: 8 }}>
            <div style={telemetryRowStyle}>
              <span style={{ fontWeight: 600 }}>Pending spans: {completedSpans.length}</span>
              <span>Sent: {telemetryStats.sent} / Skipped: {telemetryStats.skipped} / Failed: {telemetryStats.failed}</span>
              <span>Sample: {sampleDisplay}%</span>
              {telemetryStats.lastCount > 0 ? (
                <span style={{ opacity: 0.7 }}>
                  Last payload: {telemetryStats.lastCount} spans
                  {telemetryStats.lastReason ? ` (${telemetryStats.lastReason})` : ''}
                </span>
              ) : null}
              <button
                type="button"
                data-testid="hud-telemetry-flush"
                style={{ ...buttonStyle, padding: '4px 12px', alignSelf: 'flex-start' }}
                onClick={() => flushTelemetry('manual')}
                disabled={completedSpans.length === 0}
              >
                Flush Telemetry
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default HydrationHud;
