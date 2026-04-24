import React, { useMemo } from 'react';
import { getAuditFailureSummary, getOrchestratorHealthScore, OrchestratorFailureKind } from '@/lib/telemetry/auditLogger';

/**
 * OrchestrationAuditSummary — Actionable Edition
 */
export const OrchestrationAuditSummary: React.FC = () => {
  const summary = useMemo(() => getAuditFailureSummary(), []);
  const health = useMemo(() => getOrchestratorHealthScore(), []);

  const healthColor = health.score >= 80 ? '#166534' : health.score >= 60 ? '#d48806' : '#cf1322';
  const healthBg = health.score >= 80 ? '#f0fdf4' : health.score >= 60 ? '#fffbe6' : '#fff1f0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* 1. Health Score Card */}
      <div style={{ padding: '16px', background: healthBg, borderRadius: '8px', border: `1px solid ${healthColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#8c8c8c', fontWeight: 600 }}>ORCHESTRATOR HEALTH</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: healthColor }}>
            {health.score}% <span style={{ fontSize: '14px', fontWeight: 400 }}>({health.status})</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: '#8c8c8c' }}>Success Rate: {health.successRate}%</div>
          <div style={{ fontSize: '11px', color: '#8c8c8c' }}>Total Actions: {health.totalCount}</div>
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
              <div key={i} style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', borderLeft: `4px solid ${f.error?.kind === OrchestratorFailureKind.CONFLICT ? '#d48806' : '#cf1322'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>{f.action}</span>
                  <span style={{ fontSize: '11px', color: '#8c8c8c' }}>{f.error?.kind}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#434343', marginBottom: '6px' }}>{f.error?.message}</div>
                <div style={{ fontSize: '11px', color: '#1d4ed8', background: '#eff6ff', padding: '4px 8px', borderRadius: '4px', fontWeight: 500 }}>
                  👉 推奨アクション: {(f as { suggestedAction?: string }).suggestedAction}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
