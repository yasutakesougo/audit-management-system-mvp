/**
 * @fileoverview 運用 KPI 計算エンジン（純粋関数）
 * @description
 * MVP-015: Sprint 3 Priority 4
 *
 * 管理者が「施設全体の健全度」を把握するための KPI を純粋関数で計算する。
 *
 * KPI 一覧:
 * - 未入力解消率: 当日の記録完了数 / 当日の対象者数
 * - 申し送り滞留率: 未対応の重要申し送り / 全申し送り
 * - 計画未整備率: ISP 未整備または期限超過 / 全在籍者数
 * - 例外発生率: 現在の例外件数 (severity 加重)
 *
 * 設計原則:
 * - UI 非依存 / React 非依存 / 副作用なし
 * - ExceptionCenter / Dashboard から同じ関数を呼べる
 * - 閾値は定数で外部定義（将来のカスタマイズに備える）
 */

// ─── 型定義 ──────────────────────────────────────────────────────

export type KpiStatus = 'good' | 'warning' | 'critical';

export type KpiCard = {
  /** KPI の一意キー */
  key: string;
  /** 表示ラベル */
  label: string;
  /** スコア（0〜100 の割合、または絶対数） */
  value: number;
  /** 表示用フォーマット済み文字列 */
  displayValue: string;
  /** 健全度ステータス */
  status: KpiStatus;
  /** アイコン文字 */
  icon: string;
  /** 補足説明 */
  description: string;
  /** トレンド方向 (good な方向が up か down かで変わる) */
  trend: 'up' | 'down' | 'neutral';
};

export type OperationKpis = {
  /** 未入力解消率 (0〜100%) */
  recordCompletionRate: KpiCard;
  /** 申し送り滞留率 (0〜100%) */
  handoffPendingRate: KpiCard;
  /** 計画未整備率 (0〜100%) */
  planUnarrangedRate: KpiCard;
  /** 例外件数スコア (0〜100、低いほど良い) */
  exceptionScore: KpiCard;
  /** 全体健全度スコア (0〜100、高いほど良い) */
  overallHealthScore: KpiCard;
};

// ─── 入力型 ──────────────────────────────────────────────────────

export type RecordKpiInput = {
  /** 在籍者数（当日対象） */
  totalUsers: number;
  /** 本日記録作成済み人数 */
  completedToday: number;
};

export type HandoffKpiInput = {
  /** 全申し送り件数 */
  totalHandoffs: number;
  /** 未対応の重要申し送り件数 */
  pendingCriticalCount: number;
};

export type PlanKpiInput = {
  /** 全在籍者数 */
  totalUsers: number;
  /** ISP 未整備または期限超過の人数 */
  unarrangedCount: number;
};

export type ExceptionKpiInput = {
  /** severity: critical の件数 */
  criticalCount: number;
  /** severity: high の件数 */
  highCount: number;
  /** severity: medium の件数 */
  mediumCount: number;
  /** severity: low の件数 */
  lowCount: number;
};

// ─── 閾値定数 ──────────────────────────────────────────────────

/** 未入力解消率の閾値 (high な方が good) */
const COMPLETION_THRESHOLDS = { good: 90, warning: 70 } as const;
/** 申し送り滞留率の閾値 (low な方が good) */
const HANDOFF_THRESHOLDS = { good: 0, warning: 30 } as const;
/** 計画未整備率の閾値 (low な方が good) */
const PLAN_THRESHOLDS = { good: 0, warning: 15 } as const;
/** 例外スコアの閾値 (low な方が good) */
const EXCEPTION_THRESHOLDS = { good: 10, warning: 30 } as const;

// ─── ユーティリティ ──────────────────────────────────────────────

function toRate(numerator: number, denominator: number, defaultWhenEmpty: number = 0): number {
  if (denominator === 0) return defaultWhenEmpty;
  return Math.round((numerator / denominator) * 100);
}

function statusFromRate(
  rate: number,
  thresholds: { good: number; warning: number },
  higherIsBetter: boolean,
): KpiStatus {
  if (higherIsBetter) {
    if (rate >= thresholds.good) return 'good';
    if (rate >= thresholds.warning) return 'warning';
    return 'critical';
  } else {
    if (rate <= thresholds.good) return 'good';
    if (rate <= thresholds.warning) return 'warning';
    return 'critical';
  }
}

// ─── 個別 KPI 計算 ──────────────────────────────────────────────

/**
 * 未入力解消率 KPI
 */
export function computeRecordCompletionKpi(input: RecordKpiInput): KpiCard {
  // 対象者 0 人なら 100% (問題なし)
  const rate = toRate(input.completedToday, input.totalUsers, 100);
  const status = statusFromRate(rate, COMPLETION_THRESHOLDS, true);
  return {
    key: 'record-completion',
    label: '記録作成率',
    value: rate,
    displayValue: `${rate}%`,
    status,
    icon: status === 'good' ? '✅' : status === 'warning' ? '⚠️' : '🔴',
    description: `${input.totalUsers}人中 ${input.completedToday}人が記録済み`,
    trend: 'up',
  };
}

/**
 * 申し送り滞留率 KPI
 */
export function computeHandoffPendingKpi(input: HandoffKpiInput): KpiCard {
  // 申し送り 0 件なら pending 率 0% (問題なし)
  const rate = toRate(input.pendingCriticalCount, input.totalHandoffs, 0);
  const status = statusFromRate(rate, HANDOFF_THRESHOLDS, false);
  return {
    key: 'handoff-pending',
    label: '重要申し送り滞留率',
    value: rate,
    displayValue: `${rate}%`,
    status,
    icon: status === 'good' ? '✅' : status === 'warning' ? '📨' : '🔴',
    description: `重要申し送り ${input.pendingCriticalCount}件 未対応`,
    trend: 'down',
  };
}

/**
 * 計画未整備率 KPI
 */
export function computePlanUnarrangedKpi(input: PlanKpiInput): KpiCard {
  const rate = toRate(input.unarrangedCount, input.totalUsers, 0);
  const status = statusFromRate(rate, PLAN_THRESHOLDS, false);
  return {
    key: 'plan-unarranged',
    label: '計画未整備率',
    value: rate,
    displayValue: `${rate}%`,
    status,
    icon: status === 'good' ? '✅' : status === 'warning' ? '📋' : '🔴',
    description: `${input.unarrangedCount}人の支援計画が未整備`,
    trend: 'down',
  };
}

/**
 * 例外スコア KPI (severity 加重: critical×5 / high×3 / medium×1 / low×0.5)
 */
export function computeExceptionScoreKpi(input: ExceptionKpiInput): KpiCard {
  const raw =
    input.criticalCount * 5 +
    input.highCount * 3 +
    input.mediumCount * 1 +
    input.lowCount * 0.5;
  const score = Math.min(Math.round(raw), 100);
  const status = statusFromRate(score, EXCEPTION_THRESHOLDS, false);
  const total = input.criticalCount + input.highCount + input.mediumCount + input.lowCount;
  return {
    key: 'exception-score',
    label: '例外スコア',
    value: score,
    displayValue: `${score}pt`,
    status,
    icon: status === 'good' ? '✅' : status === 'warning' ? '⚠️' : '🚨',
    description: `例外 ${total}件 (緊急${input.criticalCount} / 高${input.highCount} / 中${input.mediumCount})`,
    trend: 'down',
  };
}

/**
 * 全体健全度スコア (0〜100) — 4 KPI の加重平均
 */
function computeOverallHealth(
  recordRate: number,
  handoffRate: number,
  planRate: number,
  exceptionScore: number,
): KpiCard {
  // 記録入力率 (高いほど良い): そのまま
  // 滞留率・未整備率・例外スコア (低いほど良い): 100 から引く
  const health = Math.round(
    recordRate * 0.4 +
    (100 - handoffRate) * 0.25 +
    (100 - planRate) * 0.2 +
    (100 - exceptionScore) * 0.15,
  );
  const status: KpiStatus = health >= 80 ? 'good' : health >= 60 ? 'warning' : 'critical';
  return {
    key: 'overall-health',
    label: '施設健全度',
    value: health,
    displayValue: `${health}pt`,
    status,
    icon: status === 'good' ? '🏥' : status === 'warning' ? '⚕️' : '🚨',
    description: '4 指標の加重スコア',
    trend: 'up',
  };
}

// ─── 統合計算関数 ────────────────────────────────────────────────

export type ComputeKpisInput = {
  record: RecordKpiInput;
  handoff: HandoffKpiInput;
  plan: PlanKpiInput;
  exception: ExceptionKpiInput;
};

/**
 * 全 KPI を一括計算する
 *
 * @param input - 4 ドメイン分のインプット
 * @returns OperationKpis (5 枚の KpiCard)
 */
export function computeOperationKpis(input: ComputeKpisInput): OperationKpis {
  const record = computeRecordCompletionKpi(input.record);
  const handoff = computeHandoffPendingKpi(input.handoff);
  const plan = computePlanUnarrangedKpi(input.plan);
  const exception = computeExceptionScoreKpi(input.exception);
  const overall = computeOverallHealth(
    record.value,
    handoff.value,
    plan.value,
    exception.value,
  );

  return {
    recordCompletionRate: record,
    handoffPendingRate: handoff,
    planUnarrangedRate: plan,
    exceptionScore: exception,
    overallHealthScore: overall,
  };
}

/**
 * KpiCard の status が critical／warning なものを抽出する
 * ExceptionCenter の新しい例外タイプとして浮上させる際に使用
 */
export function extractKpiAlerts(kpis: OperationKpis): KpiCard[] {
  return Object.values(kpis).filter((k) => k.status !== 'good');
}
