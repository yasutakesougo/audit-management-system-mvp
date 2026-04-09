import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useExceptionDataSources } from '@/features/exceptions/hooks/useExceptionDataSources';
import {
  detectMissingRecords,
  detectMissingSupportLogs,
  detectCriticalHandoffs,
  detectAttentionUsers,
  detectAnalysisSetupExceptions,
  detectTransportSetupExceptions,
  aggregateExceptions,
} from '@/features/exceptions/domain/exceptionLogic';
import {
  buildTodayExceptions,
  type TodayExceptionAction,
} from '@/features/exceptions/domain/buildTodayExceptions';
import { useActiveExceptionPreferences } from '@/features/exceptions/hooks/useExceptionPreferences';
import { rankTodayExceptionActionsByPriority } from '@/features/today/domain/selectTopExceptionAttentionCandidate';

export type UseTodayExceptionsOptions = {
  /** 支援手順記録が未入力のユーザー一覧（todayRecordCompletion から取得） */
  pendingSupportUsers?: Array<{ userId: string; userName: string }>;
  role?: string;
};

export type UseTodayExceptionsResult = {
  items: TodayExceptionAction[];
  topPriorityItem: TodayExceptionAction | null;
  heroItem: TodayExceptionAction | null;
  queueItems: TodayExceptionAction[];
  isLoading: boolean;
  error: string | null;
  /** 保存後に司令塔アラートを再同期する */
  refetchDailyRecords: () => void;
};

/**
 * ExceptionCenter のデータソースフックを呼び出し、Today 向けの表示モデルに変換する。
 * Today は ExceptionCenter の Consumer として振る舞う。
 */
export function useTodayExceptions(
  options: UseTodayExceptionsOptions = {},
): UseTodayExceptionsResult {
  const { pendingSupportUsers = [], role } = options;
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const dataSources = useExceptionDataSources();
  const { dismissedStableIds, snoozedStableIds, acknowledgedMap, resolvedMap } = useActiveExceptionPreferences();

  const exceptions = useMemo(() => {
    const isDemoMode = searchParams.get('demo') === '1';
    const isAdminSession = role === 'admin';

    // まだ準備ができていない場合は計算しない
    if (dataSources.status !== 'ready' && dataSources.status !== 'empty') {
      return [];
    }

    const missingRecords = detectMissingRecords({
      expectedUsers: dataSources.expectedUsers,
      existingRecords: dataSources.todayRecords,
      targetDate: dataSources.today,
    });

    const missingSupportLogs = detectMissingSupportLogs({
      pendingUsers: pendingSupportUsers,
      targetDate: dataSources.today,
    });

    const criticalHandoffs = detectCriticalHandoffs(dataSources.criticalHandoffs);
    const attentionUsers = detectAttentionUsers(dataSources.userSummaries);

    const setupIncomplete = (isDemoMode || !isAdminSession)
      ? []
      : detectAnalysisSetupExceptions(dataSources.userSummaries);
    const transportSetup = (isDemoMode || !isAdminSession)
      ? []
      : detectTransportSetupExceptions(dataSources.userSummaries);

    return aggregateExceptions(missingRecords, missingSupportLogs, criticalHandoffs, attentionUsers, setupIncomplete, transportSetup);
  }, [dataSources, pendingSupportUsers, searchParams, role]);

  const items = useMemo(() => {
    const raw = buildTodayExceptions(exceptions, {
      dismissedStableIds,
      snoozedStableIds,
      acknowledgedMap,
      resolvedMap,
    });

    // ユーザー単位でマージ: 同一ユーザーの missing-record(ケース記録) と
    // missing-support(支援手順記録) を 1アイテムに統合する。
    // 支援手順記録のアクションは secondaryAction として付与。
    const merged: TodayExceptionAction[] = [];
    const userMergeMap = new Map<string, TodayExceptionAction>();

    for (const item of raw) {
      if (!item.userId) {
        merged.push(item);
        continue;
      }

      const isCaseRecord = item.id.startsWith('today-action-missing-') && !item.id.includes('-support-');
      const isSupportRecord = item.id.includes('-support-');

      if (isCaseRecord) {
        // ケース記録 → primary。まずマップに登録。
        const existing = userMergeMap.get(item.userId);
        if (existing) {
          // 既にsupport が先に来ていた場合（順序は保証されないので念のため）
          existing.actionLabel = item.actionLabel;
          existing.actionPath = item.actionPath;
          existing.title = `${item.title.replace(/のケース記録が未入力/, '')}の記録が未入力`;
        } else {
          const clone = { ...item, title: item.title.replace(/のケース記録が未入力/, 'の記録が未入力') };
          userMergeMap.set(item.userId, clone);
          merged.push(clone);
        }
      } else if (isSupportRecord) {
        // 支援手順記録 → secondary
        const existing = userMergeMap.get(item.userId);
        if (existing) {
          existing.secondaryActionLabel = item.actionLabel;
          existing.secondaryActionPath = item.actionPath;
        } else {
          // support が先に来た場合。primary として登録し、後でcaseが来たらマージ。
          const clone = {
            ...item,
            title: item.title.replace(/の支援手順記録が未入力/, 'の記録が未入力'),
            secondaryActionLabel: item.actionLabel,
            secondaryActionPath: item.actionPath,
          };
          userMergeMap.set(item.userId, clone);
          merged.push(clone);
        }
      } else {
        merged.push(item);
      }
    }

    return merged;
  }, [exceptions, dismissedStableIds, snoozedStableIds, acknowledgedMap, resolvedMap]);

  const { orderedItems, topPriorityItem } = useMemo(() => {
    const ranked = rankTodayExceptionActionsByPriority({
      actions: items,
      sourceExceptions: exceptions,
    });
    if (ranked.length === 0) {
      return {
        orderedItems: items,
        topPriorityItem: items[0] ?? null,
      };
    }

    return {
      orderedItems: ranked.map((entry) => entry.action),
      topPriorityItem: ranked[0]?.action ?? null,
    };
  }, [exceptions, items]);

  const { heroItem, queueItems } = useMemo(() => {
    // critical が1件でもあれば Hero に昇格。なければ null (通常のProgressHeroを出す)
    const hero = orderedItems.find((i) => i.priority === 'critical') ?? null;

    // Hero で表示するものを除いて、最大3件を補助カードへ出力
    const remaining = orderedItems.filter((i) => i.id !== hero?.id);
    const queue = remaining.slice(0, 3);

    return { heroItem: hero, queueItems: queue };
  }, [orderedItems]);

  return useMemo(
    () => ({
      items,
      topPriorityItem,
      heroItem,
      queueItems,
      isLoading: dataSources.status === 'loading',
      error: dataSources.error,
      refetchDailyRecords: dataSources.refetchDailyRecords,
    }),
    [
      items,
      topPriorityItem,
      heroItem,
      queueItems,
      dataSources.status,
      dataSources.error,
      dataSources.refetchDailyRecords,
    ],
  );
}
