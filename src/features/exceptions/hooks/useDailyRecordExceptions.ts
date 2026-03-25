/**
 * useDailyRecordExceptions — ExceptionCenter 用の日次記録例外統合 hook
 *
 * useExceptionDataSources が提供する expectedUsers/todayRecords を
 * parent + child 形式の ExceptionItem に変換する。
 */

import { useMemo } from 'react';
import type { DailyRecordSummary, ExceptionItem } from '@/features/exceptions/domain/exceptionLogic';
import { buildDailyRecordExceptions } from '@/features/exceptions/domain/buildDailyRecordExceptions';

export interface UseDailyRecordExceptionsOptions {
  expectedUsers: Array<{ userId: string; userName: string }>;
  existingRecords: DailyRecordSummary[];
  targetDate: string;
  maxChildrenPerParent?: number;
}

export interface UseDailyRecordExceptionsReturn {
  items: ExceptionItem[];
  count: number;
}

export function useDailyRecordExceptions(
  options: UseDailyRecordExceptionsOptions,
): UseDailyRecordExceptionsReturn {
  const {
    expectedUsers,
    existingRecords,
    targetDate,
    maxChildrenPerParent,
  } = options;

  const items = useMemo(() => {
    return buildDailyRecordExceptions({
      expectedUsers,
      existingRecords,
      targetDate,
      maxChildrenPerParent,
    });
  }, [expectedUsers, existingRecords, targetDate, maxChildrenPerParent]);

  const count = useMemo(
    () => items.filter((item) => Boolean(item.parentId)).length,
    [items],
  );

  return {
    items,
    count,
  };
}
