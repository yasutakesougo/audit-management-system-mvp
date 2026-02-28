/**
 * 申し送りタイムライン システム SharePoint列定義
 *
 * リスト名: Handoff_Timeline
 * 表示名: 申し送りタイムライン
 *
 * 現場即投入レベル v1.0 - "いつでも入力しやすい仕掛け"
 */

// ────────────────────────────────────────────────────────────
// SharePoint 列構成（内部名 / 型 / 説明）
// ────────────────────────────────────────────────────────────

export const HANDOFF_TIMELINE_COLUMNS = {
  // 基本情報
  Title: {
    type: 'Text',
    required: true,
    description: '申し送り概要（1行タイトル）。UIでは本文先頭から自動生成可能'
  },

  Message: {
    type: 'Note', // 複数行テキスト（リッチテキスト対応）
    required: true,
    richText: true,
    description: '申し送り本文。太字・改行・箇条書き対応で現場の表現力を支援'
  },

  // 利用者情報
  UserCode: {
    type: 'Text',
    required: true,
    description: '利用者コード。全体向けは "ALL"、個別は利用者ID'
  },

  UserDisplayName: {
    type: 'Text',
    required: true,
    description: '利用者表示名。一覧での視認性向上。全体向けは "全体"'
  },

  // 分類・優先度
  Category: {
    type: 'Choice',
    required: true,
    choices: [
      '体調',
      '行動面',
      '家族連絡',
      '支援の工夫',
      '良かったこと',
      '事故・ヒヤリ',
      'その他'
    ],
    defaultValue: '体調',
    description: '申し送り内容のカテゴリ分類。現場の関心事に対応'
  },

  Severity: {
    type: 'Choice',
    required: true,
    choices: [
      '通常',
      '要注意',
      '重要'
    ],
    defaultValue: '通常',
    description: '重要度レベル。朝会・夕会での優先度判断に使用'
  },

  Status: {
    type: 'Choice',
    required: true,
    choices: [
      '未対応',
      '対応中',
      '対応済',
      '確認済',
      '明日へ持越',
      '完了'
    ],
    defaultValue: '未対応',
    description: 'フォローアップ状況。夕会→朝会ワークフロー対応'
  },

  CarryOverDate: {
    type: 'DateTime',
    required: false,
    description: '「明日へ持越」にした日付。朝会モードで前日分のみ表示するために使用'
  },

  // 時間・セッション管理
  TimeBand: {
    type: 'Choice',
    required: true,
    choices: [
      '朝',    // 6:00-9:00
      '午前',  // 9:00-12:00
      '午後',  // 12:00-17:00
      '夕方'   // 17:00-20:00
    ],
    description: '発生時間帯。自動判定 + 手動調整可能'
  },

  MeetingSessionKey: {
    type: 'Text',
    required: false,
    description: '関連する朝会・夕会セッション（例: 2025-11-18_morning）。Meeting統合時に使用'
  },

  // 作成者・日時
  CreatedAt: {
    type: 'DateTime',
    required: true,
    defaultValue: 'Today',
    description: '作成日時。自動設定'
  },

  CreatedByName: {
    type: 'Text',
    required: true,
    description: '作成者名。将来的にはPeople列も検討'
  },

  // 将来拡張用
  IsDraft: {
    type: 'Boolean',
    required: true,
    defaultValue: false,
    description: 'ドラフト保存機能用（v1では常にfalse）'
  },
} as const;

// ────────────────────────────────────────────────────────────
// ワークフロー定義（夕会→朝会昇格）
// ────────────────────────────────────────────────────────────

/**
 * 夕会/朝会の業務モード
 */
export type MeetingMode = 'normal' | 'evening' | 'morning';

export const MEETING_MODE_LABELS: Record<MeetingMode, string> = {
  normal: '📋 通常',
  evening: '🌆 夕会',
  morning: '🌅 朝会',
};

/**
 * ステータス更新ペイロード（API呼び出し用）
 */
export type HandoffStatusUpdate = {
  status: HandoffStatus;
  carryOverDate?: string; // YYYY-MM-DD
};

// ────────────────────────────────────────────────────────────
// TypeScript 型定義
// ────────────────────────────────────────────────────────────

export type HandoffCategory =
  | '体調'
  | '行動面'
  | '家族連絡'
  | '支援の工夫'
  | '良かったこと'
  | '事故・ヒヤリ'
  | 'その他';

export type HandoffSeverity =
  | '通常'
  | '要注意'
  | '重要';

export type HandoffStatus =
  | '未対応'
  | '対応中'
  | '対応済'
  | '確認済'
  | '明日へ持越'
  | '完了';

export type TimeBand =
  | '朝'
  | '午前'
  | '午後'
  | '夕方';

/**
 * 申し送り記録（完全版）
 * SharePoint から取得される完全なデータ
 */
export interface HandoffRecord {
  id: number; // SharePoint Id
  title: string;
  message: string; // リッチテキスト対応
  userCode: string;
  userDisplayName: string;
  category: HandoffCategory;
  severity: HandoffSeverity;
  status: HandoffStatus;
  timeBand: TimeBand;
  meetingSessionKey?: string;
  carryOverDate?: string; // YYYY-MM-DD — 「明日へ持越」設定日
  sourceType?: string;
  sourceId?: number;
  sourceUrl?: string;
  sourceKey?: string;
  sourceLabel?: string;
  createdAt: string; // ISO datetime
  createdByName: string;
  isDraft: boolean;
}

/**
 * 新規申し送り作成用
 * フロントエンドからの入力データ
 */
export interface NewHandoffInput {
  userCode: string;
  userDisplayName: string;
  category: HandoffCategory;
  severity: HandoffSeverity;
  timeBand: TimeBand;
  message: string;
  title?: string; // 省略時は message から自動生成
  meetingSessionKey?: string;
  sourceType?: string;
  sourceId?: number;
  sourceUrl?: string;
  sourceKey?: string;
  sourceLabel?: string;
  // status は常に '未対応' で作成
  // createdAt, createdByName は自動設定
}

// ────────────────────────────────────────────────────────────
// ユーティリティ関数とメタデータ（Phase 6C拡張）
// ────────────────────────────────────────────────────────────

/**
 * ステータス表示用メタデータ（日本語ラベル対応）
 * 対応済/完了 は UI上「完了」に統一
 */
export const HANDOFF_STATUS_META: Record<HandoffStatus, { label: string; color: 'default' | 'primary' | 'warning' | 'success' | 'info' }> = {
  '未対応': {
    label: '未対応',
    color: 'default',
  },
  '対応中': {
    label: '対応中',
    color: 'warning',
  },
  '対応済': {
    label: '完了', // UI統一: 対応済も「完了」表示
    color: 'success',
  },
  '確認済': {
    label: '確認済',
    color: 'info',
  },
  '明日へ持越': {
    label: '明日へ',
    color: 'primary',
  },
  '完了': {
    label: '完了',
    color: 'success',
  },
};

/**
 * 終端ステータス判定
 * 対応済（従来フロー完了）と 完了（夕会/朝会フロー完了）を同一扱い
 */
export function isTerminalStatus(status: HandoffStatus): boolean {
  return status === '対応済' || status === '完了';
}

/**
 * 状態を次のステップに進めるヘルパー（従来フロー用・既存互換）
 */
export function getNextStatus(current: HandoffStatus): HandoffStatus {
  if (current === '未対応') return '対応中';
  if (current === '対応中') return '対応済';
  return '未対応'; // 対応済 → 未対応へ戻る
}

// ────────────────────────────────────────────────────────────
// ワークフロー遷移ロジック
// ────────────────────────────────────────────────────────────

/**
 * ワークフローアクション定義
 */
export type WorkflowAction = {
  key: string;
  label: string;
  icon: string;
  targetStatus: HandoffStatus;
  /** 「明日へ持越」の場合 true → carryOverDate を今日でセット */
  setsCarryOverDate?: boolean;
};

const ACTION_REVIEWED: WorkflowAction = {
  key: 'reviewed',
  label: '確認済',
  icon: '✅',
  targetStatus: '確認済',
};

const ACTION_CARRY_OVER: WorkflowAction = {
  key: 'carry_over',
  label: '明日へ',
  icon: '📅',
  targetStatus: '明日へ持越',
  setsCarryOverDate: true,
};

const ACTION_CLOSED: WorkflowAction = {
  key: 'closed',
  label: '完了',
  icon: '🔒',
  targetStatus: '完了',
};

/**
 * 現在のステータスとモードに応じて許可されるアクションを返す
 * 単一関数でUI側の分岐増殖を防ぐ
 *
 * // TODO: context?: { role?: 'admin' | 'staff' } で reopen アクションを追加
 */
export function getAllowedActions(
  status: HandoffStatus,
  mode: MeetingMode,
): WorkflowAction[] {
  if (mode === 'evening') {
    if (status === '未対応') return [ACTION_REVIEWED];
    if (status === '確認済') return [ACTION_CARRY_OVER, ACTION_CLOSED];
    return [];
  }

  if (mode === 'morning') {
    if (status === '明日へ持越') return [ACTION_CLOSED];
    return [];
  }

  // normal: アクションボタンなし（既存Chipサイクルを維持）
  return [];
}

// ────────────────────────────────────────────────────────────
// 時間帯フィルタ機能（Step 7B追加）
// ────────────────────────────────────────────────────────────

/**
 * 申し送り時間帯フィルタの種別
 */
export type HandoffTimeFilter = 'all' | 'morning' | 'evening';

/**
 * 申し送り日付スコープ型（Step 7C: MeetingGuideDrawer連携）
 * Phase 8B: 「過去7日」スコープを追加
 */
export type HandoffDayScope = 'today' | 'yesterday' | 'week';

/**
 * 時間帯フィルタのプリセット設定
 */
export const HANDOFF_TIME_FILTER_PRESETS: Record<HandoffTimeFilter, TimeBand[]> = {
  all: [],
  morning: ['朝', '午前'],
  evening: ['午後', '夕方'],
};

/**
 * フィルタ表示ラベル（UI用）
 */
export const HANDOFF_TIME_FILTER_LABELS: Record<HandoffTimeFilter, string> = {
  all: '全て',
  morning: '🌅 朝〜午前',
  evening: '🌆 午後〜夕方',
};

/**
 * 日付スコープ表示ラベル（Step 7C用）
 */
export const HANDOFF_DAY_SCOPE_LABELS: Record<HandoffDayScope, string> = {
  today: '今日',
  yesterday: '昨日',
  week: '過去7日',
};

// ────────────────────────────────────────────────────────────
// SharePoint API 変換関数（Phase 8A）
// ────────────────────────────────────────────────────────────

/**
 * SharePoint アイテム型定義
 */
export type SpHandoffItem = {
  Id: number;
  Title: string;
  Message: string;
  UserCode: string;
  UserDisplayName: string;
  Category: string;
  Severity: string;
  Status: string;
  TimeBand: string;
  MeetingSessionKey?: string;
  CarryOverDate?: string; // ISO date from SP DateTime column
  SourceType?: string;
  SourceId?: number;
  SourceUrl?: string;
  SourceKey?: string;
  SourceLabel?: string;
  CreatedAt?: string;
  CreatedByName: string;
  IsDraft: boolean;
  Created?: string;
  Modified?: string;
  AuthorId?: number;
  EditorId?: number;
};

/** 既知の HandoffStatus 値かどうかを判定 */
const VALID_STATUSES: ReadonlySet<string> = new Set<HandoffStatus>([
  '未対応', '対応中', '対応済', '確認済', '明日へ持越', '完了',
]);

function normalizeStatus(raw: string): HandoffStatus {
  if (VALID_STATUSES.has(raw)) return raw as HandoffStatus;
  return '未対応'; // 未知ステータスのフォールバック
}

/**
 * SharePoint アイテムを内部型に変換
 */
export function fromSpHandoffItem(sp: SpHandoffItem): HandoffRecord {
  return {
    id: sp.Id,
    title: sp.Title,
    message: sp.Message,
    userCode: sp.UserCode,
    userDisplayName: sp.UserDisplayName,
    category: sp.Category as HandoffCategory,
    severity: sp.Severity as HandoffSeverity,
    status: normalizeStatus(sp.Status),
    timeBand: sp.TimeBand as TimeBand,
    meetingSessionKey: sp.MeetingSessionKey,
    carryOverDate: sp.CarryOverDate ? sp.CarryOverDate.split('T')[0] : undefined,
    sourceType: sp.SourceType,
    sourceId: sp.SourceId,
    sourceUrl: sp.SourceUrl,
    sourceKey: sp.SourceKey,
    sourceLabel: sp.SourceLabel,
    createdAt: sp.CreatedAt || sp.Created || new Date().toISOString(),
    createdByName: sp.CreatedByName,
    isDraft: sp.IsDraft,
  };
}

/**
 * 内部型を SharePoint 作成用ペイロードに変換
 */
export function toSpHandoffCreatePayload(
  record: NewHandoffInput & {
    title?: string;
    createdAt?: string;
    createdByName?: string;
    isDraft?: boolean;
  }
): Omit<SpHandoffItem, 'Id' | 'Created' | 'Modified' | 'AuthorId' | 'EditorId'> {
  return {
    Title: record.title || generateTitleFromMessage(record.message),
    Message: record.message,
    UserCode: record.userCode,
    UserDisplayName: record.userDisplayName,
    Category: record.category,
    Severity: record.severity,
    Status: '未対応', // 新規作成時は常に未対応
    TimeBand: record.timeBand,
    MeetingSessionKey: record.meetingSessionKey,
    SourceType: record.sourceType,
    SourceId: record.sourceId,
    SourceUrl: record.sourceUrl,
    SourceKey: record.sourceKey,
    SourceLabel: record.sourceLabel,
    CreatedAt: record.createdAt || new Date().toISOString(),
    CreatedByName: record.createdByName || 'システム利用者',
    IsDraft: record.isDraft || false,
  };
}

/**
 * SharePoint 更新用ペイロード（部分更新対応）
 */
export function toSpHandoffUpdatePayload(
  updates: Partial<Pick<HandoffRecord, 'status' | 'severity' | 'category' | 'message' | 'title' | 'carryOverDate'>>
): Partial<Pick<SpHandoffItem, 'Status' | 'Severity' | 'Category' | 'Message' | 'Title' | 'CarryOverDate'>> {
  const payload: Partial<Pick<SpHandoffItem, 'Status' | 'Severity' | 'Category' | 'Message' | 'Title' | 'CarryOverDate'>> = {};

  if (updates.status !== undefined) payload.Status = updates.status;
  if (updates.severity !== undefined) payload.Severity = updates.severity;
  if (updates.category !== undefined) payload.Category = updates.category;
  if (updates.message !== undefined) payload.Message = updates.message;
  if (updates.title !== undefined) payload.Title = updates.title;
  if (updates.carryOverDate !== undefined) {
    // SP DateTime列にはISO形式で保存
    payload.CarryOverDate = `${updates.carryOverDate}T00:00:00.000Z`;
  }

  return payload;
}

/**
 * 申し送りリスト表示用（軽量版）
 */
export interface HandoffSummary {
  id: number;
  title: string;
  userDisplayName: string;
  category: HandoffCategory;
  severity: HandoffSeverity;
  status: HandoffStatus;
  timeBand: TimeBand;
  carryOverDate?: string;
  createdAt: string;
  createdByName: string;
}

// ────────────────────────────────────────────────────────────
// ユーティリティ関数
// ────────────────────────────────────────────────────────────

/**
 * 現在時刻から TimeBand を自動判定
 */
export function getCurrentTimeBand(): TimeBand {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 9) return '朝';
  if (hour >= 9 && hour < 12) return '午前';
  if (hour >= 12 && hour < 17) return '午後';
  return '夕方'; // 17:00以降 or 6:00以前
}

/**
 * メッセージから自動でタイトル生成
 */
export function generateTitleFromMessage(message: string): string {
  // リッチテキストのHTMLタグを除去
  const plainText = message.replace(/<[^>]*>/g, '');

  // 最初の30文字 + 適切な切り詰め
  if (plainText.length <= 30) {
    return plainText;
  }

  // 文の区切りで切る
  const firstSentence = plainText.split(/[。！？\n]/)[0];
  if (firstSentence.length <= 30) {
    return firstSentence;
  }

  // 30文字で切って...を追加
  return plainText.substring(0, 30) + '...';
}

/**
 * Severity に応じた色設定（MUI用）
 */
export function getSeverityColor(severity: HandoffSeverity): 'default' | 'warning' | 'error' {
  switch (severity) {
    case '重要': return 'error';
    case '要注意': return 'warning';
    case '通常':
    default: return 'default';
  }
}

/**
 * Status に応じた色設定（MUI用）
 */
export function getStatusColor(status: HandoffStatus): 'default' | 'primary' | 'success' | 'info' {
  switch (status) {
    case '対応済': return 'success';
    case '完了': return 'success';
    case '確認済': return 'info';
    case '明日へ持越': return 'primary';
    case '対応中': return 'primary';
    case '未対応':
    default: return 'default';
  }
}

// ────────────────────────────────────────────────────────────
// 日付ユーティリティ（timezone-safe）
// ────────────────────────────────────────────────────────────

/**
 * ローカルタイムゾーン（JST）で YYYY-MM-DD を生成
 * carryOverDate 等、日付のみの値に使用
 */
export function formatYmdLocal(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 昨日のローカル日付を YYYY-MM-DD で返す
 */
export function getYesterdayYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatYmdLocal(d);
}
