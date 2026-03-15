/**
 * @fileoverview ISP 計画書ドラフト生成ロジック（pure function）
 * @description
 * Phase 5-A:
 *   Phase 1〜4 の既存出力を「ISP 計画書」の制度書式に再構成する。
 *   新しい分析ロジックは追加しない — 書式変換のみ。
 *
 * 全関数は pure function。副作用・外部依存なし。
 *
 * 関連:
 *   - ispPlanDraftTypes.ts (型定義)
 *   - monitoringDailyAnalytics.ts (集計)
 *   - ispRecommendationUtils.ts (提案ロジック)
 *   - ispRecommendationDecisionUtils.ts (判断ロジック)
 */

import type { GoalProgressSummary } from './goalProgressTypes';
import { PROGRESS_LEVEL_LABELS } from './goalProgressTypes';
import type { IspRecommendation } from './ispRecommendationTypes';
import { ISP_RECOMMENDATION_LABELS } from './ispRecommendationTypes';
import type { DecisionStatus, IspRecommendationDecision } from './ispRecommendationDecisionTypes';
import { DECISION_STATUS_LABELS } from './ispRecommendationDecisionTypes';

import type {
  BuildIspPlanDraftInput,
  IspPlanDraft,
  IspPlanDraftSection,
} from './ispPlanDraftTypes';
import { ISP_PLAN_DRAFT_SECTION_TITLES } from './ispPlanDraftTypes';

// ─── メイン関数 ──────────────────────────────────────────

/**
 * ISP 計画書ドラフトを生成する。
 *
 * 各セクションは既存ロジックの出力を「計画書の文脈」に
 * 再構成するだけ。新しい分析ロジックは追加しない。
 *
 * @param input - 既存出力を束ねた入力
 * @returns IspPlanDraft（6セクション順序保証）
 */
export function buildIspPlanDraft(input: BuildIspPlanDraftInput): IspPlanDraft {
  return {
    sections: [
      buildOverviewSection(input),
      buildMonitoringFindingsSection(input),
      buildGoalAssessmentSection(input),
      buildDecisionSummarySection(input),
      buildPlanRevisionSection(input),
      buildNextActionsSection(input),
    ],
  };
}

// ─── 1. 期間概要 ─────────────────────────────────────────

function buildOverviewSection(input: BuildIspPlanDraftInput): IspPlanDraftSection {
  const lines: string[] = [];
  const p = input.periodSummary;

  if (p?.from && p?.to) {
    lines.push(`対象期間: ${p.from} 〜 ${p.to}`);
  }

  if (p?.recordedDays != null && p?.totalDays != null) {
    lines.push(`記録日数: ${p.recordedDays}日 / ${p.totalDays}日中`);
  }

  if (p?.recordRate != null) {
    lines.push(`記録率: ${p.recordRate}%`);
  }

  // 目標数と判断状況
  const goalCount = input.goalProgress?.length ?? 0;
  if (goalCount > 0) {
    lines.push(`対象目標数: ${goalCount}件`);
  }

  const ds = input.decisionSummary;
  if (ds) {
    lines.push(`判断済み: ${ds.decidedCount}件 / 未判断: ${ds.pendingCount}件`);
  }

  if (lines.length === 0) {
    lines.push('期間情報がありません。');
  }

  return {
    kind: 'overview',
    title: ISP_PLAN_DRAFT_SECTION_TITLES['overview'],
    lines,
  };
}

// ─── 2. モニタリング所見 ─────────────────────────────────

function buildMonitoringFindingsSection(input: BuildIspPlanDraftInput): IspPlanDraftSection {
  const lines = input.monitoringFindings && input.monitoringFindings.length > 0
    ? [...input.monitoringFindings]
    : ['モニタリング所見データがありません。'];

  return {
    kind: 'monitoring-findings',
    title: ISP_PLAN_DRAFT_SECTION_TITLES['monitoring-findings'],
    lines,
  };
}

// ─── 3. 目標別評価 ───────────────────────────────────────

function buildGoalAssessmentSection(input: BuildIspPlanDraftInput): IspPlanDraftSection {
  const lines: string[] = [];
  const goalProgress = input.goalProgress ?? [];
  const recommendations = input.ispRecommendations?.recommendations ?? [];
  const decisions = input.decisions ?? [];
  const goalNames = input.goalNames ?? {};

  if (goalProgress.length === 0) {
    lines.push('目標進捗データがありません。');
    return {
      kind: 'goal-assessment',
      title: ISP_PLAN_DRAFT_SECTION_TITLES['goal-assessment'],
      lines,
    };
  }

  // goalId → 最新 decision マップ
  const latestDecisions = resolveLatestDecisionsByGoal(decisions);

  for (const gp of goalProgress) {
    const name = goalNames[gp.goalId] ?? `目標(${gp.goalId})`;
    const rec = recommendations.find((r) => r.goalId === gp.goalId);
    const decision = latestDecisions.get(gp.goalId);

    lines.push(formatGoalAssessmentBlock(name, gp, rec, decision));
  }

  return {
    kind: 'goal-assessment',
    title: ISP_PLAN_DRAFT_SECTION_TITLES['goal-assessment'],
    lines,
  };
}

/**
 * 1目標分の評価ブロックを生成する。
 */
function formatGoalAssessmentBlock(
  goalName: string,
  gp: GoalProgressSummary,
  rec?: IspRecommendation,
  decision?: IspRecommendationDecision,
): string {
  const levelLabel = PROGRESS_LEVEL_LABELS[gp.level];
  const ratePercent = Math.round(gp.rate * 100);
  const trendText = trendLabel(gp.trend);

  const parts: string[] = [
    `■ ${goalName}`,
    `  進捗判定: ${levelLabel}（達成率 ${ratePercent}%、傾向: ${trendText}）`,
    `  根拠: 記録 ${gp.matchedRecordCount}件、関連タグ ${gp.matchedTagCount}件`,
  ];

  if (rec) {
    parts.push(`  ISP提案: ${ISP_RECOMMENDATION_LABELS[rec.level]}`);
  }

  if (decision) {
    const statusLabel = DECISION_STATUS_LABELS[decision.status];
    const dateText = formatDecisionDate(decision.decidedAt);
    parts.push(`  担当者判断: ${statusLabel}（${dateText}）`);
    if (decision.note) {
      parts.push(`  メモ: ${decision.note}`);
    }
  } else {
    parts.push('  担当者判断: 未判断');
  }

  return parts.join('\n');
}

// ─── 4. 判断結果まとめ ───────────────────────────────────

function buildDecisionSummarySection(input: BuildIspPlanDraftInput): IspPlanDraftSection {
  const lines: string[] = [];
  const ds = input.decisionSummary;

  if (!ds) {
    lines.push('判断データがありません。');
    return {
      kind: 'decision-summary',
      title: ISP_PLAN_DRAFT_SECTION_TITLES['decision-summary'],
      lines,
    };
  }

  const statusEntries: { label: string; count: number }[] = [
    { label: DECISION_STATUS_LABELS.accepted,  count: ds.byStatus.accepted },
    { label: DECISION_STATUS_LABELS.deferred,  count: ds.byStatus.deferred },
    { label: DECISION_STATUS_LABELS.dismissed, count: ds.byStatus.dismissed },
    { label: DECISION_STATUS_LABELS.pending,   count: ds.byStatus.pending },
  ];

  for (const entry of statusEntries) {
    lines.push(`${entry.label}: ${entry.count}件`);
  }

  if (ds.lastDecidedAt) {
    lines.push(`最終判断: ${formatDecisionDate(ds.lastDecidedAt)}`);
  }

  return {
    kind: 'decision-summary',
    title: ISP_PLAN_DRAFT_SECTION_TITLES['decision-summary'],
    lines,
  };
}

// ─── 5. 計画見直し案 ─────────────────────────────────────

function buildPlanRevisionSection(input: BuildIspPlanDraftInput): IspPlanDraftSection {
  const lines: string[] = [];
  const decisions = input.decisions ?? [];
  const goalNames = input.goalNames ?? {};

  if (decisions.length === 0) {
    lines.push('判断データがありません。計画変更の提案は次回モニタリング以降に行います。');
    return {
      kind: 'plan-revision',
      title: ISP_PLAN_DRAFT_SECTION_TITLES['plan-revision'],
      lines,
    };
  }

  const latestDecisions = resolveLatestDecisionsByGoal(decisions);

  // ── 採用 ──
  const accepted = filterByStatus(latestDecisions, 'accepted');
  if (accepted.length > 0) {
    lines.push('【採用された提案への対応案】');
    for (const d of accepted) {
      const name = goalNames[d.goalId] ?? `目標(${d.goalId})`;
      lines.push(decisionToRevisionLine(name, d));
    }
  }

  // ── 保留 ──
  const deferred = filterByStatus(latestDecisions, 'deferred');
  if (deferred.length > 0) {
    lines.push('【保留中の提案への確認事項】');
    for (const d of deferred) {
      const name = goalNames[d.goalId] ?? `目標(${d.goalId})`;
      lines.push(`• ${name}: 次回モニタリングで再確認${d.note ? `（理由: ${d.note}）` : ''}`);
    }
  }

  // ── 見送り ──
  const dismissed = filterByStatus(latestDecisions, 'dismissed');
  if (dismissed.length > 0) {
    lines.push('【見送りの提案】');
    for (const d of dismissed) {
      const name = goalNames[d.goalId] ?? `目標(${d.goalId})`;
      lines.push(`• ${name}: 現時点では計画変更を行わない${d.note ? `（理由: ${d.note}）` : ''}`);
    }
  }

  if (lines.length === 0) {
    lines.push('全目標が未判断のため、計画見直し案はまだ生成できません。');
  }

  return {
    kind: 'plan-revision',
    title: ISP_PLAN_DRAFT_SECTION_TITLES['plan-revision'],
    lines,
  };
}

/**
 * 採用された判断から見直し文を生成する。
 * 提案レベルに応じたテンプレートを使用。
 */
function decisionToRevisionLine(
  goalName: string,
  decision: IspRecommendationDecision,
): string {
  const snap = decision.snapshot;
  const recLabel = ISP_RECOMMENDATION_LABELS[snap.level];

  switch (snap.level) {
    case 'continue':
      return `• ${goalName}: 現行支援を継続。達成の場合は次段階の目標設定を検討`;
    case 'adjust-support':
      return `• ${goalName}: 支援方法の見直しを計画に反映（提案: ${recLabel}）`;
    case 'revise-goal':
      return `• ${goalName}: 目標の再設定を次期計画に反映（提案: ${recLabel}）`;
    case 'urgent-review':
      return `• ${goalName}: 緊急の見直し対応を計画に反映（提案: ${recLabel}）`;
    case 'pending':
    default:
      return `• ${goalName}: 判定根拠を蓄積し次回モニタリングで再評価`;
  }
}

// ─── 6. 次期アクション ───────────────────────────────────

function buildNextActionsSection(input: BuildIspPlanDraftInput): IspPlanDraftSection {
  const lines: string[] = [];
  const decisions = input.decisions ?? [];
  const goalProgress = input.goalProgress ?? [];
  const goalNames = input.goalNames ?? {};

  const latestDecisions = resolveLatestDecisionsByGoal(decisions);
  let actionIndex = 1;

  // 採用 → 計画反映 TODO
  const accepted = filterByStatus(latestDecisions, 'accepted');
  for (const d of accepted) {
    const name = goalNames[d.goalId] ?? `目標(${d.goalId})`;
    lines.push(`${actionIndex}. ${decisionToNextActionLine(name, d)}`);
    actionIndex++;
  }

  // 保留 → 再評価 TODO
  const deferred = filterByStatus(latestDecisions, 'deferred');
  for (const d of deferred) {
    const name = goalNames[d.goalId] ?? `目標(${d.goalId})`;
    lines.push(`${actionIndex}. ${name}について次回モニタリングで再評価する`);
    actionIndex++;
  }

  // 未判断 → 判断確定 TODO
  const decidedGoalIds = new Set(latestDecisions.keys());
  const undecidedGoals = goalProgress.filter((gp) => !decidedGoalIds.has(gp.goalId));
  for (const gp of undecidedGoals) {
    const name = goalNames[gp.goalId] ?? `目標(${gp.goalId})`;
    lines.push(`${actionIndex}. ${name}の判断を確定する`);
    actionIndex++;
  }

  if (lines.length === 0) {
    lines.push('次期アクションはありません。');
  }

  return {
    kind: 'next-actions',
    title: ISP_PLAN_DRAFT_SECTION_TITLES['next-actions'],
    lines,
  };
}

/**
 * 採用判断から次期アクション文を生成する。
 */
function decisionToNextActionLine(
  goalName: string,
  decision: IspRecommendationDecision,
): string {
  switch (decision.snapshot.level) {
    case 'continue':
      return `${goalName}の現行支援を継続し、次段階の目標設定を検討する`;
    case 'adjust-support':
      return `${goalName}の支援方法を担当者間で検討し計画に反映する`;
    case 'revise-goal':
      return `${goalName}の次期目標文を作成する`;
    case 'urgent-review':
      return `${goalName}の緊急見直し対応を速やかに実施する`;
    case 'pending':
    default:
      return `${goalName}の記録蓄積を促進する`;
  }
}

// ─── ヘルパー ────────────────────────────────────────────

/**
 * goalId → 最新の IspRecommendationDecision を解決する。
 * 同一 goalId に複数判断がある場合は decidedAt 最新を採用。
 */
function resolveLatestDecisionsByGoal(
  decisions: IspRecommendationDecision[],
): Map<string, IspRecommendationDecision> {
  const map = new Map<string, IspRecommendationDecision>();
  for (const d of decisions) {
    const existing = map.get(d.goalId);
    if (!existing || new Date(d.decidedAt).getTime() > new Date(existing.decidedAt).getTime()) {
      map.set(d.goalId, d);
    }
  }
  return map;
}

/** 最新判断 Map からステータスでフィルタ */
function filterByStatus(
  latestMap: Map<string, IspRecommendationDecision>,
  status: DecisionStatus,
): IspRecommendationDecision[] {
  return [...latestMap.values()].filter((d) => d.status === status);
}

/** ISO 8601 日時を YYYY/MM/DD 形式に変換 */
function formatDecisionDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  } catch {
    return isoString;
  }
}

/** ProgressTrend → 日本語ラベル */
function trendLabel(trend: string): string {
  switch (trend) {
    case 'improving': return '改善傾向';
    case 'declining': return '低下傾向';
    case 'stable':
    default: return '横ばい';
  }
}
