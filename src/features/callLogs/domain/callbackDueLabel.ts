/**
 * callbackDueLabel — 折返し期限の表示ラベルと緊急度を算出する pure function
 *
 * 責務:
 * - callbackDueAt (ISO string) と現在時刻から表示ラベルを生成
 * - overdue / due-soon / due-later / none の4段階を判定
 *
 * 設計:
 * - 副作用なし。UI / hook に依存しない。
 * - now を引数で受け取りテスト容易性を確保。
 */

import type { CallLog } from '@/domain/callLogs/schema';

// ─── 表示結果型 ──────────────────────────────────────────────────────────────

export type CallbackDueLevel = 'overdue' | 'due-soon' | 'due-later' | 'none';

export type CallbackDueInfo = {
  /** 表示ラベル（例: "期限超過 2時間", "あと30分", "03/20 15:00"） */
  label: string;
  /** 緊急度レベル */
  level: CallbackDueLevel;
};

// ─── 定数 ─────────────────────────────────────────────────────────────────────

/** due-soon と判定するしきい値（2時間） */
const DUE_SOON_THRESHOLD_MS = 2 * 60 * 60 * 1000;

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function formatRelativeTime(diffMs: number): string {
  const absDiff = Math.abs(diffMs);
  const minutes = Math.floor(absDiff / (60 * 1000));
  const hours = Math.floor(minutes / 60);

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}日`;
  }
  if (hours >= 1) {
    const remainMinutes = minutes % 60;
    return remainMinutes > 0 ? `${hours}時間${remainMinutes}分` : `${hours}時間`;
  }
  return `${minutes}分`;
}

function formatAbsoluteTime(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// ─── メイン関数 ────────────────────────────────────────────────────────────────

/**
 * CallLog の callbackDueAt から表示ラベルと緊急度を算出する。
 *
 * - status が callback_pending でない、または callbackDueAt がない → none
 * - 期限超過 → overdue（「期限超過 ○時間」）
 * - 2時間以内 → due-soon（「あと○分」）
 * - 2時間以上先 → due-later（「03/20 15:00」）
 */
export function getCallbackDueInfo(
  log: Pick<CallLog, 'status' | 'callbackDueAt'>,
  now: Date = new Date(),
): CallbackDueInfo {
  // callback_pending 以外は表示しない
  if (log.status !== 'callback_pending') {
    return { label: '', level: 'none' };
  }

  // callbackDueAt が未設定
  if (!log.callbackDueAt) {
    return { label: '期限未設定', level: 'none' };
  }

  const dueDate = new Date(log.callbackDueAt);
  const diffMs = dueDate.getTime() - now.getTime();

  // 期限超過
  if (diffMs < 0) {
    return {
      label: `期限超過 ${formatRelativeTime(diffMs)}`,
      level: 'overdue',
    };
  }

  // 2時間以内
  if (diffMs <= DUE_SOON_THRESHOLD_MS) {
    return {
      label: `あと${formatRelativeTime(diffMs)}`,
      level: 'due-soon',
    };
  }

  // 2時間以上先
  return {
    label: `期限: ${formatAbsoluteTime(dueDate)}`,
    level: 'due-later',
  };
}
