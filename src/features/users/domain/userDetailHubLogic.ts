/**
 * @fileoverview UserDetailHub のビジネスロジック（純粋関数）
 * @description
 * MVP-003: UserDetailPage を「利用者起点ハブ」に変換するためのロジック。
 *
 * Quick Actions: 利用者に対して実行できる主要導線
 * Summary Stats: 利用者の現在の状況サマリ
 */

// ─── Quick Actions 定義 ───────────────────────────────────────

export type QuickAction = {
  key: string;
  label: string;
  description: string;
  icon: string;         // emoji
  path: string;         // 遷移先URL
  color: 'primary' | 'secondary' | 'warning' | 'success' | 'info';
};

/**
 * 利用者IDに基づくクイックアクション一覧を生成
 */
export function buildQuickActions(userId: string): QuickAction[] {
  return [
    {
      key: 'today-record',
      label: '今日の記録',
      description: '本日の日次記録を入力・編集する',
      icon: '📝',
      path: `/daily/activity?userId=${encodeURIComponent(userId)}`,
      color: 'primary',
    },
    {
      key: 'handoff',
      label: '申し送り',
      description: '引き継ぎ情報を確認・追加する',
      icon: '📨',
      path: `/handoff/timeline?userId=${encodeURIComponent(userId)}`,
      color: 'warning',
    },
    {
      key: 'support-plan',
      label: '支援計画',
      description: '個別支援計画書を参照する',
      icon: '📋',
      path: `/users?tab=list&selected=${encodeURIComponent(userId)}`,
      color: 'secondary',
    },
    {
      key: 'record-history',
      label: '記録一覧',
      description: 'タイムラインで履歴を確認する',
      icon: '📊',
      path: `/users?tab=list&selected=${encodeURIComponent(userId)}`,
      color: 'info',
    },
  ];
}

// ─── Summary Stats 定義 ──────────────────────────────────────

export type SummaryStat = {
  key: string;
  label: string;
  value: string | number;
  icon: string;
  severity: 'normal' | 'attention' | 'good';
};

export type DailyRecordInfo = {
  date: string;
  status: string;
};

export type HandoffInfo = {
  total: number;
  criticalCount: number;
};

/**
 * 利用者のサマリー統計を計算する純粋関数
 */
export function buildSummaryStats(params: {
  latestDailyRecord?: DailyRecordInfo | null;
  todayRecordExists: boolean;
  handoffInfo?: HandoffInfo | null;
  isHighIntensity: boolean;
}): SummaryStat[] {
  const { latestDailyRecord, todayRecordExists, handoffInfo, isHighIntensity } = params;

  const stats: SummaryStat[] = [];

  // 今日の記録ステータス
  stats.push({
    key: 'today-record',
    label: '今日の記録',
    value: todayRecordExists ? '入力済み' : '未入力',
    icon: todayRecordExists ? '✅' : '⚠️',
    severity: todayRecordExists ? 'good' : 'attention',
  });

  // 最新記録日
  stats.push({
    key: 'latest-record',
    label: '最新記録日',
    value: latestDailyRecord?.date ?? '—',
    icon: '📅',
    severity: latestDailyRecord ? 'normal' : 'attention',
  });

  // 申し送り件数
  if (handoffInfo) {
    const critical = handoffInfo.criticalCount > 0;
    stats.push({
      key: 'handoff',
      label: '申し送り',
      value: `${handoffInfo.total}件${critical ? ` (重要${handoffInfo.criticalCount}件)` : ''}`,
      icon: critical ? '🔴' : '📨',
      severity: critical ? 'attention' : 'normal',
    });
  }

  // 支援区分
  stats.push({
    key: 'support-level',
    label: '支援区分',
    value: isHighIntensity ? '強度行動障害対象' : '通常支援',
    icon: isHighIntensity ? '🟠' : '🟢',
    severity: isHighIntensity ? 'attention' : 'normal',
  });

  return stats;
}

// ─── MVP-010: UserHub 深化 — プレビュー型定義 ──────────────────

export type RecordPreviewItem = {
  date: string;
  status: string;
  hasSpecialNote: boolean;
  noteExcerpt?: string;   // 特記事項の先頭60文字
};

export type HandoffPreviewItem = {
  id: string;
  message: string;   // 先頭80文字
  severity: string;
  status: string;
  createdAt: string;
};

export type TodayUserSnapshot = {
  hasRecordToday: boolean;
  nextAction: string;    // 「今日やること」1行メッセージ
  nextActionPath: string;
  urgency: 'high' | 'medium' | 'low';
};

export type PlanHighlight = {
  type: 'long' | 'short' | 'support';
  label: string;
  excerpt: string;   // 目標テキスト先頭70文字
};

// ─── MVP-010: 純粋関数群 ────────────────────────────────────────

/**
 * 直近の日次記録を Hub 表示用プレビューに変換する
 */
export function buildRecentRecordPreview(
  records: Array<{
    date: string;
    status: string;
    specialNotes?: string;
  }>,
  limit = 3,
): RecordPreviewItem[] {
  return records
    .slice(0, limit)
    .map((r) => ({
      date: r.date,
      status: r.status,
      hasSpecialNote: !!r.specialNotes,
      noteExcerpt: r.specialNotes
        ? r.specialNotes.length > 60
          ? `${r.specialNotes.slice(0, 60)}…`
          : r.specialNotes
        : undefined,
    }));
}

/**
 * 直近の申し送りを Hub 表示用プレビューに変換する
 * 重要度の高いものを先頭に寄せる
 */
export function buildRecentHandoffPreview(
  handoffs: Array<{
    id: string;
    message: string;
    severity: string;
    status: string;
    createdAt: string;
  }>,
  limit = 3,
): HandoffPreviewItem[] {
  const sorted = [...handoffs].sort((a, b) => {
    // 重要 → 通常 の順
    if (a.severity === '重要' && b.severity !== '重要') return -1;
    if (b.severity === '重要' && a.severity !== '重要') return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return sorted.slice(0, limit).map((h) => ({
    id: h.id,
    message: h.message.length > 80 ? `${h.message.slice(0, 80)}…` : h.message,
    severity: h.severity,
    status: h.status,
    createdAt: h.createdAt,
  }));
}

/**
 * 今日の利用者状態スナップショットと次のアクションを生成する
 */
export function buildTodayUserSnapshot(params: {
  userId: string;
  hasRecordToday: boolean;
  hasCriticalHandoff: boolean;
  hasPlan: boolean;
}): TodayUserSnapshot {
  const { userId, hasRecordToday, hasCriticalHandoff, hasPlan } = params;

  if (hasCriticalHandoff) {
    return {
      hasRecordToday,
      nextAction: '🔴 重要な申し送りを確認してください',
      nextActionPath: `/handoff/timeline?userId=${encodeURIComponent(userId)}`,
      urgency: 'high',
    };
  }
  if (!hasRecordToday) {
    return {
      hasRecordToday: false,
      nextAction: '📝 今日の記録を入力してください',
      nextActionPath: `/daily/activity?userId=${encodeURIComponent(userId)}`,
      urgency: 'medium',
    };
  }
  if (!hasPlan) {
    return {
      hasRecordToday: true,
      nextAction: '📋 個別支援計画書を作成してください',
      nextActionPath: `/users?tab=list&selected=${encodeURIComponent(userId)}`,
      urgency: 'medium',
    };
  }
  return {
    hasRecordToday: true,
    nextAction: '✅ 本日の対応は完了しています',
    nextActionPath: `/daily/activity?userId=${encodeURIComponent(userId)}`,
    urgency: 'low',
  };
}

/**
 * 支援計画の目標から Hub 表示用ハイライトを抽出する
 */
export function buildPlanHighlights(
  goals: Array<{
    type: 'long' | 'short' | 'support';
    label: string;
    text: string;
  }>,
  limit = 3,
): PlanHighlight[] {
  // short → support → long の優先順
  const priorityOrder: Record<string, number> = { short: 0, support: 1, long: 2 };
  return [...goals]
    .sort((a, b) => (priorityOrder[a.type] ?? 9) - (priorityOrder[b.type] ?? 9))
    .slice(0, limit)
    .map((g) => ({
      type: g.type,
      label: g.label,
      excerpt: g.text.length > 70 ? `${g.text.slice(0, 70)}…` : g.text || '内容未設定',
    }));
}
