import { ExceptionItem } from './exceptionLogic';

export type TodayExceptionAction = {
  id: string;
  sourceExceptionId: string;
  stableId?: string;
  kind: 'critical-handoff' | 'missing-record' | 'attention-user';
  priority: 'high' | 'critical';
  title: string;
  description: string;
  actionLabel: string;
  actionPath: string;
  userId?: string;
  date?: string;
};

export type BuildTodayExceptionsOptions = {
  dismissedStableIds?: Set<string>;
  snoozedStableIds?: Set<string>;
};

const CATEGORY_ORDER: Record<string, number> = {
  'critical-handoff': 1,
  'missing-record': 2,
  'attention-user': 3,
};

const PRIORITY_ORDER: Record<string, number> = {
  critical: 1,
  high: 2,
};

/**
 * ExceptionCenter の例外から、Today に「今日やること」として返すタスクを抽出する純粋関数。
 * - snooze / dismiss されたものは除外
 * - critical-handoff、および high 以上の missing-record / attention-user のみ対象
 * - priority (critical -> high) およびカテゴリ順でソート
 */
export function buildTodayExceptions(
  items: ExceptionItem[],
  options: BuildTodayExceptionsOptions = {},
): TodayExceptionAction[] {
  const {
    dismissedStableIds = new Set<string>(),
    snoozedStableIds = new Set<string>(),
  } = options;

  const actions: TodayExceptionAction[] = [];

  for (const item of items) {
    // 1. dismiss / snooze の除外
    const effectiveStableId = item.stableId ?? item.id;
    if (dismissedStableIds.has(effectiveStableId)) continue;
    if (snoozedStableIds.has(effectiveStableId)) continue;

    // 2. actionPath がないものは原則除外
    if (!item.actionPath) continue;

    // 3. カテゴリと priority の条件判定
    const isCriticalHandoff = item.category === 'critical-handoff';
    const isMissingRecord = item.category === 'missing-record';
    const isAttentionUser = item.category === 'attention-user';

    if (!isCriticalHandoff && !isMissingRecord && !isAttentionUser) {
      continue;
    }

    const priority = item.severity === 'critical' ? 'critical' : item.severity === 'high' ? 'high' : null;

    // critical-handoff は常に対象（とはいえ priority がセットされる前提）。
    // missing-record と attention-user は priority が high 以上のみ対象。
    if (!isCriticalHandoff && !priority) {
      continue;
    }

    // fallback priority for critical-handoff if severity is missing (should not happen practically)
    const finalPriority = priority ?? 'high';

    actions.push({
      id: `today-action-${item.id}`,
      sourceExceptionId: item.id,
      kind: item.category as TodayExceptionAction['kind'],
      priority: finalPriority,
      title: item.title,
      description: item.description,
      actionLabel: item.actionLabel ?? '詳細を確認',
      actionPath: item.actionPath,
      userId: item.targetUserId,
      date: item.targetDate ?? item.updatedAt,
      stableId: effectiveStableId,
    });
  }

  // 4. ソート: priority (critical -> high) -> カテゴリ順 -> 日付(近い順=新しい順)
  actions.sort((a, b) => {
    // Priority order
    const pA = PRIORITY_ORDER[a.priority] ?? 99;
    const pB = PRIORITY_ORDER[b.priority] ?? 99;
    if (pA !== pB) return pA - pB;

    // Category order
    const cA = CATEGORY_ORDER[a.kind] ?? 99;
    const cB = CATEGORY_ORDER[b.kind] ?? 99;
    if (cA !== cB) return cA - cB;

    // Date fallback (降順)
    const dA = a.date ? new Date(a.date).getTime() : 0;
    const dB = b.date ? new Date(b.date).getTime() : 0;
    return dB - dA;
  });

  return actions;
}
