import type { ScreenKpi } from '../../domain/computeCtaKpis';
import { EmptyState } from '../ui/EmptyState';

export function HeroQueueChart({ screenKpis, totalHeroRate }: { screenKpis: ScreenKpi[]; totalHeroRate: number }) {
  if (screenKpis.length === 0) return <EmptyState message="CTA データがありません" />;

  return (
    <div>
      {/* Total ratio bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: '#3b82f6', fontWeight: 600 }}>🎯 Hero {totalHeroRate}%</span>
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>📋 Queue {100 - totalHeroRate}%</span>
        </div>
        <div style={{ display: 'flex', height: 24, borderRadius: 8, overflow: 'hidden' }}>
          <div
            style={{
              width: `${totalHeroRate}%`,
              background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
              transition: 'width 0.5s ease',
              minWidth: totalHeroRate > 0 ? 4 : 0,
            }}
          />
          <div
            style={{
              width: `${100 - totalHeroRate}%`,
              background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              transition: 'width 0.5s ease',
              minWidth: 100 - totalHeroRate > 0 ? 4 : 0,
            }}
          />
        </div>
      </div>

      {/* Per-screen breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {screenKpis.map((s) => (
          <div
            key={s.screen}
            style={{
              background: '#f8fafc',
              borderRadius: 10,
              padding: '10px 14px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              {s.label}
            </div>
            <div style={{ display: 'flex', gap: 4, height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: `${s.heroRate}%`, background: '#3b82f6', borderRadius: 3 }} />
              <div style={{ width: `${100 - s.heroRate}%`, background: '#f59e0b', borderRadius: 3 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
              <span>H: {s.heroClicks}</span>
              <span>Q: {s.queueClicks}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
