import type { FunnelStep } from '../../domain/computeCtaKpis';
import { EmptyState } from '../ui/EmptyState';

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  if (steps.length === 0) return <EmptyState message="ファネルデータがありません" />;

  const maxCount = Math.max(...steps.map((s) => s.count), 1);
  const colors = ['#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div>
      {steps.map((step, i) => {
        const width = maxCount > 0 ? Math.max((step.count / maxCount) * 100, 8) : 8;
        return (
          <div key={step.label} style={{ marginBottom: i < steps.length - 1 ? 8 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: '#334155', fontWeight: 500 }}>
                {i > 0 && <span style={{ color: '#94a3b8', marginRight: 4 }}>→</span>}
                {step.label}
              </span>
              <span style={{ color: '#64748b' }}>
                {step.count}件
                {i > 0 && (
                  <span style={{ color: step.rate >= 50 ? '#10b981' : '#ef4444', fontWeight: 600, marginLeft: 6 }}>
                    {step.rate}%
                  </span>
                )}
              </span>
            </div>
            <div style={{ background: '#f1f5f9', borderRadius: 6, height: 20, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${width}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${colors[i % colors.length]}, ${colors[i % colors.length]}80)`,
                  borderRadius: 6,
                  transition: 'width 0.5s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {width >= 20 && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{step.count}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
