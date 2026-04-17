/**
 * @fileoverview 是正アクションエンジン（純粋関数）
 * @description
 * MVP-012: Sprint 3 Priority 1
 *
 * ExceptionItem を受け取り「今すぐ取れる是正アクション候補」を返す。
 *
 * 設計原則:
 * - UI 非依存 / React 非依存 / 副作用なし
 * - ExceptionCategory ごとに定型アクションを定義
 * - severity によって一部アクションの表示強調度を変える
 * - 将来の「カスタムアクション」拡張に備えた open/closed 設計
 */

import type { ExceptionItem, ExceptionCategory, ExceptionSeverity } from './exceptionLogic';

// ─── 型定義 ──────────────────────────────────────────────────────

export type CorrectiveActionVariant = 'primary' | 'secondary' | 'ghost';

export type CorrectiveAction = {
  /** アクションの一意キー */
  key: string;
  /** ボタン表示ラベル */
  label: string;
  /** 遷移先ルート (router-link 相当) */
  route: string;
  /** 視覚上の強調度 */
  variant: CorrectiveActionVariant;
  /** アクションの緊急度 (ボタンカラーに使用) */
  severity: ExceptionSeverity;
  /** アイコン文字 */
  icon: string;
  /** このアクションが有効な理由 (ツールチップ等に利用) */
  reason: string;
};

// ─── カテゴリ別 是正アクション定義 ─────────────────────────────

/**
 * カテゴリ × userId ごとの定型アクションテンプレート
 */
const CORRECTIVE_ACTION_MAP: Record<
  ExceptionCategory,
  (item: ExceptionItem) => CorrectiveAction[]
> = {
  'missing-record': (item) => {
    // userId を actionPath から抽出 (例: /daily/activity?userId=U-001)
    const userId = extractUserId(item.actionPath ?? '');
    const primaryRoute = item.actionPath
      ?? (userId
        ? `/daily/activity?userId=${encodeURIComponent(userId)}`
        : '/dailysupport');
    return [
      {
        key: `${item.id}-record`,
        label: '記録を入力する',
        route: primaryRoute,
        variant: 'primary',
        severity: 'high',
        icon: '📝',
        reason: '日々の記録が未作成です。すぐに作成してください。',
      },
      {
        key: `${item.id}-hub`,
        label: '利用者ハブを開く',
        route: userId ? `/users/${encodeURIComponent(userId)}` : '/users',
        variant: 'ghost',
        severity: 'medium',
        icon: '👤',
        reason: '利用者の状況を確認してから記録を入力できます。',
      },
    ];
  },

  'overdue-plan': (item) => {
    const userId = extractUserId(item.actionPath ?? '');
    return [
      {
        key: `${item.id}-plan`,
        label: '支援計画を作成する',
        route: userId
          ? `/isp-editor/${encodeURIComponent(userId)}`
          : '/planning',
        variant: 'primary',
        severity: 'high',
        icon: '📋',
        reason: '個別支援計画書の作成が必要です。',
      },
      {
        key: `${item.id}-hub`,
        label: '利用者ハブを開く',
        route: userId ? `/users/${encodeURIComponent(userId)}` : '/users',
        variant: 'ghost',
        severity: 'low',
        icon: '👤',
        reason: '利用者の現在の状況を確認できます。',
      },
    ];
  },

  'critical-handoff': (item) => {
    const userId = item.targetUserId;
    return [
      {
        key: `${item.id}-handoff`,
        label: '申し送りを確認する',
        route: item.actionPath ?? '/handoff-timeline',
        variant: 'primary',
        severity: 'critical',
        icon: '🔴',
        reason: '重要な申し送りが未対応のままです。今すぐ確認してください。',
      },
      {
        key: `${item.id}-record`,
        label: '対応記録を残す',
        route: userId
          ? `/daily/activity?userId=${encodeURIComponent(userId)}`
          : '/daily/activity',
        variant: 'secondary',
        severity: 'high',
        icon: '📝',
        reason: '対応内容を日々の記録へ残しておくことを推奨します。',
      },
    ];
  },

  'attention-user': (item) => {
    const userId = extractUserId(item.actionPath ?? '');
    return [
      {
        key: `${item.id}-plan`,
        label: '支援手順書を確認する',
        route: userId
          ? `/isp-editor/${encodeURIComponent(userId)}`
          : '/planning',
        variant: 'primary',
        severity: 'high',
        icon: '📋',
        reason: '強度行動障害対象者は支援手順書に基づいた対応が必要です。',
      },
      {
        key: `${item.id}-hub`,
        label: '利用者の詳細を見る',
        route: userId ? `/users/${encodeURIComponent(userId)}` : '/users',
        variant: 'secondary',
        severity: 'medium',
        icon: '👤',
        reason: '利用者の全体状況を把握したうえで対応を検討してください。',
      },
    ];
  },

  'corrective-action': (item) => {
    const userId = extractUserId(item.actionPath ?? '');
    return [
      {
        key: `${item.id}-action`,
        label: item.actionLabel ?? '改善アクションを開始',
        route: item.actionPath ?? '/assessment',
        variant: 'primary',
        severity: item.severity,
        icon: '🔧',
        reason: item.description || 'Action Engine が改善提案を検出しました。',
      },
      ...(userId
        ? [
            {
              key: `${item.id}-hub`,
              label: '利用者の詳細を見る',
              route: `/users/${encodeURIComponent(userId)}`,
              variant: 'ghost' as CorrectiveActionVariant,
              severity: 'low' as ExceptionSeverity,
              icon: '👤',
              reason: '利用者の全体状況を確認してから対応できます。',
            },
          ]
        : []),
    ];
  },

  'transport-alert': (item) => [
    {
      key: `${item.id}-check`,
      label: item.actionLabel ?? '送迎状況を確認',
      route: item.actionPath ?? '/today',
      variant: 'primary',
      severity: item.severity,
      icon: '🚐',
      reason: item.description || '送迎の運用異常が検出されました。',
    },
    {
      key: `${item.id}-telemetry`,
      label: 'テレメトリを確認',
      route: '/admin/telemetry',
      variant: 'ghost',
      severity: 'low',
      icon: '📊',
      reason: 'テレメトリダッシュボードで詳細な状況を確認できます。',
    },
  ],
  'procedure-unperformed': (item) => [
    {
      key: `${item.id}-procedure`,
      label: '実施記録を入力',
      route: item.actionPath ?? '/daily/activity',
      variant: 'primary',
      severity: 'high',
      icon: '⚡',
      reason: '配備された支援手順の実施記録が未完了です。',
    },
  ],
  'risk-deviation': (item) => [
    {
      key: `${item.id}-risk`,
      label: 'リスク状況を確認',
      route: item.actionPath ?? '/daily/activity',
      variant: 'primary',
      severity: 'critical',
      icon: '🚨',
      reason: '計画されたリスク回避手順からの逸脱が検出されました。',
    },
  ],
  'focus-missing': (item) => [
    {
      key: `${item.id}-focus`,
      label: '観察記述を追記',
      route: item.actionPath ?? '/daily/activity',
      variant: 'primary',
      severity: 'high',
      icon: '✍️',
      reason: '重点観察項目に対する具体的な記述が不足しています。',
    },
  ],
  'data-os-alert': (item) => [
    {
      key: `${item.id}-status`,
      label: 'システムステータスを確認',
      route: '/admin/status',
      variant: 'primary',
      severity: 'medium',
      icon: '📊',
      reason: 'データレイヤーの異常を修正または確認してください。',
    },
  ],
  'missing-vital': (item) => {
    return [
      {
        key: `${item.id}-vital`,
        label: 'バイタルを入力する',
        route: item.actionPath ?? '/nurse/observation/bulk',
        variant: 'primary',
        severity: 'high',
        icon: '🌡️',
        reason: 'バイタル計測が未完了です。一括入力画面から登録できます。',
      },
      {
        key: `${item.id}-list`,
        label: '一括入力画面へ',
        route: '/nurse/observation/bulk',
        variant: 'ghost',
        severity: 'medium',
        icon: '📋',
        reason: 'バイタル計測状況を一覧で確認できます。',
      },
    ];
  },
  'setup-incomplete': (item) => [
    {
      key: `${item.id}-setup`,
      label: item.actionLabel ?? '設定ガイドを確認',
      route: item.actionPath ?? '/admin/status',
      variant: 'primary',
      severity: item.severity,
      icon: '⚙️',
      reason: item.description || '初期設定の不足が検出されました。ガイドに沿って設定を完了してください。',
    },
  ],
  'isp-recommendation': (item) => {
    const userId = extractUserId(item.actionPath ?? '');
    return [
      {
        key: `${item.id}-isp`,
        label: '支援計画を改善する',
        route: userId ? `/isp-editor/${encodeURIComponent(userId)}` : '/planning',
        variant: 'primary',
        severity: 'high',
        icon: '📋',
        reason: '現在の支援状況に基づき、計画の見直しを推奨します。',
      },
      {
        key: `${item.id}-hub`,
        label: '利用者の詳細を見る',
        route: userId ? `/users/${encodeURIComponent(userId)}` : '/users',
        variant: 'secondary',
        severity: 'medium',
        icon: '👤',
        reason: '利用者の全体状況を確認してから対応を検討してください。',
      },
    ];
  },
};

// ─── ユーティリティ ───────────────────────────────────────────

/**
 * actionPath から userId を抽出するヘルパー
 * /daily/activity?userId=U-001 → "U-001"
 * /isp-editor/U-001 → "U-001"
 * /users/U-001 → "U-001"
 */
export function extractUserId(path: string): string | null {
  // 1. クエリパラメータからの抽出（最優先）
  const qsMatch = path.match(/[?&]userId=([^&]+)/);
  if (qsMatch) return decodeURIComponent(qsMatch[1]);

  // 2. 既知のパターン: /isp-editor/:id または /users/:id
  const knownPatternMatch = path.match(/\/(?:isp-editor|users)\/([^/?#]+)/);
  if (knownPatternMatch) return decodeURIComponent(knownPatternMatch[1]);

  return null;
}

// ─── 純粋関数 ────────────────────────────────────────────────

/**
 * ExceptionItem に対する是正アクション候補を返す
 *
 * @param item - 対象の例外アイテム
 * @returns 優先度順の是正アクション配列 (primary が先頭)
 */
export function buildCorrectiveActions(item: ExceptionItem): CorrectiveAction[] {
  const builder = CORRECTIVE_ACTION_MAP[item.category];
  if (!builder) return [];

  const actions = builder(item);

  // variant 優先順でソート: primary > secondary > ghost
  const ORDER: Record<CorrectiveActionVariant, number> = { primary: 0, secondary: 1, ghost: 2 };
  return actions.sort((a, b) => ORDER[a.variant] - ORDER[b.variant]);
}

/**
 * 複数の ExceptionItem に対してアクションをまとめて生成する
 *
 * @param items - 例外アイテムのリスト
 * @returns item ごとのアクションマップ
 */
export function buildAllCorrectiveActions(
  items: ExceptionItem[],
): Map<string, CorrectiveAction[]> {
  const map = new Map<string, CorrectiveAction[]>();
  for (const item of items) {
    map.set(item.id, buildCorrectiveActions(item));
  }
  return map;
}

/**
 * 全例外をまたいで「最も優先すべき是正アクション」を1件返す
 * (Today の ActionQueue や UserHub のスナップショットで使用する想定)
 *
 * @param items - severity でソート済みの例外アイテム
 * @returns 最優先是正アクション (存在しない場合は null)
 */
export function pickTopCorrectiveAction(items: ExceptionItem[]): CorrectiveAction | null {
  for (const item of items) {
    const actions = buildCorrectiveActions(item);
    const primary = actions.find((a) => a.variant === 'primary');
    if (primary) return primary;
  }
  return null;
}
