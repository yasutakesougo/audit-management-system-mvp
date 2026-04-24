import React, { useMemo } from 'react';
import { getAuditFailureSummary, getOrchestratorHealthScore, recordResolution, OrchestratorFailureKind } from '@/lib/telemetry/auditLogger';
import { auditRepository } from '@/features/telemetry/repositories/FirestoreAuditRepository';

/**
 * OrchestrationAuditSummary — Actionable Edition
 */
export const OrchestrationAuditSummary: React.FC = () => {
  const [refreshCount, setRefreshCount] = React.useState(0);
  const summary = useMemo(() => getAuditFailureSummary(), [refreshCount]);
  const health = useMemo(() => getOrchestratorHealthScore(), [refreshCount]);

  const healthColor = health.score >= 80 ? '#166534' : health.score >= 60 ? '#d48806' : '#cf1322';
  const healthBg = health.score >= 80 ? '#f0fdf4' : health.score >= 60 ? '#fffbe6' : '#fff1f0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* 1. Health Score Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div style={{ padding: '16px', background: healthBg, borderRadius: '8px', border: `1px solid ${healthColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#8c8c8c', fontWeight: 600 }}>HEALTH SCORE</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: healthColor }}>{health.score}%</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: healthColor, fontWeight: 600 }}>{health.status}</div>
        </div>

        <div style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600 }}>ACTION REQUIRED</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626' }}>{summary.openCount}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: '#94a3b8' }}>Unresolved</div>
        </div>

        <div style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>RESOLVED</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a' }}>{summary.resolvedCount}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: '#94a3b8' }}>Handled</div>
        </div>
      </div>

      {/* 2. Top Failure Analysis (Only if failures exist) */}
      {summary.totalFailures > 0 && (
        <div style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600, marginBottom: '12px' }}>📊 TOP FAILURE ACTIONS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {summary.topFailureActions.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '12px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>{i + 1}</div>
                <div style={{ flex: 1, fontSize: '13px', fontWeight: 500 }}>{f.action}</div>
                <div style={{ fontSize: '12px', color: '#cf1322', fontWeight: 700 }}>{f.count} failures</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Latest Failures with Actions */}
      <div style={{ padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600, marginBottom: '12px' }}>📋 LATEST FAILURES & ACTIONS</div>
        {summary.totalFailures === 0 ? (
          <div style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
            No failures detected in recent actions.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {summary.latestFailures.map((f, i) => (
              <div key={i} style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', borderLeft: `4px solid ${f.governanceStatus === 'resolved' ? '#16a34a' : f.error?.kind === OrchestratorFailureKind.CONFLICT ? '#d48806' : '#cf1322'}`, opacity: f.governanceStatus === 'resolved' ? 0.7 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>{f.action}</span>
                    {f.governanceStatus === 'resolved' && (
                      <span style={{ fontSize: '10px', padding: '2px 6px', background: '#dcfce7', color: '#166534', borderRadius: '4px', fontWeight: 600 }}>RESOLVED</span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: '#8c8c8c' }}>{f.error?.kind}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#434343', marginBottom: '6px' }}>{f.error?.message}</div>
                
                {f.governanceStatus === 'open' ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ flex: 1, fontSize: '11px', color: '#1d4ed8', background: '#eff6ff', padding: '4px 8px', borderRadius: '4px', fontWeight: 500 }}>
                      👉 { (f as { suggestedAction?: string }).suggestedAction }
                    </div>
                    <button
                      onClick={async () => {
                        const note = window.prompt('対応内容を入力してください:');
                        if (note) {
                          const entry = recordResolution({ auditId: f.id, resolvedBy: 'Admin', note });
                          if (entry && entry.firestoreId) {
                            await auditRepository.resolve({
                              firestoreId: entry.firestoreId,
                              governanceStatus: entry.governanceStatus!,
                              resolution: entry.resolution!
                            });
                          }
                          setRefreshCount(c => c + 1);
                        }
                      }}
                      style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      解決済みにする
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#166534', background: '#f0fdf4', padding: '4px 8px', borderRadius: '4px' }}>
                    ✅ 対応済み: {f.resolution?.note} ({f.resolution?.resolvedBy})
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
