import { useMemo, useState, useEffect } from 'react';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { useProcedureStore } from '@/features/daily/stores/procedureStore';
import { aggregateKioskRecords, buildKioskInsightText, type KioskMonitoringSummary } from '../domain/monitoringKioskAnalytics';

/**
 * キオスク記録の集計結果を提供する Hook
 * @param userId 対象ユーザーID
 * @param lookbackDays 遡り日数 (default: 90)
 */
export function useMonitoringKioskAnalytics(userId: string, lookbackDays = 90) {
  const { getRecordsInRange } = useExecutionData();
  const { getProcedureById } = useProcedureStore();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<KioskMonitoringSummary | null>(null);

  useEffect(() => {
    if (!userId) {
      setSummary(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - lookbackDays);
    
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    getRecordsInRange(userId, fromStr, toStr).then(records => {
      if (!isMounted) return;

      // 手順名の解決
      const procedureNames: Record<string, string> = {};
      const uniqueSids = Array.from(new Set(records.map(r => r.scheduleItemId)));
      
      uniqueSids.forEach(sid => {
        const proc = getProcedureById(sid);
        if (proc) {
          procedureNames[sid] = proc.activity;
        }
      });

      const aggregated = aggregateKioskRecords(records, {
        userId,
        from: fromStr,
        to: toStr,
        procedureNames,
      });
      
      setSummary(aggregated);
      setLoading(false);
    }).catch(err => {
      console.error('[useMonitoringKioskAnalytics] failed:', err);
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [userId, lookbackDays, getRecordsInRange, getProcedureById]);

  const insightLines = useMemo(() => {
    if (!summary) return [];
    return buildKioskInsightText(summary);
  }, [summary]);

  return { summary, insightLines, loading };
}
