/**
 * 支援計画シート再評価（PlanningSheetReassessment）
 *
 * ISP のモニタリング（MonitoringRecord）とは **別型・別記録** として管理する。
 *
 * ## ISP モニタリングとの違い
 *
 * | 軸                | ISP MonitoringRecord             | PlanningSheetReassessment        |
 * |-------------------|----------------------------------|----------------------------------|
 * | 見るもの          | 生活全体 → 目標達成・方針変更    | 行動 → 仮説検証・手順実効性      |
 * | 周期              | 6か月                            | 3か月 + 行動トリガー             |
 * | ISP 項目          | 意向・QOL・目標                  | ❌ 含まない                      |
 * | 支援計画シート項目| ❌ 含まない                      | ABC・仮説・手順・環境            |
 *
 * ## ドメインルール
 *
 * - ISP のアセスメント項目を、支援計画シートのアセスメント欄で代替してはならない。
 * - 支援計画シートの ABC/仮説/手順設計を、ISP のアセスメント欄で代替してはならない。
 * - ISP モニタリングと支援計画シート再評価は、頻度も目的も異なるため別記録として扱う。
 *
 * @see src/domain/isp/types.ts — MonitoringRecord（ISP側）
 * @see src/domain/regulatory/severeDisabilityAddon.ts — 加算判定
 */

// ─────────────────────────────────────────────
// 再評価トリガー
// ─────────────────────────────────────────────

/**
 * 再評価トリガー種別
 *
 * 支援計画シートの再評価は、定期（3か月）だけでなく
 * 行動変化やインシデント起点でも走る。
 */
export type ReassessmentTrigger =
  | 'scheduled'   // 3か月定期（scheduled_quarterly）
  | 'incident'    // 行動増加・リスク行動増加
  | 'monitoring'  // 手順不全（手順がうまく機能していない）
  | 'other';      // 環境変化 / Iceberg再分析 / Daily記録蓄積など

/** トリガー種別の日本語ラベル */
export const REASSESSMENT_TRIGGER_LABELS: Record<ReassessmentTrigger, string> = {
  scheduled: '3か月定期',
  incident: '行動変化・インシデント',
  monitoring: '手順不全・モニタリング',
  other: 'その他',
} as const;

// ─────────────────────────────────────────────
// 計画変更判定
// ─────────────────────────────────────────────

/**
 * 再評価による計画変更判定
 *
 * - no_change: 現行維持
 * - minor_revision: 軽微な修正（手順微調整等）
 * - major_revision: 大幅改訂（仮説見直し・手順再設計）
 * - urgent_revision: 緊急改訂（重大リスク・即時対応）
 */
export type PlanChangeDecision =
  | 'no_change'
  | 'minor_revision'
  | 'major_revision'
  | 'urgent_revision';

/** 計画変更判定の日本語ラベル */
export const PLAN_CHANGE_DECISION_LABELS: Record<PlanChangeDecision, string> = {
  no_change: '変更なし',
  minor_revision: '軽微な修正',
  major_revision: '大幅改訂',
  urgent_revision: '緊急改訂',
} as const;

// ─────────────────────────────────────────────
// PlanningSheetReassessment 型
// ─────────────────────────────────────────────

/**
 * 支援計画シート再評価記録
 *
 * 行動支援の実効性を評価し、支援計画シートの改訂要否を判定する記録。
 * ISP の MonitoringRecord とは完全に独立。
 */
export interface PlanningSheetReassessment {
  /** 再評価 ID */
  id: string;
  /** 紐づく支援計画シート ID */
  planningSheetId: string;
  /** 再評価実施日（ISO 8601） */
  reassessedAt: string;
  /** 再評価実施者（staffId） */
  reassessedBy: string;

  // ── トリガー ──

  /** 再評価のトリガー種別 */
  triggerType: ReassessmentTrigger;

  // ── 行動支援の評価 ──

  /** ABC記録のまとめ（先行事象・行動・結果事象の傾向） */
  abcSummary: string;
  /** 仮説の検証結果（仮説が支持されたか、修正が必要か） */
  hypothesisReview: string;
  /** 手順の実効性評価（期待通りか、乖離があるか） */
  procedureEffectiveness: string;
  /** 環境変化の記録（生活環境・支援体制の変化） */
  environmentChange: string;

  // ── 判定 ──

  /** 計画変更の判定 */
  planChangeDecision: PlanChangeDecision;
  /** 次回再評価予定日（ISO 8601 — 原則3か月後） */
  nextReassessmentAt: string;

  // ── 備考 ──

  /** 自由記述の備考 */
  notes: string;
}

// ─────────────────────────────────────────────
// 再評価周期制御
// ─────────────────────────────────────────────

/** 支援計画シートに追加する再評価制御フィールド群の型 */
export interface ReassessmentControl {
  /** 再評価周期（日数）— デフォルト 90日（3か月） */
  reassessmentCycleDays: number;
  /** 最終再評価日（ISO 8601） */
  lastReassessmentAt: string | null;
  /** 次回再評価期限（ISO 8601） */
  nextReassessmentDueAt: string | null;
}

/** デフォルトの再評価周期（日） */
export const DEFAULT_REASSESSMENT_CYCLE_DAYS = 90;

// ─────────────────────────────────────────────
// 再評価判定ヘルパー
// ─────────────────────────────────────────────

/**
 * 最終再評価日からの経過日数を算出する
 *
 * @param lastReassessmentAt 最終再評価日（ISO 8601）
 * @param referenceDate 基準日（省略時は現在日）
 * @returns 経過日数。最終再評価日が null の場合は null。
 */
export function computeDaysSinceReassessment(
  lastReassessmentAt: string | null | undefined,
  referenceDate?: string,
): number | null {
  if (!lastReassessmentAt) return null;

  const last = new Date(lastReassessmentAt);
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const lastUtc = Date.UTC(last.getFullYear(), last.getMonth(), last.getDate());
  const refUtc = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());

  return Math.floor((refUtc - lastUtc) / (1000 * 60 * 60 * 24));
}

/**
 * 3か月定期再評価が超過しているかを判定する
 *
 * @param lastReassessmentAt 最終再評価日（ISO 8601）
 * @param cycleDays 再評価周期（省略時は 90日）
 * @param referenceDate 基準日（省略時は現在日）
 * @returns { overdue, daysSince, cycleDays }
 */
export function isQuarterlyReassessmentOverdue(
  lastReassessmentAt: string | null | undefined,
  cycleDays: number = DEFAULT_REASSESSMENT_CYCLE_DAYS,
  referenceDate?: string,
): { overdue: boolean; daysSince: number | null; cycleDays: number } {
  const daysSince = computeDaysSinceReassessment(lastReassessmentAt, referenceDate);

  if (daysSince === null) {
    // 再評価未実施 → 超過とみなす
    return { overdue: true, daysSince: null, cycleDays };
  }

  return {
    overdue: daysSince > cycleDays,
    daysSince,
    cycleDays,
  };
}

/**
 * 次回再評価期限が超過しているかを判定する
 *
 * @param nextReassessmentDueAt 次回再評価期限（ISO 8601）
 * @param referenceDate 基準日（省略時は現在日）
 */
export function isReassessmentDueDateOverdue(
  nextReassessmentDueAt: string | null | undefined,
  referenceDate?: string,
): boolean {
  if (!nextReassessmentDueAt) return false;

  const due = new Date(nextReassessmentDueAt);
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const refUtc = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());

  return refUtc > dueUtc;
}

/**
 * 再評価期限までの残日数を算出する
 *
 * @returns 残日数（超過していたら負の値）。期限未設定の場合は null。
 */
export function daysUntilReassessment(
  nextReassessmentDueAt: string | null | undefined,
  referenceDate?: string,
): number | null {
  if (!nextReassessmentDueAt) return null;

  const due = new Date(nextReassessmentDueAt);
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const refUtc = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());

  return Math.floor((dueUtc - refUtc) / (1000 * 60 * 60 * 24));
}

/**
 * 再評価日から次回期限を算出する
 *
 * @param reassessedAt 再評価実施日
 * @param cycleDays 再評価周期（デフォルト 90日）
 * @returns 次回再評価期限（ISO 8601 日付文字列 YYYY-MM-DD）
 */
export function computeNextReassessmentDueDate(
  reassessedAt: string,
  cycleDays: number = DEFAULT_REASSESSMENT_CYCLE_DAYS,
): string {
  const date = new Date(reassessedAt);
  date.setDate(date.getDate() + cycleDays);
  return date.toISOString().slice(0, 10);
}
