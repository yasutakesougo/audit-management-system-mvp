import React from 'react';
import { useDriftEventRepository } from '../../drift/infra/driftEventRepositoryFactory';

export interface SilentDriftSummary {
  totalCount: number;
  listCount: number;
  topLists: { name: string; count: number }[];
  isIncreasing: boolean;
  loading: boolean;
  error: string | null;
}

export function useSilentDriftSummary(): SilentDriftSummary {
  const repository = useDriftEventRepository();
  const [data, setData] = React.useState<Omit<SilentDriftSummary, 'loading' | 'error'>>({
    totalCount: 0,
    listCount: 0,
    topLists: [],
    isIncreasing: false,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // 直近7日分を取得
        const since = new Date();
        since.setDate(since.getDate() - 7);
        
        const events = await repository.getEvents({ 
          since: since.toISOString(),
          resolved: false 
        });

        if (!mounted) return;

        // silent のみ抽出
        const silentEvents = events.filter(e => e.severity === 'silent');
        
        if (silentEvents.length === 0) {
          setData({
            totalCount: 0,
            listCount: 0,
            topLists: [],
            isIncreasing: false,
          });
          return;
        }

        // 集計
        const listMap = new Map<string, number>();
        silentEvents.forEach(e => {
          listMap.set(e.listName, (listMap.get(e.listName) || 0) + 1);
        });

        const topLists = Array.from(listMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // 傾向（前半3.5日 vs 後半3.5日）
        const midPoint = since.getTime() + (new Date().getTime() - since.getTime()) / 2;
        const recentCount = silentEvents.filter(e => new Date(e.detectedAt).getTime() > midPoint).length;
        const olderCount = silentEvents.length - recentCount;
        const isIncreasing = recentCount > olderCount;

        setData({
          totalCount: silentEvents.length,
          listCount: listMap.size,
          topLists,
          isIncreasing,
        });

      } catch (err) {
        if (!mounted) return;
        // Fail-Open: 読み取り失敗は警告表示にするがアプリを壊さない
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();
    return () => { mounted = false; };
  }, [repository]);

  return { ...data, loading, error };
}
