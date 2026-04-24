/**
 * TelemetryDashboard — テレメトリダッシュボード v3 (KPI 可視化)
 */
import { useState } from 'react';
import { RANGE_LABELS } from './constants/labels';
import { RangeTabs } from './ui/RangeTabs';
import { useTelemetryDashboard } from '../hooks/useTelemetryDashboard';
import { KpiTabContent } from './sections/KpiTabContent';
import { RawTabContent } from './sections/RawTabContent';
import { AnomalyStatusChip, deriveAnomalyUiStatus } from './ui/AnomalyStatusChip';
import { OrchestrationAuditSummary } from './ui/OrchestrationAuditSummary';

type DashboardTab = 'kpi' | 'raw';

const DASHBOARD_TABS: ReadonlyArray<{ key: DashboardTab; label: string }> = [
  { key: 'kpi', label: '📈 KPI分析' },
  { key: 'raw', label: '📋 イベントログ' },
];

function getMaxDocsLabel(range: keyof typeof RANGE_LABELS): string {
  if (range === '30d') return '2000';
  if (range === '7d') return '500';
  return '200';
}

export default function TelemetryDashboard() {
  const {
    stats,
    kpis,
    kpiDiffs,
    roleBreakdown,
    classifiedAlerts,
    persistence,
    reviewSummary,
    transportKpis,
    transportAlerts,
    kioskUxKpis,
    loading,
    error,
    range,
    setRange,
    refresh,
  } = useTelemetryDashboard();

  const [showAllRanking, setShowAllRanking] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('kpi');

  if (loading && !stats) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
        テレメトリデータを読み込んでいます…
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, margin: 16 }}>
        <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>
          ⚠️ データ取得エラー
        </div>
        <div style={{ fontSize: 13, color: '#991b1b', marginBottom: 12, fontFamily: 'monospace' }}>
          {error}
        </div>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          Firestore セキュリティルールで <code>telemetry</code> の read が許可されていない可能性があります。
        </p>
        <button
          type="button"
          onClick={refresh}
          style={{
            marginTop: 12,
            padding: '6px 16px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            background: '#fff',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          🔄 再試行
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const warningCount = kpiDiffs?.alerts.length ?? 0;
  const anomalyStatus = deriveAnomalyUiStatus({
    totalEvents: stats.total,
    warningCount,
  });

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>
            📊 テレメトリダッシュボード
          </h1>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RangeTabs current={range} onChange={setRange} disabled={loading} />
          <AnomalyStatusChip status={anomalyStatus} count={warningCount} label="anomaly" />
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              cursor: loading ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
              color: '#475569',
              opacity: loading ? 0.5 : 1,
            }}
          >
            🔄
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {DASHBOARD_TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                border: active ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                background: active ? '#eff6ff' : '#fff',
                color: active ? '#1d4ed8' : '#64748b',
                fontWeight: active ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div
          style={{
            textAlign: 'center',
            padding: '8px 0',
            fontSize: 12,
            color: '#94a3b8',
            marginBottom: 8,
          }}
        >
          ⏳ {RANGE_LABELS[range]}のデータを取得中…
        </div>
      )}

      {activeTab === 'kpi' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <OrchestrationAuditSummary />
          <KpiTabContent
            range={range}
            kpis={kpis}
            kpiDiffs={kpiDiffs}
            roleBreakdown={roleBreakdown}
            classifiedAlerts={classifiedAlerts}
            persistence={persistence}
            reviewSummary={reviewSummary}
            transportKpis={transportKpis}
            transportAlerts={transportAlerts}
            kioskUxKpis={kioskUxKpis}
          />
        </div>
      ) : (
        <RawTabContent
          stats={stats}
          range={range}
          showAllRanking={showAllRanking}
          onToggleShowAllRanking={() => setShowAllRanking((prev) => !prev)}
        />
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: '#c0c0c0', textAlign: 'center' }}>
        telemetry collection · {RANGE_LABELS[range]} · max {getMaxDocsLabel(range)} docs
      </div>
    </div>
  );
}
