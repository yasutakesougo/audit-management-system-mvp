import React from 'react';
import { useSP } from '@/lib/spClient';

export interface FieldSkipStreakResult {
  reasonKey: string;
  streak: number;
  status: 'watching' | 'persistent_drift';
}

export interface NightlySummary {
  reportDate: string;
  fieldSkipStreaks?: FieldSkipStreakResult[];
}

export function usePersistentDrift() {
  const [persistentDrifts, setPersistentDrifts] = React.useState<FieldSkipStreakResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { spFetch } = useSP();

  const fetchSummary = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. SharePoint の Diagnostics_Reports リストから Title='runtime-summary' の最新レコードを取得
      const siteUrl = `/lists/getbytitle('Diagnostics_Reports')/items?$filter=Title eq 'runtime-summary'&$orderby=Created desc&$top=1`;
      const res = await spFetch(siteUrl);
      
      if (!res.ok) {
        setPersistentDrifts([]);
        return;
      }

      const payload = (await res.json()) as { value: { SummaryText: string }[] };
      if (payload.value.length === 0) {
        setPersistentDrifts([]);
        return;
      }

      // 2. SummaryText (PayloadJson) をシリアライズしてパース
      const rawJson = payload.value[0].SummaryText;
      const data = JSON.parse(rawJson) as NightlySummary;
      
      const drifts = (data.fieldSkipStreaks ?? []).filter(
        (s) => s.status === 'persistent_drift'
      );
      setPersistentDrifts(drifts);
    } catch (err) {
      console.warn('Failed to fetch persistent drift summary from SP:', err);
      setError('履歴データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [spFetch]);

  React.useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    persistentDrifts,
    loading,
    error,
    refresh: fetchSummary,
  };
}
