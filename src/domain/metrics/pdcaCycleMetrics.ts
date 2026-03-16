/**
 * @fileoverview PDCA Cycle Metrics — 支援 PDCA サイクルの回転指標集計
 * @description
 * 90 日サイクル（モニタリングスケジュール）を基準に、
 * PDCA が計画通りに回っているかを定量化する Pure Function 群。
 *
 * 測定対象:
 * - サイクル完走率（全ステップが完了しているか）
 * - モニタリング遅延（期限超過の有無と深刻度）
 * - 提案→見直し→計画更新の速度
 * - 停滞サイクルの検出
 *
 * 原則:
 * - pure function のみ（副作用なし）
 * - ゼロ除算安全（safeRate）
 * - null / undefined 安全
 * - UI / storage 依存ゼロ
 *
 * @see docs/ops/metrics-framework.md § PDCA Metrics
 * @see docs/product/support-operations-os-architecture.md § PDCA Pipeline
 */

import { safeRate, daysBetween, median } from './proposalMetrics';
import { STALLED_DETECTION } from './metricsThresholds';

// ─── 入力型 ──────────────────────────────────────────────

/** PDCA サイクルの各ステップの完了状態 */
export interface PdcaCycleRecord {
  /** サイクルの識別子 */
  cycleId: string;
  /** 対象利用者コード */
  userId: string;
  /** サイクル開始日 ISO 8601 */
  startedAt: string;
  /** モニタリング期限 ISO 8601（90 日後等） */
  dueAt: string;
  /** 提案が採用された日時（null = 提案なし or 未採用） */
  proposalAcceptedAt?: string | null;
  /** モニタリング予定日 */
  reviewScheduledAt?: string | null;
  /** モニタリング実施完了日 */
  reviewCompletedAt?: string | null;
  /** 支援計画が更新された日時 */
  planUpdatedAt?: string | null;
}

// ─── 出力型 ──────────────────────────────────────────────

/** サイクルの完了ステータス */
export type CycleStatus =
  | 'completed'   // 全ステップ完了
  | 'in_progress' // 期限内だがまだ完了していない
  | 'overdue'     // 期限超過
  | 'stalled';    // 期限内だが提案後 14 日以上動きなし

/** 個別サイクルの診断結果 */
export interface CycleDiagnosis {
  cycleId: string;
  userId: string;
  status: CycleStatus;
  /** 期限超過日数（overdue の場合のみ、0 以上） */
  overdueDays: number;
  /** サイクル所要日数（completed の場合のみ） */
  cycleDays: number | null;
  /** 提案→見直しの日数 */
  proposalToReviewDays: number | null;
  /** 見直し→計画更新の日数 */
  reviewToPlanUpdateDays: number | null;
}

/** 全体集計結果 */
export interface PdcaCycleMetricsResult {
  /** サイクル総数 */
  totalCycles: number;
  /** 完了サイクル数 */
  completedCycles: number;
  /** 進行中サイクル数 */
  inProgressCycles: number;
  /** 期限超過サイクル数 */
  overdueCycles: number;
  /** 停滞サイクル数 */
  stalledCycles: number;
  /** 完走率 (0-100, 小数 1 桁) */
  completionRate: number;
  /** 期限超過率 */
  overdueRate: number;
  /** 停滞率 */
  stalledRate: number;
  /** 完了サイクルの所要日数中央値 */
  medianCycleDays: number;
  /** 完了サイクルの所要日数平均 */
  avgCycleDays: number;
  /** 期限超過の平均日数 */
  avgOverdueDays: number;
  /** 最大超過日数 */
  maxOverdueDays: number;
  /** モニタリング実施率（予定ありのうち完了した割合） */
  reviewCompletionRate: number;
  /** 提案→見直しの日数中央値 */
  medianProposalToReviewDays: number;
  /** 見直し→計画更新の日数中央値 */
  medianReviewToPlanUpdateDays: number;
  /** 個別診断（overdue / stalled のみ抽出、overdueDays 降順） */
  alerts: CycleDiagnosis[];
}

// ─── 定数 ────────────────────────────────────────────────

/** 提案採用から動きがないと stalled と見なす日数 */
const STALLED_THRESHOLD_DAYS = STALLED_DETECTION.STALLED_THRESHOLD_DAYS;

// ─── 個別サイクル診断 ────────────────────────────────────

/**
 * 1 サイクルの状態を診断する
 */
export function diagnoseCycle(
  record: PdcaCycleRecord,
  today: string,
): CycleDiagnosis {
  const { cycleId, userId, startedAt, dueAt } = record;

  // 完了判定: reviewCompleted + planUpdated が両方あれば completed
  const isCompleted = !!record.reviewCompletedAt && !!record.planUpdatedAt;

  // サイクル所要日数
  const cycleDays = isCompleted
    ? Math.round(daysBetween(startedAt, record.planUpdatedAt!) * 10) / 10
    : null;

  // 提案→見直しの日数
  const proposalToReviewDays =
    record.proposalAcceptedAt && record.reviewCompletedAt
      ? Math.round(daysBetween(record.proposalAcceptedAt, record.reviewCompletedAt) * 10) / 10
      : null;

  // 見直し→計画更新の日数
  const reviewToPlanUpdateDays =
    record.reviewCompletedAt && record.planUpdatedAt
      ? Math.round(daysBetween(record.reviewCompletedAt, record.planUpdatedAt) * 10) / 10
      : null;

  // 期限超過日数
  const overdueDays = (() => {
    const ref = isCompleted ? (record.planUpdatedAt!) : today;
    const diff = daysBetween(dueAt, ref);
    const dueTime = new Date(dueAt).getTime();
    const refTime = new Date(ref).getTime();
    return refTime > dueTime ? Math.round(diff * 10) / 10 : 0;
  })();

  // ステータス判定
  const status: CycleStatus = (() => {
    if (isCompleted) return 'completed';
    if (overdueDays > 0) return 'overdue';

    // stalled 判定: 提案採用後 N 日以上経過しても見直し未完了
    if (record.proposalAcceptedAt && !record.reviewCompletedAt) {
      const daysSinceAccepted = daysBetween(record.proposalAcceptedAt, today);
      if (daysSinceAccepted >= STALLED_THRESHOLD_DAYS) return 'stalled';
    }

    return 'in_progress';
  })();

  return {
    cycleId,
    userId,
    status,
    overdueDays,
    cycleDays,
    proposalToReviewDays,
    reviewToPlanUpdateDays,
  };
}

// ─── メイン集計関数 ──────────────────────────────────────

/**
 * PdcaCycleRecord[] から PDCA サイクルメトリクスを計算する。
 *
 * @param records - 全サイクルの記録
 * @param today   - 現在日時 ISO 8601（テスト容易性のため外から渡す）
 * @returns       - PdcaCycleMetricsResult
 */
export function computePdcaCycleMetrics(
  records: PdcaCycleRecord[],
  today: string,
): PdcaCycleMetricsResult {
  // 個別診断
  const diagnoses = records.map(r => diagnoseCycle(r, today));

  const totalCycles = diagnoses.length;
  const completedCycles = diagnoses.filter(d => d.status === 'completed').length;
  const inProgressCycles = diagnoses.filter(d => d.status === 'in_progress').length;
  const overdueCycles = diagnoses.filter(d => d.status === 'overdue').length;
  const stalledCycles = diagnoses.filter(d => d.status === 'stalled').length;

  // 完了サイクルの所要日数
  const cycleDaysList = diagnoses
    .filter(d => d.cycleDays !== null)
    .map(d => d.cycleDays!);

  // 期限超過日数
  const overdueDaysList = diagnoses
    .filter(d => d.overdueDays > 0)
    .map(d => d.overdueDays);

  // モニタリング実施率
  const reviewScheduled = records.filter(r => r.reviewScheduledAt).length;
  const reviewCompleted = records.filter(r => r.reviewCompletedAt).length;

  // 提案→見直し
  const proposalToReviewDaysList = diagnoses
    .filter(d => d.proposalToReviewDays !== null)
    .map(d => d.proposalToReviewDays!);

  // 見直し→計画更新
  const reviewToPlanUpdateDaysList = diagnoses
    .filter(d => d.reviewToPlanUpdateDays !== null)
    .map(d => d.reviewToPlanUpdateDays!);

  // alerts: overdue + stalled のみ、overdueDays 降順
  const alerts = diagnoses
    .filter(d => d.status === 'overdue' || d.status === 'stalled')
    .sort((a, b) => b.overdueDays - a.overdueDays);

  return {
    totalCycles,
    completedCycles,
    inProgressCycles,
    overdueCycles,
    stalledCycles,
    completionRate: safeRate(completedCycles, totalCycles),
    overdueRate: safeRate(overdueCycles, totalCycles),
    stalledRate: safeRate(stalledCycles, totalCycles),
    medianCycleDays: median(cycleDaysList),
    avgCycleDays: cycleDaysList.length > 0
      ? Math.round((cycleDaysList.reduce((a, b) => a + b, 0) / cycleDaysList.length) * 10) / 10
      : 0,
    avgOverdueDays: overdueDaysList.length > 0
      ? Math.round((overdueDaysList.reduce((a, b) => a + b, 0) / overdueDaysList.length) * 10) / 10
      : 0,
    maxOverdueDays: overdueDaysList.length > 0
      ? Math.max(...overdueDaysList)
      : 0,
    reviewCompletionRate: safeRate(reviewCompleted, reviewScheduled),
    medianProposalToReviewDays: median(proposalToReviewDaysList),
    medianReviewToPlanUpdateDays: median(reviewToPlanUpdateDaysList),
    alerts,
  };
}
