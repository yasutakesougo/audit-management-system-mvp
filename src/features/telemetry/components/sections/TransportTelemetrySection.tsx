/**
 * TransportTelemetrySection — 送迎テレメトリの KPI + Alert 表示セクション
 *
 * 既存 TelemetryDashboard の KpiTabContent 内に配置する。
 * Alert → KPI → 補足説明 の順で表示（運用者は「問題があるか」を最初に確認したい）。
 *
 * @see computeTransportKpis.ts — facts
 * @see computeTransportAlerts.ts — judgment
 */
import type { KpiAlert } from '@/features/telemetry/domain/computeCtaKpiDiff';
import type { TransportKpis } from '@/features/today/transport/computeTransportKpis';
import { EMPTY_TRANSPORT_KPIS } from '@/features/today/transport/computeTransportKpis';
import { SectionCard } from '../ui/SectionCard';
import { SectionTitle } from '../ui/SectionTitle';

// ── Props ───────────────────────────────────────────────────────────────────

type TransportTelemetrySectionProps = {
  kpis: TransportKpis;
  alerts: KpiAlert[];
};

// ── Alert Row ───────────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<'critical' | 'warning', {
  bg: string;
  border: string;
  icon: string;
  color: string;
}> = {
  critical: {
    bg: '#fef2f2',
    border: '#fca5a5',
    icon: '🔴',
    color: '#dc2626',
  },
  warning: {
    bg: '#fffbeb',
    border: '#fcd34d',
    icon: '🟡',
    color: '#d97706',
  },
};

function AlertRow({ alert }: { alert: KpiAlert }) {
  const style = SEVERITY_STYLE[alert.severity];

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span>{style.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: style.color }}>
          {alert.label}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#fff',
            background: alert.severity === 'critical' ? '#dc2626' : '#d97706',
            borderRadius: 4,
            padding: '1px 6px',
            marginLeft: 'auto',
            textTransform: 'uppercase',
          }}
        >
          {alert.severity}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
        {alert.message}
      </div>
    </div>
  );
}

// ── KPI Mini Card ───────────────────────────────────────────────────────────

function MiniKpiCard({
  label,
  value,
  unit,
  color,
  subLabel,
}: {
  label: string;
  value: number | string;
  unit?: string;
  color: string;
  subLabel?: string;
}) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${color}08, ${color}15)`,
        border: `1.5px solid ${color}30`,
        borderRadius: 12,
        padding: '12px 16px',
        minWidth: 120,
        flex: 1,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: '#64748b',
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 12, fontWeight: 600, color: `${color}90` }}>
            {unit}
          </span>
        )}
      </div>
      {subLabel && (
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
          {subLabel}
        </div>
      )}
    </div>
  );
}

// ── Main Section ────────────────────────────────────────────────────────────

export function TransportTelemetrySection({
  kpis,
  alerts,
}: TransportTelemetrySectionProps) {
  const hasData =
    kpis.transitionCount > 0 ||
    kpis.syncFailedCount > 0 ||
    kpis.fallbackCount > 0 ||
    kpis.staleCount > 0;

  // 空データ時は簡易メッセージのみ
  if (!hasData && kpis === EMPTY_TRANSPORT_KPIS) {
    return (
      <SectionCard>
        <SectionTitle>🚐 送迎テレメトリ</SectionTitle>
        <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
          送迎テレメトリイベントがありません
        </div>
      </SectionCard>
    );
  }

  // 完了率表示
  const completionDisplay =
    kpis.arrivalCompletionRate !== null
      ? `${kpis.arrivalCompletionRate}`
      : '—';
  const completionUnit = kpis.arrivalCompletionRate !== null ? '%' : undefined;
  const completionSub =
    kpis.arrivalCompletionRate !== null
      ? `${kpis.arrivedCount} 名到着`
      : '対象者なし';

  return (
    <SectionCard>
      <SectionTitle>🚐 送迎テレメトリ</SectionTitle>

      {/* ── Alerts (先頭表示) ── */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {alerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {/* ── KPI Grid ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <MiniKpiCard
          label="到着完了率"
          value={completionDisplay}
          unit={completionUnit}
          color="#10b981"
          subLabel={completionSub}
        />
        <MiniKpiCard
          label="遷移回数"
          value={kpis.transitionCount}
          color="#3b82f6"
          subLabel={`往路 ${kpis.transitionCountTo} / 復路 ${kpis.transitionCountFrom}`}
        />
        <MiniKpiCard
          label="同期失敗"
          value={kpis.syncFailedCount}
          color={kpis.syncFailedCount > 0 ? '#ef4444' : '#94a3b8'}
          subLabel="AttendanceDaily"
        />
        <MiniKpiCard
          label="長時間停滞"
          value={kpis.staleCount}
          color={kpis.staleCount > 0 ? '#f59e0b' : '#94a3b8'}
          subLabel="30分超 in-progress"
        />
      </div>

      {/* ── Fallback Status ── */}
      {kpis.fallbackActive && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            color: '#92400e',
            marginBottom: 8,
          }}
        >
          ⚠️ 送迎対象者リストの取得に失敗し、全利用者をフォールバック表示中（{kpis.fallbackCount} 回発動）
        </div>
      )}

      {/* ── 補足説明 ── */}
      <div style={{ fontSize: 11, color: '#c0c0c0', marginTop: 4 }}>
        transport:* events · facts → judgment pipeline
      </div>
    </SectionCard>
  );
}
