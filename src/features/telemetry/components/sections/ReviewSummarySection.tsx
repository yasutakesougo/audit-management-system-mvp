import type { ReviewLoopSummary } from '../../domain/buildReviewLoopSummary';

export function ReviewSummarySection({ summary }: { summary: ReviewLoopSummary | null }) {
  if (!summary) return null;

  const overallStatus: 'critical' | 'warning' | 'stable' | 'improving' =
    summary.criticalAlerts > 0 || summary.worseningAlerts > 0 ? 'critical' :
    summary.warningAlerts > 0 || summary.ongoingAlerts > 0 ? 'warning' :
    summary.totalCurrentAlerts === 0 ? 'stable' : 'improving';

  const getStatusColor = (status: typeof overallStatus) => {
    if (status === 'critical') return '#dc2626';
    if (status === 'warning') return '#d97706';
    if (status === 'stable') return '#10b981';
    return '#64748b';
  };

  const getStatusText = (status: typeof overallStatus) => {
    if (status === 'critical') return '要緊急対応 🚨';
    if (status === 'warning') return '注意 🟡';
    if (status === 'stable') return '安定 🟢';
    return '改善中 🚀';
  };

  return (
    <div style={{
      marginBottom: 20,
      background: '#fff',
      borderRadius: 12,
      padding: 16,
      border: `2px solid ${getStatusColor(overallStatus)}30`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#1e293b' }}>
          📈 改善サイクル サマリ
        </h2>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: getStatusColor(overallStatus),
          background: `${getStatusColor(overallStatus)}15`,
          padding: '4px 10px',
          borderRadius: 16,
        }}>
          {getStatusText(overallStatus)}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, background: '#f8fafc', padding: 10, borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>新規 / 悪化</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: (summary.newAlerts + summary.worseningAlerts) > 0 ? '#dc2626' : '#1e293b' }}>
            {summary.newAlerts + summary.worseningAlerts}
          </div>
        </div>
        <div style={{ flex: 1, background: '#f8fafc', padding: 10, borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>改善</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: summary.improvingAlerts > 0 ? '#10b981' : '#1e293b' }}>
            {summary.improvingAlerts}
          </div>
        </div>
        <div style={{ flex: 1, background: '#f8fafc', padding: 10, borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>継続</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#d97706' }}>
            {summary.ongoingAlerts}
          </div>
        </div>
      </div>

      {summary.topConcerns.length > 0 && (
        <div style={{ fontSize: 12, background: '#fef2f2', padding: 10, borderRadius: 8, border: '1px solid #fee2e2' }}>
          <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: 6 }}>優先対応項目:</div>
          <ul style={{ margin: 0, paddingLeft: 16, color: '#b91c1c', lineHeight: 1.5 }}>
            {summary.topConcerns.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
