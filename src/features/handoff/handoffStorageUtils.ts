/**
 * 申し送り localStorage 共通ユーティリティ
 *
 * useHandoffTimeline, useCreateHandoffFromExternalSource, useHandoffSummary で
 * 重複していた localStorage 操作関数を集約。
 */

import { auditLog } from '@/lib/debugLogger';
import type { HandoffDayScope, HandoffRecord } from './handoffTypes';

// ────────────────────────────────────────────────────────────
// 定数
// ────────────────────────────────────────────────────────────

export const HANDOFF_STORAGE_KEY = 'handoff.timeline.dev.v1';

// ────────────────────────────────────────────────────────────
// 型
// ────────────────────────────────────────────────────────────

/** localStorage のルートオブジェクト構造 (日付キー → レコード配列) */
export type HandoffStorageShape = Record<string, HandoffRecord[]>;

// ────────────────────────────────────────────────────────────
// 日付キー生成
// ────────────────────────────────────────────────────────────

/** YYYY-MM-DD 形式の日付キーを生成 */
export function getTodayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * dayScope に応じた日付キーを取得
 * @returns 'week' の場合は null (複数日のため単一キーなし)
 */
export function getDateKeyForScope(dayScope: HandoffDayScope): string | null {
  const now = new Date();
  if (dayScope === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return getTodayKey(yesterday);
  }
  if (dayScope === 'week') {
    return null;
  }
  return getTodayKey(now);
}

/** 直近 N 日分の日付キー配列を返す（新しい順） */
export function getRecentDateKeys(days: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let offset = 0; offset < days; offset += 1) {
    const target = new Date(now);
    target.setDate(now.getDate() - offset);
    keys.push(getTodayKey(target));
  }
  return keys;
}

// ────────────────────────────────────────────────────────────
// localStorage 操作
// ────────────────────────────────────────────────────────────

/** localStorage からデータを読み込み */
export function loadStorage(): HandoffStorageShape {
  try {
    const raw = window.localStorage.getItem(HANDOFF_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as HandoffStorageShape;
  } catch {
    return {};
  }
}

/** localStorage にデータを保存 */
export function saveStorage(data: HandoffStorageShape): void {
  try {
    window.localStorage.setItem(HANDOFF_STORAGE_KEY, JSON.stringify(data));
  } catch {
    auditLog.warn('handoff', 'storage.save_failed');
  }
}

/**
 * 指定 dayScope のレコードを localStorage から取得
 * ('week' スコープは直近7日分をマージ)
 */
export function loadRecordsFromStorage(dayScope: HandoffDayScope): HandoffRecord[] {
  const store = loadStorage();

  if (dayScope === 'week') {
    return getRecentDateKeys(7)
      .flatMap(key => store[key] ?? []);
  }

  const dateKey = getDateKeyForScope(dayScope);
  return store[dateKey ?? getTodayKey()] ?? [];
}

// ────────────────────────────────────────────────────────────
// ID 生成
// ────────────────────────────────────────────────────────────

/** 一意IDを生成（crypto.randomUUID ベース、フォールバック: タイムスタンプ） */
export function generateId(): number {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    const uuid = crypto.randomUUID();
    const hash = uuid.replace(/-/g, '').slice(0, 8);
    return parseInt(hash, 16);
  }
  return Date.now() + Math.floor(Math.random() * 1000);
}

// ────────────────────────────────────────────────────────────
// 既読 (Seen) 管理
// ────────────────────────────────────────────────────────────

const HANDOFF_SEEN_STORAGE_KEY = 'handoff-seen.v1';

/** 既読マップ型: itemId -> ISO timestamp */
export type HandoffSeenMap = Record<string, string>;

/** localStorage から既読マップを読み込み */
export function loadSeenMap(): HandoffSeenMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(HANDOFF_SEEN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as HandoffSeenMap;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

/** 既読マップを localStorage に保存 */
export function saveSeenMap(map: HandoffSeenMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HANDOFF_SEEN_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // noop
  }
}
