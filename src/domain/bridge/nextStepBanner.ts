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
};

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
      };

    case 'needs_reassessment':
      return {
        tone: 'warning',
        title: '再評価結果が計画に未反映です',
        description: '再評価の内容を計画に反映してください。',
        ctaLabel: '再評価を確認',
        href: `/support-planning-sheet/${planningSheetId}?tab=reassessment`,
        hidden: false,
      };

    case 'needs_monitoring':
      return {
        tone: 'warning',
        title: 'モニタリング時期が近づいています',
        description: 'モニタリングの準備を進めてください。',
        ctaLabel: 'モニタリングを確認',
        href: `/support-planning-sheet/${planningSheetId}?tab=monitoring`,
        hidden: false,
      };

    case 'needs_plan':
      return {
        tone: 'info',
        title: '支援手順が未設計です',
        description: '支援設計タブで手順を作成してください。',
        ctaLabel: '支援設計を続ける',
        href: `/support-planning-sheet/${planningSheetId}?tab=planning`,
        hidden: false,
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
    };
  }

  return {
    tone: 'success',
    title: '大きな見直し候補はありません',
    description: '必要に応じて再評価タブで確認できます。',
    ctaLabel: '再評価を確認',
    href: `/support-planning-sheet/${planningSheetId}?tab=reassessment`,
    hidden: false,
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
    };
  }

  return {
    tone: 'info',
    title: 'モニタリング結果を反映できます',
    description: 'モニタリングが完了している場合、結果を再評価に反映できます。',
    ctaLabel: '反映内容を確認',
    href: `/support-planning-sheet/${planningSheetId}?tab=monitoring`,
    hidden: false,
  };
}

function resolvePlanning(input: ResolveNextStepInput): NextStepBannerModel {
  const { userId, phase } = input;

  if (phase === 'needs_plan') {
    return {
      tone: 'info',
      title: '支援手順を設計してください',
      description: '手順ステップを追加してDailyスケジュールへ反映できます。',
      ctaLabel: '手順を追加',
      href: '', // 同じ画面なので遷移なし
      hidden: false,
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
}
