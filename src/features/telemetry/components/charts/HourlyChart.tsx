import type { HourlyBucket } from '../../domain/computeCtaKpis';

export function HourlyChart({ buckets }: { buckets: HourlyBucket[] }) {
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
      {buckets.map((b) => {
        const height = maxCount > 0 ? Math.max((b.count / maxCount) * 100, 2) : 2;
        const active = b.count > 0;
        return (
          <div
            key={b.hour}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
            title={`${b.hour}時: ${b.count}件`}
          >
            <div
              style={{
                width: '100%',
                height: `${height}%`,
                background: active
                  ? 'linear-gradient(180deg, #3b82f6, #60a5fa)'
                  : '#e2e8f0',
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.5s ease',
                minHeight: 2,
              }}
            />
            <span style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1 }}>
              {b.hour}
            </span>
          </div>
        );
      })}
    </div>
  );
}
