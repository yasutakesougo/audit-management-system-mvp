import type { KpiDiff, Trend } from '../../domain/computeCtaKpiDiff';

export function KpiCard({
  label,
  value,
  unit,
  color,
  subLabel,
  diff,
}: {
  label: string;
  value: number | string;
  unit?: string;
  color: string;
  subLabel?: string;
  diff?: KpiDiff;
}) {
  const trendColor: Record<Trend, string> = {
    up: '#10b981',
    down: '#ef4444',
    flat: '#94a3b8',
  };

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${color}08, ${color}15)`,
        border: `1.5px solid ${color}30`,
        borderRadius: 14,
        padding: '16px 20px',
        minWidth: 150,
        flex: 1,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 14, fontWeight: 600, color: `${color}90` }}>
            {unit}
          </span>
        )}
      </div>
      {diff && (
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: trendColor[diff.trend],
          marginTop: 4,
        }}>
          {diff.diffFormatted}
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>
            vs 前期間
          </span>
        </div>
      )}
      {subLabel && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: diff ? 2 : 4 }}>
          {subLabel}
        </div>
      )}
    </div>
  );
}
