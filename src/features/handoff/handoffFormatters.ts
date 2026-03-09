/**
 * Handoff Display Formatters
 *
 * Pure formatting functions for handoff timeline / live feed display.
 * No React or MUI dependencies.
 *
 * @module features/handoff/handoffFormatters
 */

import type { HandoffStatus } from './handoffTypes';

/** Format ISO timestamp to HH:mm (ja-JP locale) */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Convert ISO timestamp to a relative time label */
export function getRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMin = Math.floor((now - then) / 60_000);
  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}時間前`;
  return formatTime(iso);
}

/**
 * Status transition map for inline status cycling.
 * Single source of truth — used by both compact and normal FeedItem views.
 */
export const FEED_STATUS_NEXT: Record<string, HandoffStatus> = {
  '未対応': '対応中',
  '対応中': '対応済',
  '対応済': '未対応',
};
