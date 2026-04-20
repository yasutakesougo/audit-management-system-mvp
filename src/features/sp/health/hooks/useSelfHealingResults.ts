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

export interface NightlyEvent {
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
          const { normalizeReportToHistoryEntry } = await import('./selfHealingNormalization');
          const entry = normalizeReportToHistoryEntry(report);
          setResults(entry.events);
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
