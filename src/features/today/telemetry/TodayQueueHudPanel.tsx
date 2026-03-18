import type { CSSProperties } from 'react';
import { useTodayQueueTelemetryStore, selectLatestTodayQueueSample } from './todayQueueTelemetryStore';

const sectionLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 13,
  marginBottom: 8,
  marginTop: 12,
};

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
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
  padding: '6px 8px 6px 10px',
  textAlign: 'center',
};

const STATUS_COLORS = {
  muted: 'rgba(148, 163, 184, 0.4)',
  neutral: 'rgba(148, 163, 184, 0.8)',
  caution: '#fbbf24', // yellow
  warning: '#f87171', // red
};

export function TodayQueueHudPanel() {
  const latest = useTodayQueueTelemetryStore(selectLatestTodayQueueSample);

  if (!latest) {
    return (
      <>
        <div style={sectionLabelStyle}>
          <span style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Today Queue</span>
        </div>
        <div data-testid="hud-today-queue-empty" style={emptyStateStyle}>
          No queue telemetry yet
        </div>
      </>
    );
  }

  // Determine status color
  let statusColor = STATUS_COLORS.neutral;
  if (latest.p0Count > 0) {
    statusColor = STATUS_COLORS.warning;
  } else if (latest.overdueCount > 0) {
    statusColor = STATUS_COLORS.caution;
  } else if (latest.queueSize === 0) {
    statusColor = STATUS_COLORS.muted;
  }

  return (
    <>
      <div style={sectionLabelStyle}>
        <span style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Today Queue</span>
        <span style={{ fontWeight: 600, letterSpacing: 0.2 }}>{latest.queueSize}</span>
      </div>
      <div
        data-testid="hud-today-queue-data"
        style={{
          ...rowStyle,
          borderLeft: `3px solid ${statusColor}`,
          boxShadow: latest.p0Count > 0 ? '0 0 0 1px rgba(248, 113, 113, 0.35)' : 'none',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px', fontSize: 11 }}>
          <StatCell label="Total" value={String(latest.queueSize)} />
          <StatCell label="P0" value={String(latest.p0Count)} warn={latest.p0Count > 0} />
          <StatCell label="P1" value={String(latest.p1Count)} />
          <StatCell label="P2" value={String(latest.p2Count)} />
          <StatCell label="P3" value={String(latest.p3Count)} />
          <StatCell label="Overdue" value={String(latest.overdueCount)} caution={latest.overdueCount > 0} />
          <StatCell label="Attn" value={String(latest.requiresAttentionCount)} caution={latest.requiresAttentionCount > 0} />
        </div>
        <div style={{ fontSize: 10, opacity: 0.5, textAlign: 'right', marginTop: 2 }}>
          {new Date(latest.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </>
  );
}

function StatCell({ label, value, warn, caution }: { label: string; value: string; warn?: boolean; caution?: boolean }) {
  let color = '#e2e8f0';
  if (warn) color = STATUS_COLORS.warning;
  else if (caution) color = STATUS_COLORS.caution;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ opacity: 0.5, fontSize: 10, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontWeight: 600, color }}>{value}</span>
    </div>
  );
}
