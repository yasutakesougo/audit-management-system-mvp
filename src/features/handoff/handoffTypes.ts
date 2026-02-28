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
      '確認済',    // v3: 夕会ワークフロー
      '明日へ持越', // v3: 夕会→朝会引き継ぎ
      '完了'       // v3: 夕会/朝会クローズ
    ],
    defaultValue: '未対応',
    description: 'フォローアップ状況。継続的な支援管理。v3で夕会/朝会ワークフローに対応'
  },

  // v3: 明日へ持越用の日付 (SP列追加時に有効化)
  CarryOverDate: {
    type: 'DateTime',
    required: false,
    description: '明日へ持越にした日付。朝会で昨日分のみフィルタするために使用'
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
  }
} as const;

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
  | '確認済'     // v3: 夕会で確認
  | '明日へ持越'  // v3: 朝会へ送る
  | '完了';       // v3: 夕会/朝会でクローズ

/**
 * 会議モード
 * - normal: 通常操作（既存のステータスサイクル）
 * - evening: 夕会モード（確認済→明日へ持越 or 完了）
 * - morning: 朝会モード（明日へ持越→完了）
 */
export type MeetingMode = 'normal' | 'evening' | 'morning';

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
  sourceType?: string;
  sourceId?: number;
  sourceUrl?: string;
  sourceKey?: string;
  sourceLabel?: string;
  createdAt: string; // ISO datetime
  createdByName: string;
  isDraft: boolean;
  carryOverDate?: string; // v3: 明日へ持越にした日付 (ISO date, e.g. '2026-02-28')
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
 */
export const HANDOFF_STATUS_META: Record<HandoffStatus, { label: string; icon: string; color: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' }> = {
  '未対応': { label: '未対応', icon: '📝', color: 'default' },
  '対応中': { label: '対応中', icon: '⏳', color: 'warning' },
  '対応済': { label: '完了', icon: '✅', color: 'success' },   // UI統一: 「完了」表示
  '確認済': { label: '確認済', icon: '👀', color: 'info' },     // v3: 夕会確認
  '明日へ持越': { label: '明日へ', icon: '📅', color: 'warning' }, // v3: 朝会送り
  '完了': { label: '完了', icon: '✅', color: 'success' },       // v3: UI上は対応済と同等
};

/**
 * 状態を次のステップに進めるヘルパー（従来フロー: normal モード用）
 */
export function getNextStatus(current: HandoffStatus): HandoffStatus {
  if (current === '未対応') return '対応中';
  if (current === '対応中') return '対応済';
  return '未対応'; // 対応済 → 未対応へ戻る
}

/**
 * 終端ステータスの判定
 * v3 状態マシン: `対応済` と `完了` が終端
 * 注意: `明日へ持越` は終端ではない（朝会で `完了` へ遷移する）
 */
export function isTerminalStatus(status: HandoffStatus): boolean {
  return status === '対応済' || status === '完了';
}

/**
 * モード別の許可遷移を返す関数
 * UI層はこの関数の戻り値でボタンを描画する（ゼロ計算）
 *
 * v3 状態マシン:
 *   未対応 → 確認済 (夕会) / 対応中 (従来)
 *   対応中 → 対応済 (従来)
 *   確認済 → 明日へ持越 / 完了 (夕会)
 *   明日へ持越 → 完了 (朝会)
 *   対応済 / 完了 → (終端、リオープンは管理者のみ)
 */
export function getAllowedActions(
  status: HandoffStatus,
  mode: MeetingMode
): HandoffStatus[] {
  // 終端ステータスはアクションなし
  if (isTerminalStatus(status)) return [];

  switch (mode) {
    case 'evening':
      if (status === '未対応') return ['確認済', '完了'];
      if (status === '確認済') return ['明日へ持越', '完了'];
      if (status === '対応中') return ['対応済'];
      return [];

    case 'morning':
      if (status === '明日へ持越') return ['完了'];
      if (status === '未対応') return ['完了'];
      if (status === '確認済') return ['完了'];
      if (status === '対応中') return ['対応済'];
      return [];

    case 'normal':
    default:
      // 従来のトグルサイクル
      if (status === '未対応') return ['対応中'];
      if (status === '対応中') return ['対応済'];
      // 新規ステータスが normal で表示された場合のフォールバック
      if (status === '確認済') return ['完了'];
      if (status === '明日へ持越') return ['完了'];
      return [];
  }
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
  SourceType?: string;
  SourceId?: number;
  SourceUrl?: string;
  SourceKey?: string;
  SourceLabel?: string;
  CreatedAt?: string;
  CreatedByName: string;
  IsDraft: boolean;
  CarryOverDate?: string; // v3: 明日へ持越日付
  Created?: string;
  Modified?: string;
  AuthorId?: number;
  EditorId?: number;
};

/**
 * SharePoint アイテムを内部型に変換
 */
/** v3: 有効なステータス値の一覧（未知値のフォールバック検証用） */
const VALID_HANDOFF_STATUSES: readonly HandoffStatus[] = [
  '未対応', '対応中', '対応済', '確認済', '明日へ持越', '完了',
] as const;

/**
 * SharePoint アイテムを内部型に変換
 * v3: 未知の Status 値は '未対応' にフォールバック（前方互換）
 */
export function fromSpHandoffItem(sp: SpHandoffItem): HandoffRecord {
  const status = VALID_HANDOFF_STATUSES.includes(sp.Status as HandoffStatus)
    ? (sp.Status as HandoffStatus)
    : '未対応';

  return {
    id: sp.Id,
    title: sp.Title,
    message: sp.Message,
    userCode: sp.UserCode,
    userDisplayName: sp.UserDisplayName,
    category: sp.Category as HandoffCategory,
    severity: sp.Severity as HandoffSeverity,
    status,
    timeBand: sp.TimeBand as TimeBand,
    meetingSessionKey: sp.MeetingSessionKey,
    sourceType: sp.SourceType,
    sourceId: sp.SourceId,
    sourceUrl: sp.SourceUrl,
    sourceKey: sp.SourceKey,
    sourceLabel: sp.SourceLabel,
    createdAt: sp.CreatedAt || sp.Created || new Date().toISOString(),
    createdByName: sp.CreatedByName,
    isDraft: sp.IsDraft,
    carryOverDate: sp.CarryOverDate,
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
  if (updates.carryOverDate !== undefined) payload.CarryOverDate = updates.carryOverDate;

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
export function getStatusColor(status: HandoffStatus): 'default' | 'primary' | 'success' {
  switch (status) {
    case '対応済': return 'success';
    case '対応中': return 'primary';
    case '未対応':
    default: return 'default';
  }
}
