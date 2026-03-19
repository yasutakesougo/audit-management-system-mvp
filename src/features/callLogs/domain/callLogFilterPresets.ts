/**
 * callLogFilterPresets — Today タイルから遷移時のフィルタプリセット定義
 *
 * 責務:
 * - URL search param "filter" の値とフィルタ条件のマッピング
 * - CallLogPage が search params から初期フィルタを復元する
 *
 * 設計:
 * - 副作用なし。UI / hook に依存しない。
 * - filterCallLogs の CallLogFilterCriteria に変換可能。
 * - タブ切り替え（activeTab）も含めて統一的に扱う。
 */

import type { CallLogTabValue } from '../hooks/useCallLogs';

// ─── プリセット名 ─────────────────────────────────────────────────────────────

export type CallLogFilterPreset =
  | 'overdue'     // 折返し期限超過
  | 'urgent'      // 至急
  | 'mine'        // 自分宛
  | 'callback'    // 折返し待ち
  | 'open';       // 未対応全体

// ─── プリセット設定 ──────────────────────────────────────────────────────────

export type CallLogPresetConfig = {
  /** タブの初期値 */
  tab: CallLogTabValue;
  /** キーワード検索の初期値 */
  keyword: string;
  /** 利用者紐付けあり フィルタ */
  onlyWithRelatedUser: boolean;
  /** プリセット表示ラベル */
  label: string;
};

const PRESET_MAP: Record<CallLogFilterPreset, CallLogPresetConfig> = {
  overdue: {
    tab: 'callback_pending',
    keyword: '',
    onlyWithRelatedUser: false,
    label: '期限超過',
  },
  urgent: {
    tab: 'all',
    keyword: '',
    onlyWithRelatedUser: false,
    label: '至急',
  },
  mine: {
    tab: 'all',
    keyword: '',
    onlyWithRelatedUser: false,
    label: '自分宛',
  },
  callback: {
    tab: 'callback_pending',
    keyword: '',
    onlyWithRelatedUser: false,
    label: '折返し待ち',
  },
  open: {
    tab: 'new',
    keyword: '',
    onlyWithRelatedUser: false,
    label: '未対応',
  },
};

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

/** URL search params の "filter" 値を有効なプリセット名にパースする */
export function parseFilterPreset(value: string | null): CallLogFilterPreset | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized in PRESET_MAP) {
    return normalized as CallLogFilterPreset;
  }
  return null;
}

/** プリセット名からフィルタ設定を取得する */
export function getPresetConfig(preset: CallLogFilterPreset): CallLogPresetConfig {
  return PRESET_MAP[preset];
}

/** プリセット名から /call-logs への遷移 URL を生成する */
export function buildCallLogFilterUrl(preset: CallLogFilterPreset): string {
  return `/call-logs?filter=${preset}`;
}
