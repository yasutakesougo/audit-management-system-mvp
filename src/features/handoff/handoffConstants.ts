/**
 * 申し送り定数定義
 *
 * SharePoint 列構成、時間帯フィルタプリセット、日付スコープラベル等の
 * 不変の設定値を集約。
 */

import type {
    HandoffDayScope,
    HandoffSeverity,
    HandoffTimeFilter,
    TimeBand
} from './handoffTypes';

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
// 時間帯フィルタ機能（Step 7B追加）
// ────────────────────────────────────────────────────────────

/** 時間帯フィルタのプリセット設定 */
export const HANDOFF_TIME_FILTER_PRESETS: Record<HandoffTimeFilter, TimeBand[]> = {
  all: [],
  morning: ['朝', '午前'],
  evening: ['午後', '夕方'],
};

/** フィルタ表示ラベル（UI用） */
export const HANDOFF_TIME_FILTER_LABELS: Record<HandoffTimeFilter, string> = {
  all: '全て',
  morning: '🌅 朝〜午前',
  evening: '🌆 午後〜夕方',
};

/** 日付スコープ表示ラベル（Step 7C用） */
export const HANDOFF_DAY_SCOPE_LABELS: Record<HandoffDayScope, string> = {
  today: '今日',
  yesterday: '昨日',
  week: '過去7日',
};

// ────────────────────────────────────────────────────────────
// ユーティリティ関数
// ────────────────────────────────────────────────────────────

/** 現在時刻から TimeBand を自動判定 */
export function getCurrentTimeBand(): TimeBand {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 9) return '朝';
  if (hour >= 9 && hour < 12) return '午前';
  if (hour >= 12 && hour < 17) return '午後';
  return '夕方'; // 17:00以降 or 6:00以前
}

/** Severity に応じた色設定（MUI用） */
export function getSeverityColor(severity: HandoffSeverity): 'default' | 'warning' | 'error' {
  switch (severity) {
    case '重要': return 'error';
    case '要注意': return 'warning';
    case '通常':
    default: return 'default';
  }
}

/** Status に応じた色設定（MUI用） */
export function getStatusColor(status: import('./handoffTypes').HandoffStatus): 'default' | 'primary' | 'success' {
  switch (status) {
    case '対応済': return 'success';
    case '対応中': return 'primary';
    case '未対応':
    default: return 'default';
  }
}

// ────────────────────────────────────────────────────────────
// カテゴリ絵文字マップ（入力側 CompactNewHandoffInput と共通化）
// ────────────────────────────────────────────────────────────

import type { HandoffCategory, MeetingMode } from './handoffTypes';

/** カテゴリに対応する絵文字（入力UI / 一覧UI で統一） */
export const CATEGORY_EMOJI: Record<HandoffCategory, string> = {
  '体調': '🩺',
  '行動面': '🏃',
  '家族連絡': '📞',
  '支援の工夫': '💡',
  '良かったこと': '✨',
  '事故・ヒヤリ': '⚠️',
  'その他': '📝',
};

/**
 * 現在の TimeBand から MeetingMode を導出
 *
 * HandoffRecord には MeetingMode フィールドがないため、
 * 現在時刻から推定する。state machine の getAllowedActions に渡す。
 */
export function timeBandToMeetingMode(timeBand: TimeBand): MeetingMode {
  switch (timeBand) {
    case '朝': return 'morning';
    case '午前': return 'normal';
    case '午後': return 'normal';
    case '夕方': return 'evening';
    default: return 'normal';
  }
}
