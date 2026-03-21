/**
 * @fileoverview 例外検出ロジック（純粋関数）
 * @description
 * MVP-006: Control Layer の土台コンポーネント。
 *
 * 管理者向けに「どこで詰まっているか」を可視化するための例外データモデル。
 *
 * 例外カテゴリ:
 * - missing-record: 日次記録の未入力
 * - overdue-plan: 支援計画の期限超過
 * - critical-handoff: 重要申し送りの未対応
 * - attention-user: 注意が必要な利用者
 */

// ─── 型定義 ──────────────────────────────────────────────────

export type ExceptionCategory =
  | 'missing-record'
  | 'overdue-plan'
  | 'critical-handoff'
  | 'attention-user'
  | 'corrective-action';

export type ExceptionSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ExceptionItem = {
  id: string;
  category: ExceptionCategory;
  severity: ExceptionSeverity;
  title: string;
  description: string;
  targetUser?: string;
  targetUserId?: string;
  targetDate?: string;
  updatedAt: string;
  actionLabel?: string;
  actionPath?: string;
  /** Action Engine 提案の安定ID（dismiss/snooze 追跡用） */
  stableId?: string;
};

// ─── カテゴリ表示情報 ────────────────────────────────────────

export type CategoryMeta = {
  label: string;
  icon: string;
  color: string;
};

export const EXCEPTION_CATEGORIES: Record<ExceptionCategory, CategoryMeta> = {
  'missing-record': { label: '未入力記録', icon: '📝', color: '#e53935' },
  'overdue-plan': { label: '期限超過', icon: '⏰', color: '#f57c00' },
  'critical-handoff': { label: '重要申し送り', icon: '🔴', color: '#d32f2f' },
  'attention-user': { label: '注意対象', icon: '⚠️', color: '#ed6c02' },
  'corrective-action': { label: '改善提案', icon: '🔧', color: '#1565c0' },
};

export const SEVERITY_ORDER: Record<ExceptionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ─── 例外検出（純粋関数） ───────────────────────────────────

export type DailyRecordSummary = {
  userId: string;
  userName: string;
  date: string;
  status: string;
};

export type HandoffSummaryItem = {
  id: string;
  message: string;
  severity: string;
  status: string;
  userName?: string;
  userId?: string;
  createdAt: string;
};

export type UserSummary = {
  userId: string;
  userName: string;
  isHighIntensity: boolean;
  isSupportProcedureTarget: boolean;
  hasPlan: boolean;
};

/**
 * 日次記録の未入力を検出する
 */
export function detectMissingRecords(params: {
  expectedUsers: Array<{ userId: string; userName: string }>;
  existingRecords: DailyRecordSummary[];
  targetDate: string;
}): ExceptionItem[] {
  const { expectedUsers, existingRecords, targetDate } = params;
  const recordedUserIds = new Set(
    existingRecords
      .filter((r) => r.date === targetDate)
      .map((r) => r.userId),
  );

  return expectedUsers
    .filter((u) => !recordedUserIds.has(u.userId))
    .map((u) => ({
      id: `missing-${u.userId}-${targetDate}`,
      category: 'missing-record' as const,
      severity: 'high' as const,
      title: `${u.userName}の記録が未入力`,
      description: `${targetDate} の日次記録が作成されていません`,
      targetUser: u.userName,
      targetUserId: u.userId,
      targetDate,
      updatedAt: targetDate,
      actionLabel: '記録を作成',
      actionPath: `/daily/activity?userId=${encodeURIComponent(u.userId)}`,
    }));
}

/**
 * 重要申し送りの未対応を検出する
 */
export function detectCriticalHandoffs(
  handoffs: HandoffSummaryItem[],
): ExceptionItem[] {
  return handoffs
    .filter((h) => h.severity === '重要' && h.status !== '完了' && h.status !== '確認済')
    .map((h) => ({
      id: `handoff-${h.id}`,
      category: 'critical-handoff' as const,
      severity: 'critical' as const,
      title: '重要な申し送りが未対応',
      description: h.message.length > 60 ? `${h.message.slice(0, 60)}…` : h.message,
      targetUser: h.userName,
      targetUserId: h.userId,
      updatedAt: h.createdAt,
      actionLabel: '確認する',
      actionPath: '/handoff/timeline',
    }));
}

/**
 * 注意が必要な利用者を検出する
 */
export function detectAttentionUsers(
  users: UserSummary[],
): ExceptionItem[] {
  const exceptions: ExceptionItem[] = [];

  for (const u of users) {
    if (u.isHighIntensity && !u.hasPlan) {
      exceptions.push({
        id: `attention-${u.userId}-no-plan`,
        category: 'attention-user',
        severity: 'high',
        title: `${u.userName}: 強度行動障害対象者の計画未作成`,
        description: '個別支援計画書を早急に作成してください',
        targetUser: u.userName,
        targetUserId: u.userId,
        updatedAt: new Date().toISOString().split('T')[0],
        actionLabel: '計画を作成',
        actionPath: `/isp-editor/${encodeURIComponent(u.userId)}`,
      });
    }
  }

  return exceptions;
}

/**
 * 全カテゴリの例外を集約してソートする
 */
export function aggregateExceptions(
  ...groups: ExceptionItem[][]
): ExceptionItem[] {
  const all = groups.flat();
  return all.sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    || a.category.localeCompare(b.category),
  );
}

// ─── 統計 ─────────────────────────────────────────────────

export type ExceptionStats = {
  total: number;
  bySeverity: Record<ExceptionSeverity, number>;
  byCategory: Record<ExceptionCategory, number>;
};

export function computeExceptionStats(items: ExceptionItem[]): ExceptionStats {
  const stats: ExceptionStats = {
    total: items.length,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    byCategory: { 'missing-record': 0, 'overdue-plan': 0, 'critical-handoff': 0, 'attention-user': 0, 'corrective-action': 0 },
  };

  for (const item of items) {
    stats.bySeverity[item.severity]++;
    stats.byCategory[item.category]++;
  }

  return stats;
}
