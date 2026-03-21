import { useMemo, useRef } from 'react';
import {
  computeAssessmentStaleReviewResult,
  computeBehaviorTrendReviewResult,
  computeWeeklyReviewResult,
  detectSuggestionLifecycleAnomalies,
  useSuggestionLifecycleEvents,
  useSuggestionTelemetrySummary,
} from '@/features/action-engine';
import type { DateRange } from '../hooks/useTelemetryDashboard';
import { EmptyState } from './ui/EmptyState';
import { SectionCard } from './ui/SectionCard';
import { SectionTitle } from './ui/SectionTitle';
import { StatCard } from './ui/StatCard';
import {
  buildPreviousSuggestionLifecycleWindow,
  buildSuggestionLifecycleWindow,
  formatSuggestionRate,
} from './suggestionLifecycle';

type SuggestionLifecycleSectionProps = {
  range: DateRange;
};

type RateRow = {
  key: string;
  label: string;
  shown: number;
  cta: number;
  dismiss: number;
  snooze: number;
  resurfaced: number;
};

function formatDeltaPt(value: number): string {
  const rounded = Number(value.toFixed(1));
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}pt`;
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function SummaryRowTable({
  title,
  rows,
}: {
  title: string;
  rows: RateRow[];
}) {
  return (
    <div style={{ marginTop: 14, overflowX: 'auto' }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>
        {title}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b' }}>分類</th>
            <th style={{ textAlign: 'right', padding: '6px 8px', color: '#64748b' }}>shown</th>
            <th style={{ textAlign: 'right', padding: '6px 8px', color: '#64748b' }}>CTA率</th>
            <th style={{ textAlign: 'right', padding: '6px 8px', color: '#64748b' }}>dismiss率</th>
            <th style={{ textAlign: 'right', padding: '6px 8px', color: '#64748b' }}>snooze率</th>
            <th style={{ textAlign: 'right', padding: '6px 8px', color: '#64748b' }}>再浮上率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '7px 8px', color: '#334155', fontWeight: 600 }}>{row.label}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right', color: '#0f172a' }}>{row.shown}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right', color: '#334155' }}>{formatSuggestionRate(row.cta)}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right', color: '#334155' }}>{formatSuggestionRate(row.dismiss)}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right', color: '#334155' }}>{formatSuggestionRate(row.snooze)}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right', color: '#334155' }}>{formatSuggestionRate(row.resurfaced)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SuggestionLifecycleSection({
  range,
}: SuggestionLifecycleSectionProps) {
  const nowRef = useRef(new Date());
  const lifecycleWindow = useMemo(
    () => buildSuggestionLifecycleWindow(range, nowRef.current),
    [range],
  );
  const previousLifecycleWindow = useMemo(
    () => buildPreviousSuggestionLifecycleWindow(lifecycleWindow),
    [lifecycleWindow],
  );

  const {
    events,
    isLoading,
    isEmpty,
    error,
    refetch,
  } = useSuggestionLifecycleEvents({
    from: lifecycleWindow.from,
    to: lifecycleWindow.to,
    now: nowRef.current,
    maxDocs: lifecycleWindow.maxDocs,
  });
  const { events: previousEvents } = useSuggestionLifecycleEvents({
    from: previousLifecycleWindow.from,
    to: previousLifecycleWindow.to,
    now: nowRef.current,
    maxDocs: previousLifecycleWindow.maxDocs,
  });

  const { summary, byRule, byScreen, byPriority } = useSuggestionTelemetrySummary({
    events,
    window: {
      from: lifecycleWindow.from,
      to: lifecycleWindow.to,
      now: nowRef.current,
    },
  });
  const { summary: previousSummary, byRule: previousByRule } =
    useSuggestionTelemetrySummary({
      events: previousEvents,
      window: {
        from: previousLifecycleWindow.from,
        to: previousLifecycleWindow.to,
        now: nowRef.current,
      },
    });

  const anomalies = useMemo(
    () =>
      detectSuggestionLifecycleAnomalies({
        currentSummary: summary,
        previousSummary,
        currentByRule: byRule,
        previousByRule,
      }),
    [summary, previousSummary, byRule, previousByRule],
  );
  const weeklyReview = useMemo(
    () =>
      computeWeeklyReviewResult({
        current: {
          dismissRate: summary.rates.dismiss,
          resurfacedRate: summary.rates.resurfaced,
          shownCount: summary.shown,
        },
        previous: {
          dismissRate: previousSummary.rates.dismiss,
          resurfacedRate: previousSummary.rates.resurfaced,
          shownCount: previousSummary.shown,
        },
        anomalies,
      }),
    [summary, previousSummary, anomalies],
  );
  const assessmentStaleReview = useMemo(
    () =>
      computeAssessmentStaleReviewResult({
        currentByRule: byRule,
        previousByRule: previousByRule,
      }),
    [byRule, previousByRule],
  );
  const behaviorTrendReview = useMemo(
    () =>
      computeBehaviorTrendReviewResult({
        currentByRule: byRule,
        previousByRule: previousByRule,
      }),
    [byRule, previousByRule],
  );

  const screenRows: RateRow[] = byScreen.map((row) => ({
    key: row.sourceScreen,
    label: row.sourceScreen === 'today' ? 'today' : 'exception-center',
    shown: row.shown,
    cta: row.rates.cta,
    dismiss: row.rates.dismiss,
    snooze: row.rates.snooze,
    resurfaced: row.rates.resurfaced,
  }));

  const priorityRows: RateRow[] = byPriority.map((row) => ({
    key: row.priority,
    label: row.priority,
    shown: row.shown,
    cta: row.rates.cta,
    dismiss: row.rates.dismiss,
    snooze: row.rates.snooze,
    resurfaced: row.rates.resurfaced,
  }));

  const ruleRows: RateRow[] = byRule.map((row) => ({
    key: row.ruleId,
    label: row.ruleId,
    shown: row.shown,
    cta: row.rates.cta,
    dismiss: row.rates.dismiss,
    snooze: row.rates.snooze,
    resurfaced: row.rates.resurfaced,
  }));

  return (
    <SectionCard>
      <SectionTitle>🧩 Corrective-Action Lifecycle</SectionTitle>

      {isLoading && events.length === 0 && (
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
          lifecycle telemetry を取得中…
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: 8,
            border: '1px solid #fecaca',
            background: '#fef2f2',
          }}
        >
          <div style={{ fontSize: 12, color: '#991b1b', marginBottom: 6 }}>
            corrective-action telemetry の取得に失敗しました。
          </div>
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            再取得
          </button>
        </div>
      )}

      {isEmpty && (
        <EmptyState
          message={`直近${lifecycleWindow.days}日で corrective-action telemetry はまだありません`}
        />
      )}

      {!isEmpty && (
        <>
          <div
            data-testid="suggestion-weekly-review"
            style={{
              marginBottom: 12,
              padding: 10,
              borderRadius: 8,
              border: `1px solid ${weeklyReview.status === 'PASS' ? '#86efac' : '#fecaca'}`,
              background: weeklyReview.status === 'PASS' ? '#f0fdf4' : '#fef2f2',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>
                Weekly Review
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  color: weeklyReview.status === 'PASS' ? '#166534' : '#991b1b',
                  background: weeklyReview.status === 'PASS' ? '#dcfce7' : '#fee2e2',
                }}
              >
                {weeklyReview.status}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 4, fontSize: 12, color: '#475569', marginBottom: 8 }}>
              <div>dismissRate Δ: {formatDeltaPt(weeklyReview.metrics.deltas.dismissRatePt)}</div>
              <div>resurfacedRate Δ: {formatDeltaPt(weeklyReview.metrics.deltas.resurfacedRatePt)}</div>
              <div>
                shown: {summary.shown} / 前期間 {previousSummary.shown}（{Math.round(weeklyReview.metrics.deltas.shownCoverage * 100)}%）
              </div>
            </div>

            <div style={{ display: 'grid', gap: 4 }}>
              {weeklyReview.reasons.map((reason) => (
                <div
                  key={reason}
                  style={{
                    fontSize: 12,
                    color: weeklyReview.status === 'PASS' ? '#166534' : '#991b1b',
                    lineHeight: 1.4,
                  }}
                >
                  - {reason}
                </div>
              ))}
            </div>
          </div>

          <div
            data-testid="suggestion-assessment-stale-review"
            style={{
              marginBottom: 12,
              padding: 10,
              borderRadius: 8,
              border: `1px solid ${
                assessmentStaleReview.status === 'PASS'
                  ? '#86efac'
                  : assessmentStaleReview.status === 'FAIL'
                    ? '#fecaca'
                    : '#cbd5e1'
              }`,
              background:
                assessmentStaleReview.status === 'PASS'
                  ? '#f0fdf4'
                  : assessmentStaleReview.status === 'FAIL'
                    ? '#fef2f2'
                    : '#f8fafc',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>
                assessment-stale Review (#1167)
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  color:
                    assessmentStaleReview.status === 'PASS'
                      ? '#166534'
                      : assessmentStaleReview.status === 'FAIL'
                        ? '#991b1b'
                        : '#334155',
                  background:
                    assessmentStaleReview.status === 'PASS'
                      ? '#dcfce7'
                      : assessmentStaleReview.status === 'FAIL'
                        ? '#fee2e2'
                        : '#e2e8f0',
                }}
              >
                {assessmentStaleReview.status}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 4, fontSize: 12, color: '#475569', marginBottom: 8 }}>
              <div>
                shown: {assessmentStaleReview.current.shown} / 前期間 {assessmentStaleReview.previous.shown}
              </div>
              <div>
                snoozeRate: {formatRate(assessmentStaleReview.previous.snoozeRate)} → {formatRate(assessmentStaleReview.current.snoozeRate)}
                {' '}({formatDeltaPt(assessmentStaleReview.deltas.snoozeRatePt)})
              </div>
              <div>
                resurfacedRate: {formatRate(assessmentStaleReview.previous.resurfacedRate)} → {formatRate(assessmentStaleReview.current.resurfacedRate)}
                {' '}({formatDeltaPt(assessmentStaleReview.deltas.resurfacedRatePt)})
              </div>
            </div>

            <div style={{ display: 'grid', gap: 4 }}>
              {assessmentStaleReview.reasons.map((reason) => (
                <div
                  key={reason}
                  style={{
                    fontSize: 12,
                    color:
                      assessmentStaleReview.status === 'PASS'
                        ? '#166534'
                        : assessmentStaleReview.status === 'FAIL'
                          ? '#991b1b'
                          : '#475569',
                    lineHeight: 1.4,
                  }}
                >
                  - {reason}
                </div>
              ))}
            </div>
          </div>

          <div
            data-testid="suggestion-behavior-trend-review"
            style={{
              marginBottom: 12,
              padding: 10,
              borderRadius: 8,
              border: `1px solid ${
                behaviorTrendReview.status === 'PASS'
                  ? '#86efac'
                  : behaviorTrendReview.status === 'FAIL'
                    ? '#fecaca'
                    : '#cbd5e1'
              }`,
              background:
                behaviorTrendReview.status === 'PASS'
                  ? '#f0fdf4'
                  : behaviorTrendReview.status === 'FAIL'
                    ? '#fef2f2'
                    : '#f8fafc',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>
                behavior-trend Review (#1166)
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  color:
                    behaviorTrendReview.status === 'PASS'
                      ? '#166534'
                      : behaviorTrendReview.status === 'FAIL'
                        ? '#991b1b'
                        : '#334155',
                  background:
                    behaviorTrendReview.status === 'PASS'
                      ? '#dcfce7'
                      : behaviorTrendReview.status === 'FAIL'
                        ? '#fee2e2'
                        : '#e2e8f0',
                }}
              >
                {behaviorTrendReview.status}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 4, fontSize: 12, color: '#475569', marginBottom: 8 }}>
              <div>
                shown: {behaviorTrendReview.current.shown} / 前期間 {behaviorTrendReview.previous.shown}
              </div>
              <div>
                dismissRate: {formatRate(behaviorTrendReview.previous.dismissRate)} → {formatRate(behaviorTrendReview.current.dismissRate)}
                {' '}({formatDeltaPt(behaviorTrendReview.deltas.dismissRatePt)})
              </div>
              <div>
                ctaRate: {formatRate(behaviorTrendReview.previous.ctaRate)} → {formatRate(behaviorTrendReview.current.ctaRate)}
                {' '}({formatDeltaPt(behaviorTrendReview.deltas.ctaRatePt)})
              </div>
            </div>

            <div style={{ display: 'grid', gap: 4 }}>
              {behaviorTrendReview.reasons.map((reason) => (
                <div
                  key={reason}
                  style={{
                    fontSize: 12,
                    color:
                      behaviorTrendReview.status === 'PASS'
                        ? '#166534'
                        : behaviorTrendReview.status === 'FAIL'
                          ? '#991b1b'
                          : '#475569',
                    lineHeight: 1.4,
                  }}
                >
                  - {reason}
                </div>
              ))}
            </div>
          </div>

          {anomalies.length > 0 && (
            <div
              data-testid="suggestion-lifecycle-anomalies"
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 8,
                border: '1px solid #fde68a',
                background: '#fffbeb',
              }}
            >
              <div style={{ fontSize: 12, color: '#92400e', fontWeight: 700, marginBottom: 6 }}>
                anomaly detection: {anomalies.length} 件
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {anomalies.map((anomaly) => (
                  <div
                    key={anomaly.id}
                    style={{
                      fontSize: 12,
                      color: anomaly.severity === 'critical' ? '#991b1b' : '#92400e',
                      lineHeight: 1.45,
                    }}
                  >
                    [{anomaly.type}] {anomaly.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatCard label="shown" count={summary.shown} color="#334155" />
            <StatCard label="clicked" count={summary.clicked} color="#0ea5e9" />
            <StatCard label="dismissed" count={summary.dismissed} color="#ef4444" />
            <StatCard label="snoozed" count={summary.snoozed} color="#f59e0b" />
            <StatCard label="resurfaced" count={summary.resurfaced} color="#8b5cf6" />
          </div>

          <SummaryRowTable title="rule 別" rows={ruleRows} />
          <SummaryRowTable title="sourceScreen 別" rows={screenRows} />
          <SummaryRowTable title="priority 別" rows={priorityRows} />
        </>
      )}
    </SectionCard>
  );
}
