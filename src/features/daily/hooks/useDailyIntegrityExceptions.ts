import { useEffect, useMemo, useState } from 'react';
import type { ExceptionItem } from '@/features/exceptions/domain/exceptionLogic';
import { useDailyRecordRepository } from '@/features/daily/repositoryFactory';
import { mapIntegrityToExceptionItem } from '@/features/daily/domain/integrity/dailyIntegrityChecker';

/**
 * useDailyIntegrityExceptions
 * 
 * 指定された日付範囲の日次記録の整合性をスキャンし、
 * 不整合があれば ExceptionItem[] として返却する。
 */
export function useDailyIntegrityExceptions(targetDate: string) {
  const repository = useDailyRecordRepository();
  const [items, setItems] = useState<ExceptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();

    async function scan() {
      setIsLoading(true);
      setError(null);
      try {
        // 現在は targetDate の当日のみをスキャン対象とする
        // (将来的に過去n日間への拡張も可能)
        const exceptions = await repository.scanIntegrity([targetDate], controller.signal);
        
        if (!aborted) {
          const mapped = exceptions.map(mapIntegrityToExceptionItem);
          setItems(mapped);
        }
      } catch (err) {
        if (!aborted) {
          console.error('[useDailyIntegrityExceptions] Scan failed:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!aborted) {
          setIsLoading(false);
        }
      }
    }

    scan();

    return () => {
      aborted = true;
      controller.abort();
    };
  }, [repository, targetDate]);

  return useMemo(
    () => ({
      items,
      isLoading,
      error,
    }),
    [items, isLoading, error],
  );
}
