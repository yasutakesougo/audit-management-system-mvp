/**
 * useServiceProvisionList — 日次一覧取得 Hook
 *
 * 指定日のサービス提供実績を取得し、リアクティブに保持する。
 * 保存後の自動リフレッシュにも対応。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ServiceProvisionRecord } from './domain/types';
import { useServiceProvisionRepository } from './repositoryFactory';

export interface UseServiceProvisionListReturn {
  records: ServiceProvisionRecord[];
  loading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
}

export function useServiceProvisionList(
  recordDateISO: string,
): UseServiceProvisionListReturn {
  const repository = useServiceProvisionRepository();
  const [records, setRecords] = useState<ServiceProvisionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // 日付が変わったときの重複フェッチ防止
  const abortRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!recordDateISO) {
      setRecords([]);
      return;
    }

    setLoading(true);
    setError(null);
    abortRef.current = false;

    try {
      const result = await repository.listByDate(recordDateISO);
      if (!abortRef.current) {
        setRecords(result);
      }
    } catch (err) {
      if (!abortRef.current) {
        console.error('[useServiceProvisionList] fetch failed', err);
        setError(err);
      }
    } finally {
      if (!abortRef.current) {
        setLoading(false);
      }
    }
  }, [repository, recordDateISO]);

  useEffect(() => {
    refresh();
    return () => {
      abortRef.current = true;
    };
  }, [refresh]);

  return { records, loading, error, refresh };
}
