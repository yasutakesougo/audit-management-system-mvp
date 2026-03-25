/**
 * useHandoffExceptions — ExceptionCenter 用の handoff 例外統合 hook
 *
 * useExceptionDataSources が提供する重要申し送りサマリーを
 * parent + child 形式の ExceptionItem に変換する。
 */

import { useMemo } from 'react';
import { buildHandoffExceptions } from '@/features/exceptions/domain/buildHandoffExceptions';
import type { HandoffSummaryItem, ExceptionItem } from '@/features/exceptions/domain/exceptionLogic';
import { useUsers } from '@/features/users/useUsers';

export interface UseHandoffExceptionsOptions {
  handoffs: HandoffSummaryItem[];
  maxChildrenPerUser?: number;
}

export interface UseHandoffExceptionsReturn {
  items: ExceptionItem[];
  count: number;
}

export function useHandoffExceptions(
  options: UseHandoffExceptionsOptions,
): UseHandoffExceptionsReturn {
  const { handoffs, maxChildrenPerUser } = options;
  const { data: users } = useUsers();

  const userNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const user of users) {
      if (user.UserID && user.FullName) {
        map[user.UserID] = user.FullName;
      }
    }
    return map;
  }, [users]);

  const items = useMemo(() => {
    return buildHandoffExceptions({
      handoffs,
      maxChildrenPerUser,
      userNames,
    });
  }, [handoffs, maxChildrenPerUser, userNames]);

  const count = useMemo(
    () => items.filter((item) => Boolean(item.parentId)).length,
    [items],
  );

  return {
    items,
    count,
  };
}
