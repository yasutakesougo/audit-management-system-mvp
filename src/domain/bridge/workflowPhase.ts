/**
 * workflowPhase — PDCA ワークフローフェーズ判定（純関数）
 *
 * 利用者ごとに「今どのPDCAフェーズにいるか」を自動判定し、
 * 次にやるべきアクションを決定する。
 *
 * ── 制度根拠 ──
 * 障害者総合支援法施行規則 第26条の2:
 *   「少なくとも3か月に1回以上、モニタリングを行う」
 *
 * ── 設計方針 ──
 * 1. pure function — UI・Repository に依存しない
 * 2. severity + priority + reason のみ返す（UI文言は mapper 側に分離）
 * 3. computeMonitoringSchedule() に依存してモニタリング判定
 * 4. referenceDate でテスト時の日付注入が可能
 *
 * ── 判定順（上から早期 return） ──
 * 1. 計画シートなし → needs_assessment
 * 2. 計画あり・手順なし → needs_plan
 * 3. モニタリング期限超過 → monitoring_overdue
 * 4. 再評価未反映 → needs_reassessment
 * 5. モニタリング14日以内 → needs_monitoring
 * 6. それ以外 → active_plan
 *
 * @module domain/bridge/workflowPhase
 */

import { computeMonitoringSchedule } from './monitoringSchedule';
import type { MonitoringUrgency } from './monitoringSchedule';

// ─────────────────────────────────────────────
// Phase / Reason types
// ─────────────────────────────────────────────

/**
 * ワークフローフェーズ（6段階）
 *
 * PDCA サイクル上の現在位置を表す。
 */
export type WorkflowPhase =
  | 'needs_assessment'
  | 'needs_plan'
  | 'active_plan'
  | 'needs_monitoring'
  | 'monitoring_overdue'
  | 'needs_reassessment';

/**
 * フェーズの分類理由コード
 *
 * UI 文言はこの reason から mapper 側で変換する。
 */
export type WorkflowPhaseReason =
  | 'missing_plan'
  | 'missing_steps'
  | 'monitoring_overdue'
  | 'monitoring_upcoming'
  | 'reassessment_pending'
  | 'stable';

export type WorkflowSeverity = 'info' | 'success' | 'warning' | 'danger';

// ─────────────────────────────────────────────
// Output types
// ─────────────────────────────────────────────

/**
 * フェーズ判定結果（pure function の出力）
 *
 * UI 文言（label, description, ctaLabel）は含まない。
 * phase + reason + severity + priority + メタデータのみ。
 */
export interface WorkflowPhaseResult {
  /** 利用者ID */
  userId: string;
  /** 利用者名 */
  userName: string;
  /** 現在のフェーズ */
  phase: WorkflowPhase;
  /** 分類理由コード */
  reason: WorkflowPhaseReason;
  /** 表示優先度（数値が小さいほど高優先） */
  priority: number;
  /** 重要度 */
  severity: WorkflowSeverity;
  /** 現行計画シートID（ある場合） */
  planningSheetId: string | null;
  /** モニタリングスケジュール情報（ある場合） */
  monitoring: {
    nextDueDate: string;
    daysRemaining: number;
    urgency: MonitoringUrgency;
  } | null;
  /** 再評価情報（再評価待ちの場合のみ） */
  reassessment: {
    lastReassessmentAt: string | null;
    daysSince: number | null;
  } | null;
}

// ─────────────────────────────────────────────
// Input type
// ─────────────────────────────────────────────

/**
 * フェーズ判定の入力データ
 *
 * リポジトリから取得したデータを整形して渡す。
 */
export interface DeterminePhaseInput {
  /** 利用者ID */
  userId: string;
  /** 利用者名 */
  userName: string;
  /** 利用者の計画シート一覧 */
  planningSheets: PlanningSheetSnapshot[];
  /** 再評価記録一覧（最新のもの順） */
  reassessments?: ReassessmentSnapshot[];
  /** 基準日（テスト時の日付注入用、YYYY-MM-DD） */
  referenceDate?: string;
}

/**
 * 計画シートの最小スナップショット
 *
 * フェーズ判定に必要な最小限の情報のみ含む。
 */
export interface PlanningSheetSnapshot {
  id: string;
  status: string;
  /** 適用開始日（YYYY-MM-DD） */
  appliedFrom?: string | null;
  /** 最終見直し日（YYYY-MM-DD） */
  reviewedAt?: string | null;
  /** 見直し周期（日） */
  reviewCycleDays?: number;
  /** 手順ステップ数 */
  procedureCount: number;
  /** 計画シートが現行版かどうか */
  isCurrent?: boolean;
}

/**
 * 再評価記録の最小スナップショット
 */
export interface ReassessmentSnapshot {
  /** 紐づく計画シートID */
  planningSheetId: string;
  /** 再評価実施日（ISO 8601） */
  reassessedAt: string;
  /** 計画変更判定 */
  planChangeDecision: string;
}

// ─────────────────────────────────────────────
// Priority constants
// ─────────────────────────────────────────────

/** フェーズ別の優先度（値が小さいほど高優先） */
export const PHASE_PRIORITIES: Record<WorkflowPhase, number> = {
  monitoring_overdue: 1,
  needs_reassessment: 2,
  needs_assessment: 3,
  needs_plan: 4,
  needs_monitoring: 5,
  active_plan: 6,
} as const;

/** フェーズ別の重要度 */
export const PHASE_SEVERITIES: Record<WorkflowPhase, WorkflowSeverity> = {
  monitoring_overdue: 'danger',
  needs_reassessment: 'warning',
  needs_assessment: 'info',
  needs_plan: 'warning',
  needs_monitoring: 'warning',
  active_plan: 'success',
} as const;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * 利用者の現行（active）計画シートを取得する。
 *
 * 優先順位:
 * 1. status === 'active' and isCurrent === true
 * 2. status === 'active'
 * 3. 最初のシート
 */
export function findActiveSheet(
  sheets: PlanningSheetSnapshot[],
): PlanningSheetSnapshot | null {
  if (sheets.length === 0) return null;

  return (
    sheets.find((s) => s.status === 'active' && s.isCurrent) ??
    sheets.find((s) => s.status === 'active') ??
    sheets[0]
  );
}

/**
 * 再評価未反映かどうかを判定する。
 *
 * 条件: 最新の再評価が存在し、かつ計画変更判定が no_change でない場合、
 *       再評価日が計画シートの reviewedAt より新しければ未反映。
 */
function hasUnreflectedReassessment(
  activeSheet: PlanningSheetSnapshot,
  reassessments: ReassessmentSnapshot[],
): { pending: boolean; lastReassessmentAt: string | null; daysSince: number | null } {
  // 当該シートの再評価を抽出
  const sheetReassessments = reassessments
    .filter((r) => r.planningSheetId === activeSheet.id)
    .sort((a, b) => b.reassessedAt.localeCompare(a.reassessedAt));

  if (sheetReassessments.length === 0) {
    return { pending: false, lastReassessmentAt: null, daysSince: null };
  }

  const latest = sheetReassessments[0];

  // no_change なら反映不要
  if (latest.planChangeDecision === 'no_change') {
    return { pending: false, lastReassessmentAt: latest.reassessedAt, daysSince: null };
  }

  // reviewedAt が再評価日以降ならすでに反映済み
  const reviewedAt = activeSheet.reviewedAt;
  if (reviewedAt && reviewedAt >= latest.reassessedAt) {
    return { pending: false, lastReassessmentAt: latest.reassessedAt, daysSince: null };
  }

  // 未反映
  return {
    pending: true,
    lastReassessmentAt: latest.reassessedAt,
    daysSince: null, // 呼び出し側で必要に応じて計算
  };
}

// ─────────────────────────────────────────────
// Main function (pure)
// ─────────────────────────────────────────────

/**
 * 利用者のワークフローフェーズを判定する。
 *
 * 判定順（上から優先、早期 return）:
 * 1. 計画シートなし → needs_assessment
 * 2. 計画あり・手順なし → needs_plan
 * 3. モニタリング期限超過 → monitoring_overdue
 * 4. 再評価未反映あり → needs_reassessment
 * 5. モニタリング14日以内 → needs_monitoring
 * 6. それ以外 → active_plan
 *
 * @param input - 判定入力データ
 * @returns フェーズ判定結果
 */
export function determineWorkflowPhase(
  input: DeterminePhaseInput,
): WorkflowPhaseResult {
  const { userId, userName, planningSheets, reassessments = [] } = input;

  // ── 1. 計画シートなし → needs_assessment ──
  if (planningSheets.length === 0) {
    return {
      userId,
      userName,
      phase: 'needs_assessment',
      reason: 'missing_plan',
      priority: PHASE_PRIORITIES.needs_assessment,
      severity: PHASE_SEVERITIES.needs_assessment,
      planningSheetId: null,
      monitoring: null,
      reassessment: null,
    };
  }

  // 現行シートを特定
  const activeSheet = findActiveSheet(planningSheets);
  if (!activeSheet) {
    // 理論上は planningSheets.length > 0 ならここに来ないが、安全策
    return {
      userId,
      userName,
      phase: 'needs_assessment',
      reason: 'missing_plan',
      priority: PHASE_PRIORITIES.needs_assessment,
      severity: PHASE_SEVERITIES.needs_assessment,
      planningSheetId: null,
      monitoring: null,
      reassessment: null,
    };
  }

  // ── 2. 手順なし → needs_plan ──
  if (activeSheet.procedureCount === 0) {
    return {
      userId,
      userName,
      phase: 'needs_plan',
      reason: 'missing_steps',
      priority: PHASE_PRIORITIES.needs_plan,
      severity: PHASE_SEVERITIES.needs_plan,
      planningSheetId: activeSheet.id,
      monitoring: null,
      reassessment: null,
    };
  }

  // ── モニタリングスケジュールを計算 ──
  const schedule = computeMonitoringSchedule({
    appliedFrom: activeSheet.appliedFrom ?? new Date().toISOString().slice(0, 10),
    reviewCycleDays: activeSheet.reviewCycleDays ?? 90,
    reviewedAt: activeSheet.reviewedAt ?? null,
    referenceDate: input.referenceDate,
  });

  const monitoringInfo = schedule
    ? {
        nextDueDate: schedule.nextDueDate,
        daysRemaining: schedule.daysRemaining,
        urgency: schedule.urgency,
      }
    : null;

  // ── 3. モニタリング期限超過 → monitoring_overdue ──
  if (schedule?.urgency === 'overdue') {
    return {
      userId,
      userName,
      phase: 'monitoring_overdue',
      reason: 'monitoring_overdue',
      priority: PHASE_PRIORITIES.monitoring_overdue,
      severity: PHASE_SEVERITIES.monitoring_overdue,
      planningSheetId: activeSheet.id,
      monitoring: monitoringInfo,
      reassessment: null,
    };
  }

  // ── 4. 再評価未反映 → needs_reassessment ──
  const reassessmentStatus = hasUnreflectedReassessment(activeSheet, reassessments);
  if (reassessmentStatus.pending) {
    return {
      userId,
      userName,
      phase: 'needs_reassessment',
      reason: 'reassessment_pending',
      priority: PHASE_PRIORITIES.needs_reassessment,
      severity: PHASE_SEVERITIES.needs_reassessment,
      planningSheetId: activeSheet.id,
      monitoring: monitoringInfo,
      reassessment: {
        lastReassessmentAt: reassessmentStatus.lastReassessmentAt,
        daysSince: reassessmentStatus.daysSince,
      },
    };
  }

  // ── 5. モニタリング14日以内 → needs_monitoring ──
  if (schedule && schedule.daysRemaining <= 14) {
    return {
      userId,
      userName,
      phase: 'needs_monitoring',
      reason: 'monitoring_upcoming',
      priority: PHASE_PRIORITIES.needs_monitoring,
      severity: PHASE_SEVERITIES.needs_monitoring,
      planningSheetId: activeSheet.id,
      monitoring: monitoringInfo,
      reassessment: null,
    };
  }

  // ── 6. 安定状態 → active_plan ──
  return {
    userId,
    userName,
    phase: 'active_plan',
    reason: 'stable',
    priority: PHASE_PRIORITIES.active_plan,
    severity: PHASE_SEVERITIES.active_plan,
    planningSheetId: activeSheet.id,
    monitoring: monitoringInfo,
    reassessment: null,
  };
}

// ─────────────────────────────────────────────
// Sort / Filter helpers
// ─────────────────────────────────────────────

/**
 * ワークフローフェーズ結果をアクション必要度順にソートする。
 *
 * - 優先度（priority）の昇順（数値が小さいほど高優先）
 * - 同一優先度内ではモニタリング残日数の昇順
 */
export function sortByWorkflowPriority(
  items: WorkflowPhaseResult[],
): WorkflowPhaseResult[] {
  return [...items].sort((a, b) => {
    // 1. priority 昇順
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // 2. モニタリング残日数 昇順（null は後ろ）
    const aRemaining = a.monitoring?.daysRemaining ?? Infinity;
    const bRemaining = b.monitoring?.daysRemaining ?? Infinity;
    return aRemaining - bRemaining;
  });
}

/**
 * アクションが必要なフェーズ結果のみを抽出する。
 *
 * active_plan は除外。
 */
export function filterActionRequired(
  items: WorkflowPhaseResult[],
): WorkflowPhaseResult[] {
  return items.filter((item) => item.phase !== 'active_plan');
}

// ─────────────────────────────────────────────
// UI Label mapper (文言変換)
// ─────────────────────────────────────────────

/**
 * Today カード用の表示データ
 *
 * pure function の結果から UI 表示用データに変換する際の型。
 */
export interface PlanningWorkflowCardItem {
  userId: string;
  userName: string;
  phase: WorkflowPhase;
  title: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  priority: number;
  severity: WorkflowSeverity;
}

/** フェーズごとのラベルテンプレート */
const PHASE_LABELS: Record<WorkflowPhase, {
  title: string;
  ctaLabel: string;
}> = {
  needs_assessment: {
    title: 'アセスメント未実施',
    ctaLabel: '計画シートを新規作成',
  },
  needs_plan: {
    title: '計画設計中',
    ctaLabel: '支援設計タブを開く',
  },
  monitoring_overdue: {
    title: 'モニタリング超過',
    ctaLabel: 'モニタリングを実施',
  },
  needs_reassessment: {
    title: '再評価待ち',
    ctaLabel: '再評価タブへ',
  },
  needs_monitoring: {
    title: 'モニタリング時期',
    ctaLabel: 'モニタリングタブを確認',
  },
  active_plan: {
    title: '計画実施中',
    ctaLabel: 'Daily 記録へ',
  },
} as const;

/**
 * subtitle のフォーマット
 */
function formatSubtitle(result: WorkflowPhaseResult): string {
  switch (result.phase) {
    case 'monitoring_overdue':
      return result.monitoring
        ? `${Math.abs(result.monitoring.daysRemaining)}日超過`
        : '期限超過';
    case 'needs_monitoring':
      return result.monitoring
        ? `あと${result.monitoring.daysRemaining}日`
        : 'モニタリング時期';
    case 'needs_reassessment':
      return '再評価結果の反映が必要';
    case 'needs_assessment':
      return '計画シートが未作成です';
    case 'needs_plan':
      return '手順が未設計です';
    case 'active_plan':
      return result.monitoring
        ? `次回モニタリング: ${result.monitoring.nextDueDate}`
        : '計画実施中';
  }
}

/**
 * CTA リンク先の生成
 */
function formatHref(result: WorkflowPhaseResult): string {
  switch (result.phase) {
    case 'needs_assessment':
      return '/support-planning-sheet/new';
    case 'needs_plan':
      return `/support-planning-sheet/${result.planningSheetId}?tab=planning`;
    case 'monitoring_overdue':
    case 'needs_monitoring':
      return `/support-planning-sheet/${result.planningSheetId}?tab=monitoring`;
    case 'needs_reassessment':
      return `/support-planning-sheet/${result.planningSheetId}?tab=reassessment`;
    case 'active_plan':
      return `/daily/support?userId=${result.userId}`;
  }
}

/**
 * WorkflowPhaseResult を Today カード用のアイテムに変換する。
 *
 * 純関数の出力からUI表示用データに変換する薄い mapper。
 */
export function toPlanningWorkflowCardItem(
  result: WorkflowPhaseResult,
): PlanningWorkflowCardItem {
  const labels = PHASE_LABELS[result.phase];

  return {
    userId: result.userId,
    userName: result.userName,
    phase: result.phase,
    title: labels.title,
    subtitle: formatSubtitle(result),
    ctaLabel: labels.ctaLabel,
    href: formatHref(result),
    priority: result.priority,
    severity: result.severity,
  };
}
