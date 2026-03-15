/**
 * @fileoverview ISP 見直し提案ロジック（pure function）
 * @description
 * Phase 4-A:
 *   GoalProgressSummary[] から IspRecommendationSummary を生成する。
 *
 * 判定表:
 *   | ProgressLevel | 基本推奨              | trend=declining で昇格     |
 *   |---------------|----------------------|---------------------------|
 *   | achieved      | continue             | —                          |
 *   | progressing   | continue             | —                          |
 *   | stagnant      | adjust-support       | revise-goal                |
 *   | regressing    | revise-goal          | urgent-review              |
 *   | noData        | pending              | —                          |
 *
 * 全関数は pure function。副作用・外部依存なし。
 *
 * 関連:
 *   - goalProgressTypes.ts (入力型)
 *   - ispRecommendationTypes.ts (出力型)
 *   - docs/architecture/support-pdca-engine.md (設計根拠)
 */

import type { GoalProgressSummary } from './goalProgressTypes';
import type {
  IspRecommendation,
  IspRecommendationEvidence,
  IspRecommendationLevel,
  IspRecommendationSummary,
} from './ispRecommendationTypes';
import {
  ISP_RECOMMENDATION_LABELS,
  ISP_RECOMMENDATION_SEVERITY,
} from './ispRecommendationTypes';

// ─── 判定マトリクス ──────────────────────────────────────

/**
 * GoalProgressSummary 1件を IspRecommendation に変換する。
 *
 * 判定ロジック:
 * 1. noData → pending（データ蓄積を促す）
 * 2. achieved / progressing → continue（現行支援を継続）
 *    - achieved は「次段階検討」のニュアンスを reason に含む
 * 3. stagnant → adjust-support（支援方法の見直し）
 *    - ただし trend=declining → revise-goal に昇格
 * 4. regressing → revise-goal（目標再設定）
 *    - ただし trend=declining + 記録件数が十分 → urgent-review に昇格
 *
 * @param gp - GoalProgressSummary（assessGoalProgress の出力）
 * @param options - オプション（目標名などの表示補助情報）
 * @returns IspRecommendation
 */
export function deriveIspRecommendation(
  gp: GoalProgressSummary,
  options?: { goalName?: string },
): IspRecommendation {
  const evidence: IspRecommendationEvidence = {
    progressLevel: gp.level,
    rate: gp.rate,
    trend: gp.trend,
    matchedRecordCount: gp.matchedRecordCount,
    matchedTagCount: gp.matchedTagCount,
    linkedCategories: gp.linkedCategories,
  };

  const name = options?.goalName ?? `目標(${gp.goalId})`;

  // ── noData ──
  if (gp.level === 'noData') {
    return {
      goalId: gp.goalId,
      level: 'pending',
      reason: `${name}: 判定根拠となる記録データが不足しています。記録の蓄積により判定が可能になります。`,
      evidence,
    };
  }

  // ── achieved ──
  if (gp.level === 'achieved') {
    return {
      goalId: gp.goalId,
      level: 'continue',
      reason: `${name}: 目標を達成しています（達成率${pct(gp.rate)}）。現行支援の継続、または次段階の目標設定を検討してください。`,
      evidence,
    };
  }

  // ── progressing ──
  if (gp.level === 'progressing') {
    return {
      goalId: gp.goalId,
      level: 'continue',
      reason: `${name}: 進捗がみられます（達成率${pct(gp.rate)}、傾向: ${trendLabel(gp.trend)}）。現行支援の継続を推奨します。`,
      evidence,
    };
  }

  // ── stagnant ──
  if (gp.level === 'stagnant') {
    // trend が declining なら revise-goal に昇格
    if (gp.trend === 'declining') {
      return {
        goalId: gp.goalId,
        level: 'revise-goal',
        reason: `${name}: 進捗の停滞に加え低下傾向がみられます（達成率${pct(gp.rate)}）。目標の再設定または支援方法の大幅な見直しを提案します。`,
        evidence,
      };
    }

    return {
      goalId: gp.goalId,
      level: 'adjust-support',
      reason: `${name}: 進捗が停滞しています（達成率${pct(gp.rate)}、傾向: ${trendLabel(gp.trend)}）。支援方法の見直しを提案します。`,
      evidence,
    };
  }

  // ── regressing ──
  // trend=declining + 十分な記録件数 → urgent-review
  if (gp.trend === 'declining' && gp.matchedRecordCount >= 3) {
    return {
      goalId: gp.goalId,
      level: 'urgent-review',
      reason: `${name}: 後退傾向が継続しています（達成率${pct(gp.rate)}、根拠記録${gp.matchedRecordCount}件）。緊急の支援見直しを推奨します。`,
      evidence,
    };
  }

  return {
    goalId: gp.goalId,
    level: 'revise-goal',
    reason: `${name}: 後退がみられます（達成率${pct(gp.rate)}、傾向: ${trendLabel(gp.trend)}）。目標の再設定を提案します。`,
    evidence,
  };
}

// ─── 一括変換 ────────────────────────────────────────────

/**
 * GoalProgressSummary[] から IspRecommendationSummary を生成する。
 *
 * - 目標が0件の場合は空の summary を返す
 * - overallLevel は全目標中の最も深刻なレベルを採用
 * - summaryText は全体像を1文で要約
 *
 * @param goalProgressList - GoalProgressSummary の配列
 * @param options - 目標名のマッピング
 * @returns IspRecommendationSummary
 */
export function buildIspRecommendations(
  goalProgressList: GoalProgressSummary[],
  options?: { goalNames?: Record<string, string> },
): IspRecommendationSummary {
  if (goalProgressList.length === 0) {
    return {
      recommendations: [],
      overallLevel: 'pending',
      actionableCount: 0,
      totalGoalCount: 0,
      summaryText: '評価対象の目標がありません。',
    };
  }

  const recommendations = goalProgressList.map((gp) =>
    deriveIspRecommendation(gp, {
      goalName: options?.goalNames?.[gp.goalId],
    }),
  );

  // overallLevel: 最も深刻なレベルを採用
  const overallLevel = resolveOverallLevel(recommendations);

  // actionableCount: pending を除いた目標数
  const actionableCount = recommendations.filter(
    (r) => r.level !== 'pending',
  ).length;

  // summaryText
  const summaryText = buildSummaryText(recommendations, overallLevel);

  return {
    recommendations,
    overallLevel,
    actionableCount,
    totalGoalCount: goalProgressList.length,
    summaryText,
  };
}

// ─── ヘルパー ────────────────────────────────────────────

/** 最も深刻な IspRecommendationLevel を解決する */
function resolveOverallLevel(
  recommendations: IspRecommendation[],
): IspRecommendationLevel {
  if (recommendations.length === 0) return 'pending';

  let maxSeverity = 0;
  let maxLevel: IspRecommendationLevel = 'pending';

  for (const r of recommendations) {
    const severity = ISP_RECOMMENDATION_SEVERITY[r.level];
    if (severity > maxSeverity) {
      maxSeverity = severity;
      maxLevel = r.level;
    }
  }

  return maxLevel;
}

/** 全体要約テキストを生成 */
function buildSummaryText(
  recommendations: IspRecommendation[],
  overallLevel: IspRecommendationLevel,
): string {
  const total = recommendations.length;
  const byLevel = countByLevel(recommendations);

  const parts: string[] = [];

  if (byLevel.continue > 0) {
    parts.push(`継続${byLevel.continue}件`);
  }
  if (byLevel['adjust-support'] > 0) {
    parts.push(`支援見直し${byLevel['adjust-support']}件`);
  }
  if (byLevel['revise-goal'] > 0) {
    parts.push(`目標再設定${byLevel['revise-goal']}件`);
  }
  if (byLevel['urgent-review'] > 0) {
    parts.push(`緊急レビュー${byLevel['urgent-review']}件`);
  }
  if (byLevel.pending > 0) {
    parts.push(`判定保留${byLevel.pending}件`);
  }

  const distribution = parts.join('、');
  const overallLabel = ISP_RECOMMENDATION_LABELS[overallLevel];

  return `${total}目標中: ${distribution}。総合判定: ${overallLabel}。`;
}

/** レベルごとの件数カウント */
function countByLevel(
  recommendations: IspRecommendation[],
): Record<IspRecommendationLevel, number> {
  const counts: Record<IspRecommendationLevel, number> = {
    continue: 0,
    'adjust-support': 0,
    'revise-goal': 0,
    'urgent-review': 0,
    pending: 0,
  };

  for (const r of recommendations) {
    counts[r.level]++;
  }

  return counts;
}

/** rate (0–1) → パーセント表示 */
function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** ProgressTrend → 日本語ラベル */
function trendLabel(trend: string): string {
  switch (trend) {
    case 'improving':
      return '改善傾向';
    case 'declining':
      return '低下傾向';
    case 'stable':
    default:
      return '横ばい';
  }
}
