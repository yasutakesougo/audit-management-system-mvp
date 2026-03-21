/**
 * pdcaCycleOrchestrator — PDCA サイクル状態の計算（純関数）
 *
 * 計画シート・モニタリング・再評価・ワークフローフェーズから
 * PdcaCycleState を "計算" で導出する。
 *
 * ── 永続化方針 ──
 * この関数は一切の I/O を行わない。
 * - Read Model  → SharePoint（呼び出し元が取得済みデータを渡す）
 * - Event Log   → Firestore（persistDailyPdca が担当）
 * - PDCA 状態   → 本関数が毎回計算（永続化しない）
 *
 * ── Act → 次 Plan 接続 ──
 * cycleNumber を +1 し、前サイクルの Act 完了を起点に
 * 新しいサイクルの Plan フェーズを開始する。
 * これにより PDCA が "循環" する。
 *
 * @module domain/bridge/pdcaCycleOrchestrator
 */

import type { WorkflowPhase } from './workflowPhase';
import type {
  PdcaCyclePhase,
  PdcaCycleState,
  PdcaPhaseCompletionMap,
} from '@/domain/isp/types';

// ─────────────────────────────────────────────
// Input types
// ─────────────────────────────────────────────

/**
 * PDCA サイクル状態の計算に必要な入力データ
 *
 * リポジトリ層で取得したデータを整形して渡す。
 */
export interface DetermineCycleInput {
  /** 利用者 ID */
  userId: string;
  /** 支援計画シート ID */
  planningSheetId: string;
  /** 現在のワークフローフェーズ（workflowPhase.ts の出力） */
  workflowPhase: WorkflowPhase;

  // ── フェーズ完了イベント日 ──

  /** 計画シート作成日（YYYY-MM-DD） — Plan 完了 */
  planCreatedAt: string | null;
  /** 計画シート適用開始日（YYYY-MM-DD） — Do 開始 */
  planAppliedAt: string | null;
  /** 最新モニタリング実施日（YYYY-MM-DD） — Check 完了 */
  lastMonitoringAt: string | null;
  /** 最新再評価実施日（YYYY-MM-DD） — Act 完了 */
  lastReassessmentAt: string | null;

  // ── サイクル番号の判定材料 ──

  /** 過去の再評価回数（Act 完了回数） */
  reassessmentCount: number;

  // ── 健全度スコアの材料 ──

  /** 手順実施率（0–1, monitoringEvidence 由来） */
  procedureCompletionRate: number | null;
  /** モニタリング残日数（workflowPhase 由来、負値 = 超過） */
  monitoringDaysRemaining: number | null;

  /** 計算基準日（YYYY-MM-DD, テスト用日付注入） */
  referenceDate?: string;
}

// ─────────────────────────────────────────────
// resolveCurrentPhase
// ─────────────────────────────────────────────

/**
 * WorkflowPhase → PdcaCyclePhase のマッピング
 *
 * WorkflowPhase は6値（needs_assessment, needs_plan, active_plan,
 * needs_monitoring, monitoring_overdue, needs_reassessment）で、
 * PDCA の4値に集約する。
 *
 * 純関数 — 副作用なし。
 */
export function resolveCurrentPhase(workflowPhase: WorkflowPhase): PdcaCyclePhase {
  switch (workflowPhase) {
    case 'needs_assessment':
    case 'needs_plan':
      return 'plan';

    case 'active_plan':
      return 'do';

    case 'needs_monitoring':
    case 'monitoring_overdue':
      return 'check';

    case 'needs_reassessment':
      return 'act';

    default: {
      // exhaustive check: 未知のフェーズは plan にフォールバック
      const _exhaustive: never = workflowPhase;
      return 'plan';
    }
  }
}

// ─────────────────────────────────────────────
// buildPhaseCompletionMap
// ─────────────────────────────────────────────

/**
 * フェーズ完了日マップを構築する。
 *
 * 各フェーズの完了イベント日を入力から取得し、
 * null = 未完了 として返す。
 *
 * 純関数 — 副作用なし。
 */
export function buildPhaseCompletionMap(
  input: Pick<
    DetermineCycleInput,
    'planCreatedAt' | 'planAppliedAt' | 'lastMonitoringAt' | 'lastReassessmentAt'
  >,
): PdcaPhaseCompletionMap {
  return {
    plan: input.planCreatedAt ?? null,
    do: input.planAppliedAt ?? null,
    check: input.lastMonitoringAt ?? null,
    act: input.lastReassessmentAt ?? null,
  };
}

// ─────────────────────────────────────────────
// computeCycleHealth
// ─────────────────────────────────────────────

/** 健全度スコアの重み定数 */
const HEALTH_WEIGHTS = {
  /** 手順実施率 (Do) の重み */
  procedureCompletion: 0.4,
  /** モニタリング適時性 (Check) の重み */
  monitoringTimeliness: 0.3,
  /** フェーズ進行率の重み */
  phaseProgression: 0.3,
} as const;

/**
 * PDCA サイクルの健全度スコア（0.0–1.0）を計算する。
 *
 * ── 3因子の加重平均 ──
 * 1. 手順実施率（procedureCompletionRate）
 * 2. モニタリング適時性（残日数ベース）
 * 3. フェーズ進行率（4フェーズ中いくつ完了しているか）
 *
 * 純関数 — 副作用なし。
 */
export function computeCycleHealth(
  input: Pick<
    DetermineCycleInput,
    'procedureCompletionRate' | 'monitoringDaysRemaining'
  >,
  phaseCompletions: PdcaPhaseCompletionMap,
): { score: number; breakdown: string[] } {
  const breakdown: string[] = [];

  // ── 1. 手順実施率 ──
  const procScore = input.procedureCompletionRate ?? 1;
  breakdown.push(`手順実施率: ${(procScore * 100).toFixed(0)}%`);

  // ── 2. モニタリング適時性 ──
  let monScore = 1;
  if (input.monitoringDaysRemaining !== null) {
    if (input.monitoringDaysRemaining < 0) {
      // 超過 → 超過日数に比例してスコア減少 (最大30日超過で0)
      monScore = Math.max(0, 1 + input.monitoringDaysRemaining / 30);
      breakdown.push(`モニタリング: ${Math.abs(input.monitoringDaysRemaining)}日超過`);
    } else if (input.monitoringDaysRemaining <= 14) {
      // 14日以内 → やや減少
      monScore = 0.7 + (input.monitoringDaysRemaining / 14) * 0.3;
      breakdown.push(`モニタリング: 残${input.monitoringDaysRemaining}日`);
    } else {
      monScore = 1;
      breakdown.push(`モニタリング: 余裕あり（残${input.monitoringDaysRemaining}日）`);
    }
  } else {
    breakdown.push('モニタリング: データなし');
  }

  // ── 3. フェーズ進行率 ──
  const completedPhases = Object.values(phaseCompletions).filter(
    (v) => v !== null,
  ).length;
  const progressionScore = completedPhases / 4;
  breakdown.push(`フェーズ進行: ${completedPhases}/4`);

  // ── 加重平均 ──
  const score = clamp01(
    procScore * HEALTH_WEIGHTS.procedureCompletion +
      monScore * HEALTH_WEIGHTS.monitoringTimeliness +
      progressionScore * HEALTH_WEIGHTS.phaseProgression,
  );

  return { score: Math.round(score * 100) / 100, breakdown };
}

// ─────────────────────────────────────────────
// determinePdcaCycleState (main entry)
// ─────────────────────────────────────────────

/**
 * PDCA サイクル状態を計算で導出する
 *
 * ── 循環接続ルール ──
 * cycleNumber = reassessmentCount + 1
 *   → Act（再評価）が完了するたびにサイクルが回る
 *   → 再評価なし = 初回サイクル (cycleNumber = 1)
 *
 * 純関数 — I/O なし・冪等。
 */
export function determinePdcaCycleState(
  input: DetermineCycleInput,
): PdcaCycleState {
  const currentPhase = resolveCurrentPhase(input.workflowPhase);
  const phaseCompletions = buildPhaseCompletionMap(input);
  const { score, breakdown } = computeCycleHealth(
    input,
    phaseCompletions,
  );

  // Act → 次 Plan 接続: サイクル番号 = 再評価完了回数 + 1
  const cycleNumber = input.reassessmentCount + 1;

  const referenceDate =
    input.referenceDate ?? new Date().toISOString().slice(0, 10);

  return {
    userId: input.userId,
    planningSheetId: input.planningSheetId,
    currentPhase,
    cycleNumber,
    phaseCompletions,
    healthScore: score,
    healthScoreBreakdown: breakdown,
    computedAt: referenceDate,
  };
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

/** 0–1 にクランプ */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
