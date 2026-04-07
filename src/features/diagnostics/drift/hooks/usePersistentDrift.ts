import React from 'react';

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

  const fetchSummary = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // ユーザー推奨の (a) runtime-summary.json を API/Fetch 経由で取得
      // ローカルJSONの取得のため、SP認証不要の window.fetch を使用
      const res = await window.fetch('/.nightly/runtime-summary.json');
      if (!res.ok) {
        // ファイルがない場合は単にデータなしとして扱う（新環境など）
        setPersistentDrifts([]);
        return;
      }
      const data = (await res.json()) as NightlySummary;
      const drifts = (data.fieldSkipStreaks ?? []).filter(
        (s) => s.status === 'persistent_drift'
      );
      setPersistentDrifts(drifts);
    } catch (err) {
      console.warn('Failed to fetch persistent drift summary:', err);
      // Fail-soft: 取得失敗で UI を壊さない
      setError('履歴データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

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
