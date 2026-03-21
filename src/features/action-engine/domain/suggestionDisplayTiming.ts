import type { ActionSuggestion } from './types';

/**
 * 表示タイミングを平日中盤へ寄せたいルール。
 *
 * - `assessment-stale`: 運用レビューでの対象 ruleId
 * - `data-insufficiency`: 既存ルール名（同じ意図の提案）
 */
const MIDWEEK_SHIFT_RULE_IDS = new Set<string>([
  'assessment-stale',
  'data-insufficiency',
]);

/**
 * 表示タイミングポリシーに基づいて提案を表示するかを判定する。
 * 対象ルールのみ Tuesday-Thursday に制限し、週初集中を避ける。
 */
export function isInSuggestionDisplayWindow(
  suggestion: ActionSuggestion,
  now: Date,
): boolean {
  if (!MIDWEEK_SHIFT_RULE_IDS.has(suggestion.ruleId)) return true;
  const day = now.getDay();
  return day >= 2 && day <= 4;
}

/**
 * 表示タイミングポリシーで提案配列をフィルタする。
 */
export function filterSuggestionsByDisplayTiming(
  suggestions: ActionSuggestion[],
  now: Date,
): ActionSuggestion[] {
  return suggestions.filter((suggestion) =>
    isInSuggestionDisplayWindow(suggestion, now),
  );
}

