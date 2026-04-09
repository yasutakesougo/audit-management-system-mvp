import { AcknowledgementState, ExceptionItem, ResolvedState } from './exceptionLogic';

export type TodayExceptionAction = {
  id: string;
  sourceExceptionId: string;
  stableId?: string;
  kind: 'critical-handoff' | 'missing-record' | 'attention-user' | 'setup-incomplete';
  priority: 'high' | 'critical';
  title: string;
  description: string;
  actionLabel: string;
  actionPath: string;
  /** セカンダリアクション（例: 支援記録の確認リンク） */
  secondaryActionLabel?: string;
  secondaryActionPath?: string;
  userId?: string;
  date?: string;
  ownerRole?: 'admin' | 'manager' | 'staff';
  /** ADR-019: 対応着手の状態。dismiss とは別概念（個人的非表示 vs チームへの意思表示） */
  acknowledgement?: AcknowledgementState;
};

export type BuildTodayExceptionsOptions = {
  dismissedStableIds?: Set<string>;
  snoozedStableIds?: Set<string>;
  /** ADR-019: stableId → acknowledgement 状態のマップ */
  acknowledgedMap?: Record<string, AcknowledgementState>;
  /** ADR-019: stableId → resolved 状態のマップ。resolved はアクティブリストから除外される */
  resolvedMap?: Record<string, ResolvedState>;
};

const CATEGORY_ORDER: Record<string, number> = {
  'setup-incomplete': 0, // 最優先
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
    acknowledgedMap = {},
    resolvedMap = {},
  } = options;

  const actions: TodayExceptionAction[] = [];

  for (const item of items) {
    // 1. dismiss / snooze / resolved の除外
    // resolved は「意図的な完了」としてアクティブリストから除外（dismiss と意味は異なるが動作は同じ）
    const effectiveStableId = item.stableId ?? item.id;
    if (dismissedStableIds.has(effectiveStableId)) continue;
    if (snoozedStableIds.has(effectiveStableId)) continue;
    if (resolvedMap[effectiveStableId]) continue;

    // 2. actionPath がないものは原則除外
    if (!item.actionPath) continue;

    // 3. カテゴリと priority の条件判定
    const isCriticalHandoff = item.category === 'critical-handoff';
    const isMissingRecord = item.category === 'missing-record';
    const isAttentionUser = item.category === 'attention-user';
    const isSetupIncomplete = item.category === 'setup-incomplete';

    if (!isCriticalHandoff && !isMissingRecord && !isAttentionUser && !isSetupIncomplete) {
      continue;
    }

    const priority = item.severity === 'critical' ? 'critical' : item.severity === 'high' ? 'high' : null;

    // critical-handoff、setup-incomplete は常に対象（とはいえ priority がセットされる前提）。
    // missing-record と attention-user は priority が high 以上のみ対象。
    if (!isCriticalHandoff && !isSetupIncomplete && !priority) {
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
      secondaryActionLabel: item.secondaryActionLabel,
      secondaryActionPath: item.secondaryActionPath,
      userId: item.targetUserId,
      date: item.targetDate ?? item.updatedAt,
      stableId: effectiveStableId,
      ownerRole: item.ownerRole,
      acknowledgement: acknowledgedMap[effectiveStableId],
    });
  }

  // 4. ソート: priority (critical -> high) -> acknowledged（未着手優先） -> カテゴリ順 -> 日付(近い順=新しい順)
  // acknowledged は同一 priority 群の末尾へ。完全非表示にはしない（チームへの可視性を維持）。
  actions.sort((a, b) => {
    // Priority order
    const pA = PRIORITY_ORDER[a.priority] ?? 99;
    const pB = PRIORITY_ORDER[b.priority] ?? 99;
    if (pA !== pB) return pA - pB;

    // Acknowledged items sink within the same priority group
    const ackA = a.acknowledgement ? 1 : 0;
    const ackB = b.acknowledgement ? 1 : 0;
    if (ackA !== ackB) return ackA - ackB;

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
