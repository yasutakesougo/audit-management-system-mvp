import type { FlowDistribution } from '../../domain/computeCtaKpis';
import { EmptyState } from '../ui/EmptyState';

export function FlowDistributionChart({ data }: { data: FlowDistribution[] }) {
  if (data.length === 0) return <EmptyState message="導線データがありません" />;

  const colors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

  return (
    <div>
      {/* Bar chart */}
      <div style={{ display: 'flex', gap: 2, height: 32, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
        {data.map((d, i) => (
          <div
            key={d.destination}
            style={{
              width: `${d.rate}%`,
              background: colors[i % colors.length],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: d.rate > 0 ? 24 : 0,
              transition: 'width 0.5s ease',
            }}
          >
            {d.rate >= 15 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                {d.rate}%
              </span>
            )}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {data.map((d, i) => (
          <div key={d.destination} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: colors[i % colors.length], flexShrink: 0 }} />
            <span style={{ color: '#334155', fontWeight: 500 }}>{d.label}</span>
            <span style={{ color: '#94a3b8' }}>{d.count}件</span>
            <span style={{ color: '#94a3b8' }}>({d.rate}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
