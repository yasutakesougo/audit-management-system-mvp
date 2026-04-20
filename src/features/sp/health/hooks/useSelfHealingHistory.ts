import React from 'react';
import { useSP } from '@/lib/spClient';
import { getLatestDiagnosticsReports } from '@/sharepoint/diagnosticsReports';
import { 
  SelfHealingHistoryEntry, 
  SelfHealingAggregate, 
  normalizeReportToHistoryEntry, 
  aggregateHistory 
} from './selfHealingNormalization';
import { SelfHealingAction, generateRemediationActions } from './selfHealingActionRules';

export function useSelfHealingHistory(limit: number = 10) {
  const sp = useSP();
  const [history, setHistory] = React.useState<SelfHealingHistoryEntry[]>([]);
  const [aggregates, setAggregates] = React.useState<SelfHealingAggregate[]>([]);
  const [actions, setActions] = React.useState<SelfHealingAction[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!sp) return;

    let cancelled = false;
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const reports = await getLatestDiagnosticsReports(sp, 'runtime-summary', limit);
        if (cancelled) return;

        const entries = reports.map(normalizeReportToHistoryEntry);
        const aggs = aggregateHistory(entries);
        const remediationActions = generateRemediationActions(aggs);

        setHistory(entries);
        setAggregates(aggs);
        setActions(remediationActions);
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

    fetchHistory();
    return () => { cancelled = true; };
  }, [sp, limit]);

  return { history, aggregates, actions, loading, error };
}
