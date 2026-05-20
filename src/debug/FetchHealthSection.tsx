import { formatBreakerReason } from '@/lib/circuitBreaker/evaluator';
import type { getBreakerSnapshots } from '@/lib/circuitBreaker/store';
import {
  BREAKER_COLORS,
  listStyle,
  rowStyle,
  sectionLabelStyle,
} from './hudStyles';

type FetchHealthSectionProps = {
  snapshots: Record<string, ReturnType<typeof getBreakerSnapshots>[keyof ReturnType<typeof getBreakerSnapshots>]>;
};

export function FetchHealthSection({ snapshots }: FetchHealthSectionProps) {
  const layers = Object.values(snapshots);

  return (
    <>
      <div style={sectionLabelStyle}>
        <span style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Fetch Health</span>
      </div>
      <div data-testid="hud-fetch-health" style={{ ...listStyle, gap: 6 }}>
        {layers.map((snap) => (
          <div
            key={snap.layer}
            style={{
              ...rowStyle,
              borderLeft: `3px solid ${BREAKER_COLORS[snap.state] ?? '#999'}`,
              flexDirection: 'column',
              alignItems: 'stretch',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {snap.layer}
              </span>
              <span
                data-testid={`breaker-state-${snap.layer}`}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: BREAKER_COLORS[snap.state] ?? '#999',
                  color: snap.state === 'HALF_OPEN' ? '#000' : '#fff',
                }}
              >
                {snap.state}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 16px', fontSize: 11, marginTop: 4 }}>
              <StatCell label="Success" value={`${(snap.stats.successRate * 100).toFixed(0)}%`}
                warn={snap.stats.successRate < 0.8} />
              <StatCell label="Avg" value={`${snap.stats.avgDurationMs}ms`}
                warn={snap.stats.avgDurationMs > 2000} />
              <StatCell label="p95" value={`${snap.stats.p95DurationMs}ms`}
                warn={snap.stats.p95DurationMs > 3000} />
              <StatCell label="Errors" value={String(snap.stats.errorCount)}
                warn={snap.stats.errorCount > 0} />
              <StatCell label="Slow" value={String(snap.stats.slowCount)}
                warn={snap.stats.slowCount > 3} />
              <StatCell label="Retries" value={String(snap.stats.totalRetries)}
                warn={snap.stats.totalRetries > 2} />
            </div>
            {snap.stats.consecutiveFailures > 0 && (
              <div style={{ fontSize: 11, color: '#f87171', marginTop: 2 }}>
                🔴 {snap.stats.consecutiveFailures} consecutive failures
              </div>
            )}
            {snap.reason && (
              <div style={{ fontSize: 11, color: '#facc15', marginTop: 2 }}>
                ⚡ {formatBreakerReason(snap.reason)}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function StatCell({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ opacity: 0.5, fontSize: 10, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontWeight: 600, color: warn ? '#f87171' : '#e2e8f0' }}>{value}</span>
    </div>
  );
}
