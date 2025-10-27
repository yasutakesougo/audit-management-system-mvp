import { useEffect, useMemo, useState, type CSSProperties } from 'react';
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
        </div>
      ) : null}
    </div>
  );
};

export default HydrationHud;
