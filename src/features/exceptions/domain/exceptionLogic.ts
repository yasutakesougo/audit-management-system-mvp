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
  | 'corrective-action'
  | 'transport-alert'
  | 'data-os-alert'
  | 'procedure-unperformed'
  | 'risk-deviation'
  | 'focus-missing'
  | 'missing-vital';

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
  /** セカンダリアクション（例: 支援記録確認用リンク） */
  secondaryActionLabel?: string;
  secondaryActionPath?: string;
  /** Action Engine 提案の安定ID（dismiss/snooze 追跡用） */
  stableId?: string;
  /** 親 Exception の ID（per-user 子 Exception のグループ化用） */
  parentId?: string;
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
  'transport-alert': { label: '送迎異常', icon: '🚐', color: '#7b1fa2' },
  'data-os-alert': { label: 'システム基礎データ', icon: '📡', color: '#00bcd4' },
  'procedure-unperformed': { label: '手順未実施', icon: '⚡', color: '#c62828' },
  'risk-deviation': { label: 'リスク逸脱', icon: '🚨', color: '#b71c1c' },
  'focus-missing': { label: '記述不足', icon: '✍️', color: '#ef6c00' },
  'missing-vital': { label: '未計測バイタル', icon: '🌡️', color: '#d32f2f' },
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
      title: `${u.userName}のケース記録が未入力`,
      description: `${targetDate} のケース記録（日次記録）が作成されていません`,
      targetUser: u.userName,
      targetUserId: u.userId,
      targetDate,
      updatedAt: targetDate,
      actionLabel: 'ケース記録',
      actionPath: `/daily/activity?userId=${encodeURIComponent(u.userId)}`,
      secondaryActionLabel: '支援手順記録',
      secondaryActionPath: `/daily/support?wizard=plan&user=${encodeURIComponent(u.userId)}&userId=${encodeURIComponent(u.userId)}`,
    }));
}

/**
 * バイタル（健康記録）の未入力を検出する
 */
export function detectMissingVitals(params: {
  expectedUsers: Array<{ userId: string; userName: string }>;
  existingVitals: Array<{ userId: string }>;
  targetDate: string;
}): ExceptionItem[] {
  const { expectedUsers, existingVitals, targetDate } = params;
  const recordedUserIds = new Set(existingVitals.map((v) => v.userId));

  return expectedUsers
    .filter((u) => !recordedUserIds.has(u.userId))
    .map((u) => ({
      id: `missing-vital-${u.userId}-${targetDate}`,
      category: 'missing-vital' as const,
      severity: 'high' as const,
      title: `${u.userName}のバイタルが未計測`,
      description: `${targetDate} のバイタル（体温・血圧等）が記録されていません`,
      targetUser: u.userName,
      targetUserId: u.userId,
      targetDate,
      updatedAt: targetDate,
      actionLabel: 'バイタル入力',
      actionPath: `/nurse/observation?user=${encodeURIComponent(u.userId)}`,
      secondaryActionLabel: '一覧入力',
      secondaryActionPath: `/nurse/observation/bulk`, // 将来的にこのパスを有効にする
    }));
}

/**
 * 支援手順記録の未入力を検出する
 */
export function detectMissingSupportLogs(params: {
  pendingUsers: Array<{ userId: string; userName: string }>;
  targetDate: string;
}): ExceptionItem[] {
  const { pendingUsers, targetDate } = params;

  return pendingUsers.map((u) => ({
    id: `missing-support-${u.userId}-${targetDate}`,
    category: 'missing-record' as const,
    severity: 'high' as const,
    title: `${u.userName}の支援手順記録が未入力`,
    description: `${targetDate} の支援手順記録が作成されていません`,
    targetUser: u.userName,
    targetUserId: u.userId,
    targetDate,
    updatedAt: targetDate,
    actionLabel: '支援手順記録',
    actionPath: `/daily/support?wizard=plan&user=${encodeURIComponent(u.userId)}&userId=${encodeURIComponent(u.userId)}`,
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
    .map((h) => {
      const dateQuery = h.createdAt.split('T')[0];
      return {
        id: `handoff-${h.id}`,
        category: 'critical-handoff' as const,
        severity: 'critical' as const,
        title: '重要な申し送りが未対応',
        description: h.message.length > 60 ? `${h.message.slice(0, 60)}…` : h.message,
        targetUser: h.userName,
        targetUserId: h.userId,
        updatedAt: h.createdAt,
        actionLabel: '確認する',
        actionPath: `/handoff/timeline?date=${dateQuery}&handoffId=${h.id}`,
      };
    });
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
 * データプロバイダーの解決状況から例外を検出する (Data OS)
 */
export function detectDataLayerExceptions(
  resolutions: Record<string, {
    resourceName: string;
    status: 'resolved' | 'missing_optional' | 'missing_required' | 'fallback_triggered' | 'schema_mismatch' | 'schema_warning' | 'pending';
    resolvedTitle: string;
    error?: string;
  }>
): ExceptionItem[] {
  return Object.values(resolutions)
    .filter(r => r.status !== 'resolved' && r.status !== 'pending' && r.status !== 'missing_optional')
    .map(r => {
      let severity: ExceptionSeverity = 'medium';
      let title = '';
      let description = '';

      switch (r.status) {
        case 'missing_required':
          severity = 'critical';
          title = `[不達] ${r.resourceName} リストが見つかりません`;
          description = `SharePoint上に必須リスト ${r.resolvedTitle} が存在しません。データの表示や保存ができません。`;
          break;
        case 'schema_mismatch':
          severity = 'high';
          title = `[スキーマ不整合] ${r.resourceName} の列が不足`;
          description = `${r.resolvedTitle} に必要な内部列が不足しています。一部のデータが保存されない可能性があります。`;
          break;
        case 'fallback_triggered':
          severity = 'medium';
          title = `[フォールバック] ${r.resourceName} は代替データを使用中`;
          description = `正式なリストが見つからないため、旧形式または代替リスト ${r.resolvedTitle} を使用しています。`;
          break;
      }

      const actionLabel = r.status === 'missing_required' ? 'プロバイダー切替' : '詳細確認・修復';
      const actionPath = `command:open-obs-panel?resource=${r.resourceName}`;

      return {
        id: `data-os-${r.resourceName}`,
        category: 'data-os-alert' as const,
        severity,
        title,
        description,
        updatedAt: new Date().toISOString(),
        actionLabel,
        actionPath,
      };
    });
}

/**
 * Exception Bridge から取得した TriggeredException を Exception Center 用の形式に変換する
 */
export function mapTriggeredToExceptionItems(
  triggered: import('@/domain/isp/exceptionBridge').TriggeredException[],
  users: import('@/features/users/types').IUserMaster[]
): ExceptionItem[] {
  return triggered.map((t) => {
    const user = users.find((u) => String(u.UserID) === t.provenance.userId);
    const categoryMap: Record<string, ExceptionCategory> = {
      unperformed: 'procedure-unperformed',
      risk_detected: 'risk-deviation',
      missing_focus: 'focus-missing',
    };

    return {
      id: t.id,
      category: categoryMap[t.category] || 'attention-user',
      severity: t.severity as ExceptionSeverity,
      title: t.title,
      description: t.reason,
      targetUser: user?.FullName,
      targetUserId: t.provenance.userId,
      updatedAt: t.provenance.detectedAt,
      actionLabel: '対応する',
      actionPath: `/daily/activity?userId=${encodeURIComponent(t.provenance.userId)}`,
      secondaryActionLabel: '詳細を確認',
      secondaryActionPath: `/individual-support/monitoring/${encodeURIComponent(t.provenance.userId)}`,
    };
  });
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
    byCategory: {
      'missing-record': 0,
      'overdue-plan': 0,
      'critical-handoff': 0,
      'attention-user': 0,
      'corrective-action': 0,
      'transport-alert': 0,
      'data-os-alert': 0,
      'procedure-unperformed': 0,
      'risk-deviation': 0,
      'focus-missing': 0,
      'missing-vital': 0
    },
  };

  for (const item of items) {
    stats.bySeverity[item.severity]++;
    stats.byCategory[item.category]++;
  }

  return stats;
}
