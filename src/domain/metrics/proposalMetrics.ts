/**
 * @fileoverview Proposal Metrics — 統一提案パイプラインの運用指標集計
 * @description
 * PlanningProposalBundle / ProposalAdoptionRecord を入力として、
 * 提案の価値を定量化する Pure Function 群。
 *
 * 原則:
 * - pure function のみ（副作用なし）
 * - ゼロ除算安全（safeRate）
 * - source / urgency / fieldKey でグルーピング
 * - UI / storage 依存ゼロ
 *
 * @see docs/ops/metrics-framework.md § Proposal Metrics
 * @see src/features/handoff/analysis/proposalBundle.ts
 * @see src/features/daily/domain/adoptionMetrics.ts（既存 Phase 1 集計）
 */

import type { ProposalSource } from '@/features/handoff/analysis/proposalBundle';

// ─── 入力型 ──────────────────────────────────────────────

/** 提案アクション */
export type ProposalAction = 'accepted' | 'dismissed' | 'deferred';

/** 却下理由 */
export type DismissReason =
  | 'not_applicable'
  | 'already_addressed'
  | 'insufficient_data'
  | 'disagree'
  | 'other';

/** 1 件の提案判断記録（Knowledge Layer から取得） */
export interface ProposalDecisionRecord {
  /** 提案 ID */
  proposalId: string;
  /** ソース */
  source: ProposalSource;
  /** 緊急度 */
  urgency: 'urgent' | 'recommended' | 'suggested' | undefined;
  /** 判断 */
  action: ProposalAction;
  /** 却下理由（dismissed 時のみ） */
  dismissReason?: DismissReason;
  /** 採用されたフィールドキー（accepted 時のみ） */
  selectedFields?: string[];
  /** 提案生成日時 ISO 8601 */
  generatedAt: string;
  /** 判断日時 ISO 8601 */
  decidedAt: string;
}

/** 集計期間 */
export interface MetricsPeriod {
  start: string;
  end: string;
}

// ─── 出力型 ──────────────────────────────────────────────

/** ソース別集計 */
export interface SourceMetrics {
  source: ProposalSource;
  total: number;
  accepted: number;
  dismissed: number;
  deferred: number;
  acceptanceRate: number;
}

/** 却下理由別集計 */
export interface DismissReasonMetrics {
  reason: DismissReason;
  count: number;
  rate: number;
}

/** 緊急度別集計 */
export interface UrgencyMetrics {
  urgency: string;
  total: number;
  accepted: number;
  acceptanceRate: number;
}

/** 全体集計結果 */
export interface ProposalMetricsResult {
  /** 集計期間 */
  period: MetricsPeriod;
  /** 提案総数 */
  total: number;
  /** 採用数 */
  accepted: number;
  /** 却下数 */
  dismissed: number;
  /** 保留数 */
  deferred: number;
  /** 採用率 (0-100, 小数 1 桁) */
  acceptanceRate: number;
  /** 却下率 */
  dismissalRate: number;
  /** 保留率 */
  deferralRate: number;
  /** 採用フィールド数（延べ） */
  totalFieldsApplied: number;
  /** 提案あたり平均採用フィールド数 */
  avgFieldsPerAcceptance: number;
  /** 判断速度: 生成→判断の日数中央値 */
  medianDecisionDays: number;
  /** 判断速度: 生成→判断の日数平均 */
  avgDecisionDays: number;
  /** ソース別集計 */
  bySource: SourceMetrics[];
  /** 却下理由分布 */
  dismissReasons: DismissReasonMetrics[];
  /** 緊急度別集計 */
  byUrgency: UrgencyMetrics[];
}

// ─── ユーティリティ ──────────────────────────────────────

/**
 * ゼロ除算安全な割合計算。小数 1 桁で返す。
 */
export function safeRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * 2 つの ISO 8601 日時間の差を日数で返す。
 */
export function daysBetween(isoA: string, isoB: string): number {
  const msPerDay = 86_400_000;
  const diff = Math.abs(new Date(isoB).getTime() - new Date(isoA).getTime());
  return diff / msPerDay;
}

/**
 * 数値配列の中央値を返す。空配列は 0。
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
  }
  return Math.round(sorted[mid] * 10) / 10;
}

// ─── メイン集計関数 ──────────────────────────────────────

/**
 * ProposalDecisionRecord[] から Proposal Metrics を計算する。
 *
 * @param records - 判断済みの提案記録（Knowledge Layer から取得）
 * @param period  - 集計期間
 * @returns       - ProposalMetricsResult
 */
export function computeProposalMetrics(
  records: ProposalDecisionRecord[],
  period: MetricsPeriod,
): ProposalMetricsResult {
  const total = records.length;
  const accepted = records.filter(r => r.action === 'accepted').length;
  const dismissed = records.filter(r => r.action === 'dismissed').length;
  const deferred = records.filter(r => r.action === 'deferred').length;

  // 採用フィールド数
  const totalFieldsApplied = records
    .filter(r => r.action === 'accepted')
    .reduce((sum, r) => sum + (r.selectedFields?.length ?? 0), 0);

  // 判断速度
  const decisionDays = records
    .filter(r => r.generatedAt && r.decidedAt)
    .map(r => daysBetween(r.generatedAt, r.decidedAt));

  return {
    period,
    total,
    accepted,
    dismissed,
    deferred,
    acceptanceRate: safeRate(accepted, total),
    dismissalRate: safeRate(dismissed, total),
    deferralRate: safeRate(deferred, total),
    totalFieldsApplied,
    avgFieldsPerAcceptance: accepted > 0
      ? Math.round((totalFieldsApplied / accepted) * 10) / 10
      : 0,
    medianDecisionDays: median(decisionDays),
    avgDecisionDays: decisionDays.length > 0
      ? Math.round((decisionDays.reduce((a, b) => a + b, 0) / decisionDays.length) * 10) / 10
      : 0,
    bySource: computeBySource(records),
    dismissReasons: computeDismissReasons(records),
    byUrgency: computeByUrgency(records),
  };
}

// ─── ソース別集計 ────────────────────────────────────────

function computeBySource(records: ProposalDecisionRecord[]): SourceMetrics[] {
  const sources: ProposalSource[] = ['handoff', 'abc', 'monitoring'];
  return sources.map(source => {
    const group = records.filter(r => r.source === source);
    const accepted = group.filter(r => r.action === 'accepted').length;
    const dismissed = group.filter(r => r.action === 'dismissed').length;
    const deferred = group.filter(r => r.action === 'deferred').length;
    return {
      source,
      total: group.length,
      accepted,
      dismissed,
      deferred,
      acceptanceRate: safeRate(accepted, group.length),
    };
  });
}

// ─── 却下理由分布 ────────────────────────────────────────

function computeDismissReasons(records: ProposalDecisionRecord[]): DismissReasonMetrics[] {
  const dismissedRecords = records.filter(r => r.action === 'dismissed');
  const total = dismissedRecords.length;

  const reasonCounts = new Map<DismissReason, number>();
  for (const r of dismissedRecords) {
    const reason = r.dismissReason ?? 'other';
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }

  return Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({
      reason,
      count,
      rate: safeRate(count, total),
    }))
    .sort((a, b) => b.count - a.count);
}

// ─── 緊急度別集計 ────────────────────────────────────────

function computeByUrgency(records: ProposalDecisionRecord[]): UrgencyMetrics[] {
  const urgencies = ['urgent', 'recommended', 'suggested', 'none'] as const;

  return urgencies.map(urgency => {
    const group = records.filter(r =>
      urgency === 'none'
        ? r.urgency === undefined
        : r.urgency === urgency,
    );
    const accepted = group.filter(r => r.action === 'accepted').length;
    return {
      urgency,
      total: group.length,
      accepted,
      acceptanceRate: safeRate(accepted, group.length),
    };
  });
}
