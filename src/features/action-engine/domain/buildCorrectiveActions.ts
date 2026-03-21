// ---------------------------------------------------------------------------
// buildCorrectiveActions — ルール合成エンジン
//
// 6 つの検出ルールを実行し、dedupe + 優先度ソート + 上限制限を経て返す。
// 純粋関数のため、テスト・再現性が保証される。
// ---------------------------------------------------------------------------

import type { ActionSuggestion, CorrectiveActionInput } from './types';
import { dedupeKey, MAX_SUGGESTIONS_PER_USER } from './types';
import { detectBehaviorTrend } from './rules/behaviorTrendRule';
import { detectLowExecutionRate } from './rules/executionRateRule';
import { detectHighIntensityCluster } from './rules/highIntensityRule';
import { detectTimeConcentration } from './rules/timeConcentrationRule';
import { detectMissingBip } from './rules/missingBipRule';
import { detectDataInsufficiency } from './rules/dataCollectionRule';

/** 優先度の数値化（ソート用） */
const PRIORITY_ORDER: Record<string, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
};

/** 全検出ルール一覧 */
const ALL_RULES = [
  detectBehaviorTrend,
  detectLowExecutionRate,
  detectHighIntensityCluster,
  detectTimeConcentration,
  detectMissingBip,
  detectDataInsufficiency,
] as const;

/**
 * 同一ユーザー + 同一 CTA 先の重複を除去。
 * 同一キーが複数ある場合、最も高い優先度の提案を残す。
 */
function deduplicateSuggestions(suggestions: ActionSuggestion[]): ActionSuggestion[] {
  const seen = new Map<string, ActionSuggestion>();

  for (const s of suggestions) {
    const key = dedupeKey(s);
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, s);
    } else {
      // 高い優先度（小さい数値）を保持
      const existingOrder = PRIORITY_ORDER[existing.priority] ?? 99;
      const currentOrder = PRIORITY_ORDER[s.priority] ?? 99;
      if (currentOrder < existingOrder) {
        seen.set(key, s);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * 分析結果から修正提案を自動生成する。
 *
 * @param input  分析データの要約
 * @param now    現在日時（テスト時の注入用）
 * @returns 優先度順にソートされた修正提案の配列（dedupe済・上限適用済）
 *
 * @example
 * ```ts
 * const suggestions = buildCorrectiveActions(input, new Date());
 * // => [{ priority: 'P0', ... }, { priority: 'P1', ... }]
 * ```
 */
export function buildCorrectiveActions(
  input: CorrectiveActionInput,
  now: Date = new Date(),
): ActionSuggestion[] {
  const raw: ActionSuggestion[] = [];

  for (const rule of ALL_RULES) {
    const result = rule(input, now);
    if (result) {
      raw.push(result);
    }
  }

  // 1. 同一 user + CTA の重複除去
  const deduped = deduplicateSuggestions(raw);

  // 2. 優先度順 → 生成日時順でソート
  deduped.sort((a, b) => {
    const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // 3. ユーザーあたりの上限制限
  return deduped.slice(0, MAX_SUGGESTIONS_PER_USER);
}

