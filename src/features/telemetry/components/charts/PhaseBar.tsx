/**
 * PhaseBar — フェーズ分布横棒
 */

export function PhaseBar({ label, count, maxCount }: { label: string; count: number; maxCount: number }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 90, fontSize: 13, color: '#475569', textAlign: 'right', flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 6, height: 24, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
            borderRadius: 6,
            transition: 'width 0.5s ease',
            minWidth: pct > 0 ? 4 : 0,
          }}
        />
      </div>
      <div style={{ width: 36, fontSize: 13, fontWeight: 600, color: '#334155', textAlign: 'right' }}>
        {count}
      </div>
    </div>
  );
}
