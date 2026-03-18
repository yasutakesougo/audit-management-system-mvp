import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ActionCard, RawActionSource } from '../domain/models/queue.types';
import { buildTodayActionQueue } from '../domain/engine/buildTodayActionQueue';
import { fetchMockActionSources } from '../domain/repositories/mockActionSources';

interface UseTodayActionQueueOptions {
  pollingIntervalMs?: number;
  currentStaffId?: string;
}

interface UseTodayActionQueueReturn {
  actionQueue: ActionCard[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useTodayActionQueue(
  options: UseTodayActionQueueOptions = {}
): UseTodayActionQueueReturn {
  const { pollingIntervalMs = 60000, currentStaffId = 'staff-a' } = options;

  // 1. 状態管理
  const [now, setNow] = useState(new Date());
  const [sources, setSources] = useState<RawActionSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 2. 時刻のTick（再評価のトリガー）
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, pollingIntervalMs);
    return () => clearInterval(timer);
  }, [pollingIntervalMs]);

  // 3. データのフェッチ（擬似APIコール）
  const refresh = useCallback(() => {
    setIsLoading(true);
    setError(null);
    try {
      // 実際は Promise.all 等で SWR / React Query 経由で取得する
      // MVPのため一時的に同期モックを利用
      const data = fetchMockActionSources(new Date());
      setSources(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch sources'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初回マウント時にフェッチ
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 4. Engineへの結合（純粋関数の呼び出し）
  // 今の時刻 (now) またはデータ (sources) が変わるたびに再計算される
  const actionQueue = useMemo(() => {
    if (sources.length === 0) return [];
    return buildTodayActionQueue(sources, now, currentStaffId);
  }, [sources, now, currentStaffId]);

  return {
    actionQueue,
    isLoading,
    error,
    refresh,
  };
}
