import { useMemo } from 'react';
import { useExceptionDataSources } from '@/features/exceptions/hooks/useExceptionDataSources';
import {
  detectMissingRecords,
  detectCriticalHandoffs,
  detectAttentionUsers,
  aggregateExceptions,
} from '@/features/exceptions/domain/exceptionLogic';
import {
  buildTodayExceptions,
  type TodayExceptionAction,
} from '@/features/exceptions/domain/buildTodayExceptions';
import { useActiveExceptionPreferences } from '@/features/exceptions/hooks/useExceptionPreferences';

export type UseTodayExceptionsResult = {
  items: TodayExceptionAction[];
  heroItem: TodayExceptionAction | null;
  queueItems: TodayExceptionAction[];
  isLoading: boolean;
  error: string | null;
};

/**
 * ExceptionCenter のデータソースフックを呼び出し、Today 向けの表示モデルに変換する。
 * Today は ExceptionCenter の Consumer として振る舞う。
 */
export function useTodayExceptions(): UseTodayExceptionsResult {
  const dataSources = useExceptionDataSources();
  const { dismissedStableIds, snoozedStableIds } = useActiveExceptionPreferences();

  const exceptions = useMemo(() => {
    // まだ準備ができていない場合は計算しない
    if (dataSources.status !== 'ready' && dataSources.status !== 'empty') {
      return [];
    }

    const missingRecords = detectMissingRecords({
      expectedUsers: dataSources.expectedUsers,
      existingRecords: dataSources.todayRecords,
      targetDate: dataSources.today,
    });

    const criticalHandoffs = detectCriticalHandoffs(dataSources.criticalHandoffs);
    const attentionUsers = detectAttentionUsers(dataSources.userSummaries);

    return aggregateExceptions(missingRecords, criticalHandoffs, attentionUsers);
  }, [dataSources]);

  const items = useMemo(() => {
    return buildTodayExceptions(exceptions, {
      dismissedStableIds,
      snoozedStableIds,
    });
  }, [exceptions, dismissedStableIds, snoozedStableIds]);

  const { heroItem, queueItems } = useMemo(() => {
    // critical が1件でもあれば Hero に昇格。なければ null (通常のProgressHeroを出す)
    const hero = items.find((i) => i.priority === 'critical') ?? null;
    
    // Hero で表示するものを除いて、最大3件を補助カードへ出力
    const remaining = items.filter((i) => i.id !== hero?.id);
    const queue = remaining.slice(0, 3);

    return { heroItem: hero, queueItems: queue };
  }, [items]);

  return useMemo(
    () => ({
      items,
      heroItem,
      queueItems,
      isLoading: dataSources.status === 'loading',
      error: dataSources.error,
    }),
    [items, heroItem, queueItems, dataSources.status, dataSources.error]
  );
}
