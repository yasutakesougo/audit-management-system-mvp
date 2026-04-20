import React from 'react';
import { useSP } from '@/lib/spClient';
import { getLatestDiagnosticsReport } from '@/sharepoint/diagnosticsReports';

export interface SelfHealingResult {
  resourceKey: string;
  fieldKey?: string;
  outcome: 'added' | 'failed' | 'skipped_limit' | 'unknown';
  message: string;
  occurredAt: string;
}

interface NightlyEvent {
  eventType: string;
  resourceKey: string;
  fieldKey?: string;
  sampleMessage: string;
  lastSeen?: string;
}

export function useSelfHealingResults() {
  const sp = useSP();
  const [results, setResults] = React.useState<SelfHealingResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasReport, setHasReport] = React.useState(false);

  React.useEffect(() => {
    if (!sp) return;

    let cancelled = false;
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        // 'runtime-summary' を明示的に指定して取得
        const report = await getLatestDiagnosticsReport(sp, 'runtime-summary');
        if (cancelled) return;

        if (report) {
          setHasReport(true);
        }

        if (report?.SummaryText) {
          try {
            const summary = JSON.parse(report.SummaryText) as { events?: NightlyEvent[] };
            // eventType === 'remediation' のイベントを抽出
            const remediationEvents = (summary.events || [])
              .filter((e) => e.eventType === 'remediation')
              .map((e) => {
                // message から結果を類推
                let outcome: SelfHealingResult['outcome'] = 'unknown';
                const msg = (e.sampleMessage || '').toLowerCase();
                if (msg.includes('成功') || msg.includes('success')) {
                  outcome = 'added';
                } else if (msg.includes('失敗') || msg.includes('fail')) {
                  outcome = 'failed';
                } else if (msg.includes('上限') || msg.includes('limit')) {
                  outcome = 'skipped_limit';
                }

                return {
                  resourceKey: e.resourceKey,
                  fieldKey: e.fieldKey,
                  outcome,
                  message: e.sampleMessage,
                  occurredAt: e.lastSeen || report.Modified || report.Created,
                };
              });

            setResults(remediationEvents);
          } catch (e) {
            console.warn('[useSelfHealingResults] Failed to parse SummaryText', e);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchResults();
    return () => { cancelled = true; };
  }, [sp]);

  return { results, loading, error, hasReport };
}
