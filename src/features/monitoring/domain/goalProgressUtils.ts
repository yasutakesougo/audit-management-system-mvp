/**
 * @fileoverview ISP 目標 × 行動タグの推論・進捗判定ロジック
 * @description
 * Phase 3-A:
 *   - inferGoalTagLinks: GoalItem.domains → BehaviorTagCategory の自動推論
 *   - assessGoalProgress: rate × trend → ProgressLevel の判定
 *
 * 全関数は pure function。副作用・外部依存なし。
 */

import type { BehaviorTagCategory } from '../../daily/domain/behaviorTag';
import type {
  GoalDomainId,
  GoalLike,
  GoalProgressInput,
  GoalProgressSummary,
  GoalTagLink,
  ProgressLevel,
} from './goalProgressTypes';

// ─── 5領域 → 4カテゴリ マッピング ──────────────────────

/**
 * GoalItem.domains の各 ID から、関連する BehaviorTagCategory を推論する。
 *
 * 根拠:
 *   - health  → 食事・排泄・睡眠(dailyLiving) + 自己調整(positive)
 *   - motor   → 生活動作(dailyLiving) + 新スキル(positive)
 *   - cognitive → パニック・感覚(behavior)
 *   - language → 言語要求・ジェスチャー(communication)
 *   - social  → 協力行動(positive) + コミュニケーション(communication)
 */
export const DOMAIN_CATEGORY_MAP: Record<GoalDomainId, BehaviorTagCategory[]> = {
  health:    ['dailyLiving', 'positive'],
  motor:     ['dailyLiving', 'positive'],
  cognitive: ['behavior'],
  language:  ['communication'],
  social:    ['communication', 'positive'],
};

// ─── inferGoalTagLinks ─────────────────────────────────

/**
 * Goal の domains フィールドから BehaviorTagCategory を自動推論する。
 *
 * - domains がない/空の goal → inferredCategories は空配列
 * - 未知の domain ID → スキップ（エラーにしない）
 * - 重複カテゴリは除去
 * - カテゴリの順序はソート済みで安定
 *
 * @param goals - GoalItem の最小形
 * @returns 各 goal に対する GoalTagLink
 */
export function inferGoalTagLinks(goals: GoalLike[]): GoalTagLink[] {
  return goals.map((goal) => {
    // Phase 4: manual override があればそちらを優先
    if (goal.overrideCategories && goal.overrideCategories.length > 0) {
      const manual = Array.from(new Set(goal.overrideCategories))
        .sort() as BehaviorTagCategory[];
      return {
        goalId: goal.id,
        inferredCategories: manual,
        inferredTags: [],
        source: 'manual' as const,
      };
    }

    const categories = Array.from(
      new Set(
        (goal.domains ?? []).flatMap(
          (d) => DOMAIN_CATEGORY_MAP[d as GoalDomainId] ?? [],
        ),
      ),
    ).sort() as BehaviorTagCategory[];

    return {
      goalId: goal.id,
      inferredCategories: categories,
      inferredTags: [], // Phase 3-A では未実装
      source: 'domain-inference' as const,
    };
  });
}

// ─── assessGoalProgress ────────────────────────────────

/**
 * 判定マトリクス:
 *
 * | rate             | improving   | stable      | declining   |
 * |------------------|-------------|-------------|-------------|
 * | >= 0.5           | achieved    | progressing | progressing |
 * | >= 0.3, < 0.5    | progressing | progressing | stagnant    |
 * | >= 0.1, < 0.3    | progressing | stagnant    | regressing  |
 * | < 0.1            | stagnant    | stagnant    | regressing  |
 *
 * totalRecordCount === 0 → noData（即 return）
 */
export function assessGoalProgress(
  input: GoalProgressInput,
): GoalProgressSummary {
  const {
    goalId,
    linkedCategories,
    matchedRecordCount,
    matchedTagCount,
    totalRecordCount,
    trend,
  } = input;

  // ── データなし ──
  if (totalRecordCount === 0) {
    return {
      goalId,
      level: 'noData',
      rate: 0,
      trend: 'stable',
      matchedRecordCount: 0,
      matchedTagCount: 0,
      linkedCategories,
      note: '記録データがありません',
    };
  }

  const rate = matchedRecordCount / totalRecordCount;

  // ── 判定マトリクス ──
  let level: ProgressLevel;

  if (rate >= 0.5) {
    level = trend === 'improving' ? 'achieved' : 'progressing';
  } else if (rate >= 0.3) {
    level = trend === 'declining' ? 'stagnant' : 'progressing';
  } else if (rate >= 0.1) {
    if (trend === 'declining') level = 'regressing';
    else if (trend === 'stable') level = 'stagnant';
    else level = 'progressing';
  } else {
    level = trend === 'declining' ? 'regressing' : 'stagnant';
  }

  return {
    goalId,
    level,
    rate: Math.round(rate * 100) / 100, // 小数2桁に丸め
    trend,
    matchedRecordCount,
    matchedTagCount,
    linkedCategories,
  };
}
