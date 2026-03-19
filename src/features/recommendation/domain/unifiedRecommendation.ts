/**
 * @fileoverview 統合推奨エンジン（純粋関数）
 * @description
 * MVP-013: Sprint 3 Priority 2
 *
 * ContextPanel / UserHub / Today の3画面をまたぐ推奨を
 * 1つの pure function に集約し、「今日この利用者に注意すべき1点」を
 * 1文で返す。
 *
 * 設計原則:
 * - 入力は各ドメインの既存型をそのまま受け取る（型変換なし）
 * - 画面間で文脈が途切れないよう統一された出力型を定義
 * - UI 非依存 / React 非依存 / 副作用なし
 * - Today / UserHub / DailyRecord のどの画面からも同じ関数を呼べる
 */

import type { ContextAlert } from '@/features/context/domain/contextPanelLogic';

/**
 * TodayUserSnapshot の必要フィールドのみ抽出したローカル型
 * PR #1049 (UserHub 深化) が main にマージされたら
 * import type { TodayUserSnapshot } from '@/features/users/domain/userDetailHubLogic'
 * に置き換える
 */
type TodaySnapshotRef = {
  nextAction: string;
  nextActionPath: string;
  urgency: 'high' | 'medium' | 'low';
};

// ─── 型定義 ──────────────────────────────────────────────────────

export type RecommendationUrgency = 'critical' | 'high' | 'medium' | 'low';

export type UnifiedRecommendation = {
  /** 「今日この利用者に注意すべき1点」を1文で表現 */
  headline: string;
  /** 推奨の根拠となった主要ファクター */
  primaryFactor: RecommendationFactor;
  /** urgency レベル (UI カラーリングに使用) */
  urgency: RecommendationUrgency;
  /** 推奨アクション (ContextPanel / UserHub のバナーに表示) */
  suggestedAction: string;
  /** 推奨アクションの遷移先 */
  actionRoute: string;
  /** 副次的な注意事項 (最大2件) */
  secondaryNotes: string[];
};

export type RecommendationFactor =
  | 'critical-handoff'      // 重要申し送り未対応
  | 'missing-record'        // 当日記録未入力
  | 'missing-plan'          // ISP 未作成
  | 'high-intensity'        // 強度行動障害対象
  | 'snapshot-urgent'       // TodaySnapshot の urgency が high
  | 'no-issues';            // 特記なし

// ─── 入力型 ──────────────────────────────────────────────────────

export type UnifiedRecommendationInput = {
  userId: string;
  /** ContextPanel のアラート (prioritizeContextAlerts 後の配列) */
  contextAlerts: ContextAlert[];
  /** UserHub の今日スナップショット (null = 未接続) */
  todaySnapshot: TodaySnapshotRef | null;
  /** 今日の記録が入力済みか */
  hasRecordToday: boolean;
  /** 重要申し送りの未対応件数 */
  criticalHandoffCount: number;
  /** ISP が存在するか */
  hasPlan: boolean;
  /** 強度行動障害対象者か */
  isHighIntensity: boolean;
};

// ─── 定数 ─────────────────────────────────────────────────────────

/** factor → urgency のマッピング */
const FACTOR_URGENCY: Record<RecommendationFactor, RecommendationUrgency> = {
  'critical-handoff': 'critical',
  'missing-record': 'high',
  'high-intensity': 'high',
  'snapshot-urgent': 'high',
  'missing-plan': 'medium',
  'no-issues': 'low',
};

/** factor → headline テンプレート */
const FACTOR_HEADLINE: Record<RecommendationFactor, string> = {
  'critical-handoff': '重要な申し送りが未対応です — 今すぐ確認してください',
  'missing-record': '本日の記録がまだ入力されていません',
  'high-intensity': '強度行動障害対象者です — 支援手順に従って対応してください',
  'snapshot-urgent': '今日の対応が必要な事項があります',
  'missing-plan': '個別支援計画書が未作成です',
  'no-issues': '今日の対応に特記事項はありません',
};

/** factor → 推奨アクション */
const FACTOR_ACTION: Record<RecommendationFactor, { label: string; route: string }> = {
  'critical-handoff': { label: '申し送りを確認する', route: '/handoff/timeline' },
  'missing-record': { label: '記録を入力する', route: '/daily/activity' },
  'high-intensity': { label: '支援手順書を確認する', route: '/planning' },
  'snapshot-urgent': { label: '今日の画面を確認する', route: '/today' },
  'missing-plan': { label: '支援計画を作成する', route: '/planning' },
  'no-issues': { label: '今日の記録を開く', route: '/daily/activity' },
};

// ─── 純粋関数 ────────────────────────────────────────────────────

/**
 * contextAlerts から最も重要なファクターを判定する
 */
function detectFactorFromAlerts(alerts: ContextAlert[]): RecommendationFactor | null {
  // error level → critical-handoff / warning level → high-intensity / missing-plan
  for (const alert of alerts) {
    if (alert.level === 'error' && alert.key === 'critical-handoff') return 'critical-handoff';
    if (alert.level === 'warning' && alert.key === 'high-intensity') return 'high-intensity';
    if (alert.level === 'warning' && alert.key === 'isp-missing') return 'missing-plan';
  }
  return null;
}

/**
 * 副次的な注意事項を収集する（最大 2 件）
 */
function collectSecondaryNotes(
  input: UnifiedRecommendationInput,
  primaryFactor: RecommendationFactor,
): string[] {
  const notes: string[] = [];

  if (primaryFactor !== 'critical-handoff' && input.criticalHandoffCount > 0) {
    notes.push(`重要申し送りが${input.criticalHandoffCount}件あります`);
  }
  if (primaryFactor !== 'missing-record' && !input.hasRecordToday) {
    notes.push('本日の記録が未入力です');
  }
  if (primaryFactor !== 'missing-plan' && !input.hasPlan) {
    notes.push('個別支援計画書が未作成です');
  }
  if (primaryFactor !== 'high-intensity' && input.isHighIntensity) {
    notes.push('強度行動障害対象者です');
  }

  return notes.slice(0, 2);
}

/**
 * 3 画面統合推奨を生成する
 *
 * 優先度ロジック:
 * 1. critical-handoff  (最優先: 重要申し送り未対応)
 * 2. missing-record    (本日記録未入力)
 * 3. high-intensity    (強度行動障害 = 支援手順確認が常に必要)
 * 4. snapshot-urgent   (TodaySnapshot の urgency が high)
 * 5. missing-plan      (ISP 未作成)
 * 6. no-issues         (特記なし)
 *
 * @param input - 3 画面から集約したコンテキスト情報
 * @returns 統合推奨オブジェクト
 */
export function buildUnifiedRecommendation(
  input: UnifiedRecommendationInput,
): UnifiedRecommendation {
  // 1. アラートから最重要ファクターを検出
  const alertFactor = detectFactorFromAlerts(input.contextAlerts);

  // 2. 手動シグナルと組み合わせて最終 factor を決定
  let primaryFactor: RecommendationFactor;

  if (input.criticalHandoffCount > 0) {
    primaryFactor = 'critical-handoff';
  } else if (!input.hasRecordToday) {
    primaryFactor = 'missing-record';
  } else if (input.isHighIntensity) {
    primaryFactor = 'high-intensity';
  } else if (input.todaySnapshot?.urgency === 'high') {
    primaryFactor = 'snapshot-urgent';
  } else if (!input.hasPlan) {
    primaryFactor = 'missing-plan';
  } else if (alertFactor) {
    primaryFactor = alertFactor;
  } else {
    primaryFactor = 'no-issues';
  }

  const action = FACTOR_ACTION[primaryFactor];

  // route に userId を埋め込む (記録入力系はユーザー固定)
  const resolvedRoute =
    primaryFactor === 'missing-record'
      ? `/daily/activity?userId=${encodeURIComponent(input.userId)}`
      : action.route;

  return {
    headline: FACTOR_HEADLINE[primaryFactor],
    primaryFactor,
    urgency: FACTOR_URGENCY[primaryFactor],
    suggestedAction: action.label,
    actionRoute: resolvedRoute,
    secondaryNotes: collectSecondaryNotes(input, primaryFactor),
  };
}

/**
 * 複数利用者分の推奨を一括生成する（Today 画面の ActionQueue 連携想定）
 *
 * @param inputs - userId ごとの入力配列
 * @returns userId → UnifiedRecommendation のマップ
 */
export function buildUnifiedRecommendations(
  inputs: UnifiedRecommendationInput[],
): Map<string, UnifiedRecommendation> {
  const map = new Map<string, UnifiedRecommendation>();
  for (const input of inputs) {
    map.set(input.userId, buildUnifiedRecommendation(input));
  }
  return map;
}
