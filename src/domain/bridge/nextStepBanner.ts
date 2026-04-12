/**
 * nextStepBanner — 画面別「次のアクション」バナー判定（純関数）
 *
 * 画面（context）とフェーズ（phase）の組み合わせから、
 * 表示すべきバナーの内容を決定する。
 *
 * ── 設計方針 ──
 * 1. pure function — UI に依存しない
 * 2. CTA は必ず1つだけ（迷わせない）
 * 3. 説明は2行以内
 * 4. 「今何を見る画面か」ではなく「次に何をするか」を主語にする
 * 5. 不要なときは hidden: true で非表示
 *
 * @module domain/bridge/nextStepBanner
 */

import type { WorkflowPhase } from './workflowPhase';
import type { PdcaCycleState } from '@/domain/isp/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** バナー表示の文脈（どの画面に表示するか） */
export type BannerContext =
  | 'overview'
  | 'planning'
  | 'monitoring'
  | 'reassessment';

/** バナーのトーン */
export type BannerTone = 'info' | 'success' | 'warning' | 'danger';

/** 補助アラートの優先度 */
export type NextStepAlertPriority = 'p0' | 'p1' | 'p2';

/**
 * バナー内補助アラート
 *
 * 位置づけ:
 * - 既存 CTA を上書きしない補助レイヤー
 * - 既存の title / description / cta は維持し、alerts のみ追加する
 * - priority は P0/P1/P2 で段階判定する
 */
export interface NextStepAlert {
  type: Extract<BannerTone, 'warning' | 'danger'>;
  message: string;
  action: string;
  priority: NextStepAlertPriority;
}

/** バナー判定の入力 */
export interface ResolveNextStepInput {
  /** 利用者の現在のワークフローフェーズ */
  phase: WorkflowPhase;
  /** 表示先の画面コンテキスト */
  context: BannerContext;
  /** 利用者ID */
  userId?: string;
  /** 計画シートID */
  planningSheetId?: string;
  /** モニタリングで重要シグナルが検出されたか */
  hasMonitoringSignals?: boolean;
  /** 再評価結果が未反映か */
  hasUnappliedReassessment?: boolean;
  /** 計画更新案が未反映か */
  hasPendingPlanUpdate?: boolean;
  /** 期限超過の計画更新案があるか */
  hasOverduePlanUpdate?: boolean;
  /** PDCA サイクル状態（ある場合のみ補助判定に使用） */
  pdcaCycleState?: PdcaCycleState | null;
}

/** バナー判定結果（UIモデル） */
export interface NextStepBannerModel {
  /** バナーのトーン（色） */
  tone: BannerTone;
  /** タイトル（1行） */
  title: string;
  /** 説明（1-2行） */
  description: string;
  /** CTA ボタンラベル */
  ctaLabel: string;
  /** 遷移先 */
  href: string;
  /** 非表示にするか */
  hidden: boolean;
  /** 補助アラート（optional PDCA 拡張） */
  alerts: NextStepAlert[];
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const HIDDEN_BANNER: NextStepBannerModel = {
  tone: 'info',
  title: '',
  description: '',
  ctaLabel: '',
  href: '',
  hidden: true,
  alerts: [],
};

function toHealthScorePercent(score: number): number {
  if (!Number.isFinite(score)) return 100;
  return score <= 1 ? score * 100 : score;
}

function toDateOnly(value: string | Date | null | undefined): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  const normalized = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  return normalized;
}

function toEpochDay(dateOnly: string): number | null {
  const ts = Date.parse(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(ts)) return null;
  return Math.floor(ts / 86_400_000);
}

function getDaysSince(startDate: string | null | undefined, referenceDate: string): number | null {
  const start = toDateOnly(startDate);
  const startEpochDay = start ? toEpochDay(start) : null;
  const referenceEpochDay = toEpochDay(referenceDate);
  if (startEpochDay === null || referenceEpochDay === null) return null;

  return Math.max(0, referenceEpochDay - startEpochDay);
}

export function normalizeHealthScore(score: number): number {
  const percent = toHealthScorePercent(score);
  return Math.max(0, Math.min(100, percent));
}

export function resolveCheckPriority(daysSince: number): NextStepAlertPriority {
  if (daysSince >= 14) return 'p0';
  if (daysSince >= 7) return 'p1';
  return 'p2';
}

export function resolveActPriority(daysSince: number): NextStepAlertPriority {
  if (daysSince >= 14) return 'p0';
  if (daysSince >= 7) return 'p1';
  return 'p2';
}

export function resolveHealthPriority(scorePercent: number): NextStepAlertPriority | null {
  if (scorePercent < 20) return 'p0';
  if (scorePercent < 40) return 'p1';
  if (scorePercent < 60) return 'p2';
  return null;
}

function resolveReferenceDate(now: string | Date | undefined, fallback: string): string {
  return toDateOnly(now) ?? toDateOnly(fallback) ?? new Date().toISOString().slice(0, 10);
}

const ALERT_PRIORITY_ORDER: Record<NextStepAlertPriority, number> = {
  p0: 0,
  p1: 1,
  p2: 2,
};

function sortAlertsByPriority(alerts: NextStepAlert[]): NextStepAlert[] {
  return [...alerts].sort(
    (a, b) => ALERT_PRIORITY_ORDER[a.priority] - ALERT_PRIORITY_ORDER[b.priority],
  );
}

function alertTypeFromPriority(priority: NextStepAlertPriority): NextStepAlert['type'] {
  return priority === 'p0' ? 'danger' : 'warning';
}

function withElapsedDays(message: string, daysSince: number): string {
  return `${message}（${daysSince}日）`;
}

function toSafeElapsedDays(daysSince: number): number {
  return Math.max(0, daysSince);
}

function checkMessageByPriority(
  priority: NextStepAlertPriority,
  daysSince: number,
): string {
  switch (priority) {
    case 'p0':
      return withElapsedDays('モニタリング長期未実施', daysSince);
    case 'p1':
      return withElapsedDays('モニタリング未実施', daysSince);
    case 'p2':
      return withElapsedDays('モニタリング確認推奨', daysSince);
    default: {
      const _exhaustive: never = priority;
      return _exhaustive;
    }
  }
}

function actMessageByPriority(
  priority: NextStepAlertPriority,
  daysSince: number,
): string {
  switch (priority) {
    case 'p0':
      return withElapsedDays('再評価長期未実施', daysSince);
    case 'p1':
      return withElapsedDays('再評価未実施', daysSince);
    case 'p2':
      return withElapsedDays('再評価確認推奨', daysSince);
    default: {
      const _exhaustive: never = priority;
      return _exhaustive;
    }
  }
}

function healthMessageByPriority(priority: NextStepAlertPriority): string {
  switch (priority) {
    case 'p0':
      return '支援状態が危険域';
    case 'p1':
      return '支援状態に注意';
    case 'p2':
      return '支援状態を確認';
    default: {
      const _exhaustive: never = priority;
      return _exhaustive;
    }
  }
}

function resolveCheckStartDate(state: PdcaCycleState): string | null {
  return state.phaseCompletions.do ?? state.phaseCompletions.plan ?? state.computedAt;
}

function resolveActStartDate(state: PdcaCycleState): string | null {
  return state.phaseCompletions.check ?? state.phaseCompletions.do ?? state.computedAt;
}

/**
 * PDCA 状態から補助アラートを生成する（純関数）
 *
 * - 既存の phase/context 分岐は変更せず、末尾合流で追加する
 * - healthScore は 0.0–1.0 / 0–100 どちらでも受ける
 * - now を渡すと、日数判定の基準日をテストで固定できる
 */
export function buildPdcaAlerts(
  state?: PdcaCycleState | null,
  now?: string | Date,
): NextStepAlert[] {
  if (!state) return [];

  const referenceDate = resolveReferenceDate(now, state.computedAt);
  const alerts: NextStepAlert[] = [];

  if (state.currentPhase === 'check') {
    const daysSinceCheckStart =
      getDaysSince(resolveCheckStartDate(state), referenceDate) ?? 0;
    const safeDaysSinceCheckStart = toSafeElapsedDays(daysSinceCheckStart);
    const priority = resolveCheckPriority(safeDaysSinceCheckStart);

    alerts.push({
      type: alertTypeFromPriority(priority),
      message: checkMessageByPriority(priority, safeDaysSinceCheckStart),
      action: 'モニタリングへ',
      priority,
    });
  }

  if (state.currentPhase === 'act') {
    const daysSinceActStart = getDaysSince(resolveActStartDate(state), referenceDate) ?? 0;
    const safeDaysSinceActStart = toSafeElapsedDays(daysSinceActStart);
    const priority = resolveActPriority(safeDaysSinceActStart);

    alerts.push({
      type: alertTypeFromPriority(priority),
      message: actMessageByPriority(priority, safeDaysSinceActStart),
      action: '再評価入力へ',
      priority,
    });
  }

  const healthPriority = resolveHealthPriority(normalizeHealthScore(state.healthScore));
  if (healthPriority) {
    alerts.push({
      type: alertTypeFromPriority(healthPriority),
      message: healthMessageByPriority(healthPriority),
      action: 'PDCA確認',
      priority: healthPriority,
    });
  }

  return sortAlertsByPriority(alerts);
}

function buildPlanUpdateAlerts(input: ResolveNextStepInput): NextStepAlert[] {
  if (!input.hasPendingPlanUpdate) {
    return [];
  }

  const priority: NextStepAlertPriority = input.hasOverduePlanUpdate ? 'p0' : 'p1';

  return [{
    type: alertTypeFromPriority(priority),
    message: input.hasOverduePlanUpdate
      ? '支援計画の更新期限を超過'
      : '支援計画の更新が未反映',
    action: '更新案を確認',
    priority,
  }];
}

// ─────────────────────────────────────────────
// Context-specific resolvers
// ─────────────────────────────────────────────

function resolveOverview(input: ResolveNextStepInput): NextStepBannerModel {
  const { phase, planningSheetId } = input;

  switch (phase) {
    case 'monitoring_overdue':
      return {
        tone: 'danger',
        title: 'モニタリング期限を過ぎています',
        description: '速やかにモニタリングを実施してください。',
        ctaLabel: 'モニタリングを実施',
        href: `/support-planning-sheet/${planningSheetId}?tab=monitoring`,
        hidden: false,
        alerts: [],
      };

    case 'needs_reassessment':
      return {
        tone: 'warning',
        title: '再評価結果が計画に未反映です',
        description: '再評価の内容を計画に反映してください。',
        ctaLabel: '再評価を確認',
        href: `/support-planning-sheet/${planningSheetId}?tab=reassessment`,
        hidden: false,
        alerts: [],
      };

    case 'needs_monitoring':
      return {
        tone: 'warning',
        title: 'モニタリング時期が近づいています',
        description: 'モニタリングの準備を進めてください。',
        ctaLabel: 'モニタリングを確認',
        href: `/support-planning-sheet/${planningSheetId}?tab=monitoring`,
        hidden: false,
        alerts: [],
      };

    case 'needs_plan':
      return {
        tone: 'info',
        title: '支援手順が未設計です',
        description: '支援設計タブで手順を作成してください。',
        ctaLabel: '支援設計を続ける',
        href: `/support-planning-sheet/${planningSheetId}?tab=planning`,
        hidden: false,
        alerts: [],
      };

    case 'active_plan':
      return HIDDEN_BANNER; // 概要では安定時は非表示

    case 'needs_assessment':
      return {
        tone: 'info',
        title: '計画シートが未作成です',
        description: 'まずアセスメントを実施してください。',
        ctaLabel: '計画シートを新規作成',
        href: '/support-planning-sheet/new',
        hidden: false,
        alerts: [],
      };

    default:
      return HIDDEN_BANNER;
  }
}

function resolveMonitoring(input: ResolveNextStepInput): NextStepBannerModel {
  const { planningSheetId, hasMonitoringSignals } = input;

  if (hasMonitoringSignals) {
    return {
      tone: 'warning',
      title: '見直し候補が検出されました',
      description: 'モニタリング結果を再評価に反映してください。',
      ctaLabel: '再評価に反映',
      href: `/support-planning-sheet/${planningSheetId}?tab=reassessment`,
      hidden: false,
      alerts: [],
    };
  }

  return {
    tone: 'success',
    title: '大きな見直し候補はありません',
    description: '必要に応じて再評価タブで確認できます。',
    ctaLabel: '再評価を確認',
    href: `/support-planning-sheet/${planningSheetId}?tab=reassessment`,
    hidden: false,
    alerts: [],
  };
}

function resolveReassessment(input: ResolveNextStepInput): NextStepBannerModel {
  const { planningSheetId, hasUnappliedReassessment } = input;

  if (hasUnappliedReassessment) {
    return {
      tone: 'warning',
      title: '再評価内容をもとに計画を更新してください',
      description: '再評価結果を支援計画に反映してください。',
      ctaLabel: '計画を更新',
      href: `/support-planning-sheet/${planningSheetId}?tab=planning`,
      hidden: false,
      alerts: [],
    };
  }

  return {
    tone: 'info',
    title: 'モニタリング結果を反映できます',
    description: 'モニタリングが完了している場合、結果を再評価に反映できます。',
    ctaLabel: '反映内容を確認',
    href: `/support-planning-sheet/${planningSheetId}?tab=monitoring`,
    hidden: false,
    alerts: [],
  };
}

function resolvePlanning(input: ResolveNextStepInput): NextStepBannerModel {
  const { userId, phase, planningSheetId, hasPendingPlanUpdate, hasOverduePlanUpdate } = input;

  if (hasPendingPlanUpdate) {
    return {
      tone: hasOverduePlanUpdate ? 'danger' : 'warning',
      title: hasOverduePlanUpdate
        ? '未反映の計画更新が期限を超過しています'
        : '未反映の計画更新があります',
      description: '会議で生成された更新案をレビューし、必要に応じて計画へ反映してください。',
      ctaLabel: '更新案を確認',
      href: planningSheetId ? `/support-planning-sheet/${planningSheetId}?tab=planning` : '',
      hidden: false,
      alerts: [],
    };
  }

  if (phase === 'needs_plan') {
    return {
      tone: 'info',
      title: '支援手順を設計してください',
      description: '手順ステップを追加してDailyスケジュールへ反映できます。',
      ctaLabel: '手順を追加',
      href: '', // 同じ画面なので遷移なし
      hidden: false,
      alerts: [],
    };
  }

  // 手順がある場合
  return {
    tone: 'success',
    title: '反映した手順をDailyで確認できます',
    description: '日次記録から支援の実施状況を確認してください。',
    ctaLabel: 'Dailyで確認',
    href: `/daily/support?userId=${userId}`,
    hidden: false,
    alerts: [],
  };
}

// ─────────────────────────────────────────────
// Main function (pure)
// ─────────────────────────────────────────────

/**
 * 画面別のバナー表示内容を決定する。
 *
 * @param input - 判定入力
 * @returns バナーモデル（hidden: true なら非表示）
 */
export function resolveNextStepBanner(
  input: ResolveNextStepInput,
): NextStepBannerModel {
  const existingBanner: NextStepBannerModel = (() => {
    switch (input.context) {
      case 'overview':
        return resolveOverview(input);
      case 'monitoring':
        return resolveMonitoring(input);
      case 'reassessment':
        return resolveReassessment(input);
      case 'planning':
        return resolvePlanning(input);
      default:
        return HIDDEN_BANNER;
    }
  })();

  const pdcaAlerts = buildPdcaAlerts(input.pdcaCycleState);
  const planUpdateAlerts = buildPlanUpdateAlerts(input);

  return {
    ...existingBanner,
    alerts: [...existingBanner.alerts, ...planUpdateAlerts, ...pdcaAlerts],
  };
}
