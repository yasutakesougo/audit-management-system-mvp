import { ExceptionItem } from './exceptionLogic';

/**
 * 渡された ExceptionItem の一覧から、dismissed / snoozed されたものを除外する純粋関数。
 * 状態 (preferences) の owner は Exception Center / Today に依存せず、判定ロジックだけを提供する。
 */
export function applyExceptionPreferences(
  items: ExceptionItem[],
  dismissedStableIds: Set<string>,
  snoozedStableIds: Set<string>,
): ExceptionItem[] {
  return items.filter((item) => {
    const effectiveStableId = item.stableId ?? item.id;
    if (dismissedStableIds.has(effectiveStableId)) return false;
    if (snoozedStableIds.has(effectiveStableId)) return false;
    return true;
  });
}
