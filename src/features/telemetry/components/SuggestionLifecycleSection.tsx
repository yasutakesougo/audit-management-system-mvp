import { useMemo, useRef } from 'react';
import {
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
