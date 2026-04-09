/**
 * useDailyRecordExceptions — ExceptionCenter 用の日々の記録例外統合 hook
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
  integrityExceptions?: ExceptionItem[];
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
    integrityExceptions = [],
    targetDate,
    maxChildrenPerParent,
  } = options;

  const items = useMemo(() => {
    const missingItems = buildDailyRecordExceptions({
      expectedUsers,
      existingRecords,
      targetDate,
      maxChildrenPerParent,
    });
    
    // 整合性例外と未入力例外を単純結合 (ソートや重複排除は必要に応じて)
    return [...integrityExceptions, ...missingItems];
  }, [expectedUsers, existingRecords, integrityExceptions, targetDate, maxChildrenPerParent]);

  const count = useMemo(
    () => items.filter((item) => Boolean(item.parentId)).length,
    [items],
  );

  return {
    items,
    count,
  };
}
