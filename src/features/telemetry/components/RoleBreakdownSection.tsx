/**
 * RoleBreakdownSection — role 別 KPI を表示するダッシュボードセクション
 */
import type { RoleBreakdown, RoleKpi, RoleId } from '../domain/computeCtaKpisByRole';

// ── Role Labels ─────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<RoleId, string> = {
  staff: 'スタッフ',
  admin: '管理者',
  unknown: '不明',
};

const ROLE_COLORS: Record<RoleId, string> = {
  staff: '#3b82f6',
  admin: '#8b5cf6',
  unknown: '#94a3b8',
};

// ── Metric Color ────────────────────────────────────────────────────────────

function metricColor(value: number, type: 'hero' | 'queue' | 'completion'): string {
  switch (type) {
    case 'hero':
      return value < 70 ? '#f59e0b' : '#10b981';
    case 'queue':
      return value > 40 ? '#f59e0b' : '#10b981';
    case 'completion':
      return value < 50 ? '#ef4444' : '#10b981';
  }
}

// ── Role Card ───────────────────────────────────────────────────────────────

function RoleKpiCard({ kpi }: { kpi: RoleKpi }) {
  const roleColor = ROLE_COLORS[kpi.role];

  const metrics = [
    { label: 'Hero', value: kpi.heroRate, type: 'hero' as const },
    { label: 'Queue', value: kpi.queueRate, type: 'queue' as const },
    { label: '完了', value: kpi.completionRate, type: 'completion' as const },
  ];

  return (
    <div
      style={{
        border: `1.5px solid ${roleColor}30`,
        borderRadius: 12,
        padding: '14px 18px',
        background: `linear-gradient(135deg, ${roleColor}05, ${roleColor}10)`,
        flex: 1,
        minWidth: 200,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: roleColor,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 700, color: roleColor }}>
          {ROLE_LABELS[kpi.role]}
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>
          CTA {kpi.totalCtaClicks}回
        </span>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>
              {m.label}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: metricColor(m.value, m.type),
                lineHeight: 1,
              }}
            >
              {m.value}
              <span style={{ fontSize: 12, fontWeight: 600 }}>%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section ─────────────────────────────────────────────────────────────────

export function RoleBreakdownSection({ data }: { data: RoleBreakdown }) {
  if (data.length === 0) return null;

  return (
    <section style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: '#1e293b',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        👤 Role Breakdown
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {data.map((kpi) => (
          <RoleKpiCard key={kpi.role} kpi={kpi} />
        ))}
      </div>
    </section>
  );
}
