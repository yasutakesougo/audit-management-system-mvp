/**
 * 申し送りタイムライン — 型定義（Pure Types）
 *
 * すべての handoff ドメインモジュールが依存する型のみを定義。
 * ランタイムロジック・定数値は含まない。
 *
 * 定数      → handoffConstants.ts
 * SP変換    → handoffMappers.ts
 * 状態遷移  → handoffStateMachine.ts
 * ストレージ → handoffStorageUtils.ts
 */

// ────────────────────────────────────────────────────────────
// 列挙型 (Union Types)
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

/** 申し送り時間帯フィルタの種別 */
export type HandoffTimeFilter = 'all' | 'morning' | 'evening';

/**
 * 申し送り日付スコープ型（Step 7C: MeetingGuideDrawer連携）
 * Phase 8B: 「過去7日」スコープを追加
 */
export type HandoffDayScope = 'today' | 'yesterday' | 'week';

// ────────────────────────────────────────────────────────────
// ドメインモデル
// ────────────────────────────────────────────────────────────

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
  // P6 Phase 3: 制度系対応証跡
  resolvedBy?: string;      // 対応完了者（UPN / 表示名）
  resolvedAt?: string;      // 対応完了日時 (ISO datetime)
  resolutionNote?: string;  // 対応メモ（何をしたか）
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
// SharePoint API 型
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
  // P6 Phase 3: 制度系対応証跡
  ResolvedBy?: string;
  ResolvedAt?: string;
  ResolutionNote?: string;
  Created?: string;
  Modified?: string;
  AuthorId?: number;
  EditorId?: number;
};

// ────────────────────────────────────────────────────────────
// 後方互換性: 再エクスポート
//
// 以前 handoffTypes.ts から直接インポートされていた
// 定数・関数を再エクスポートし、既存の import 文を壊さない。
// 新規コードでは各モジュールから直接インポートすること。
// ────────────────────────────────────────────────────────────

export {
    HANDOFF_DAY_SCOPE_LABELS,
    // handoffConstants.ts
    HANDOFF_TIMELINE_COLUMNS, HANDOFF_TIME_FILTER_LABELS, HANDOFF_TIME_FILTER_PRESETS, getCurrentTimeBand,
    getSeverityColor,
    getStatusColor
} from './handoffConstants';

export {
    // handoffMappers.ts
    fromSpHandoffItem,
    toSpHandoffCreatePayload,
    toSpHandoffUpdatePayload
} from './handoffMappers';

export {
    // handoffStateMachine.ts (状態遷移ロジック + メタデータ)
    HANDOFF_STATUS_META, getAllowedActions, getNextStatus,
    isTerminalStatus
} from './handoffStateMachine';
