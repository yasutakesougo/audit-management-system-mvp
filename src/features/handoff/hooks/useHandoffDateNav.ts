/**
 * useHandoffDateNav — /handoff-timeline の日付ナビゲーション管理
 *
 * URL: ?range=day&date=YYYY-MM-DD
 *
 * 解決ルール:
 *  1. URL の `date` パラメータがあればそれを使う
 *  2. なければ location.state.dayScope を date に変換
 *  3. 最終 fallback: 今日
 *
 * range は P0 では 'day' のみ実装。
 * P1 以降で 'week' | 'month' を追加予定。
 */

import { useCallback, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import type { HandoffDayScope } from '../handoffTypes';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type DateRange = 'day' | 'week' | 'month';

export interface HandoffDateNavState {
  /** 基準日 (YYYY-MM-DD, JST) */
  date: string;
  /** 表示レンジ (P0 では 'day' のみ) */
  range: DateRange;
  /** 旧互換: dayScope 相当 ('today' | 'yesterday' | 日付指定) */
  dayScope: HandoffDayScope;
  /** 遷移元が /today かどうか */
  fromToday: boolean;
}

export interface HandoffDateNavActions {
  /** 前日に移動 */
  goToPreviousDay: () => void;
  /** 翌日に移動 (未来は今日まで) */
  goToNextDay: () => void;
  /** 任意の日付に移動 */
  goToDate: (dateStr: string) => void;
  /** 今日に移動 */
  goToToday: () => void;
  /** 今日かどうか */
  isToday: boolean;
  /** 表示用ラベル */
  dateLabel: string;
}

// ────────────────────────────────────────────────────────────
// Pure helpers
// ────────────────────────────────────────────────────────────

/** YYYY-MM-DD を JST で生成 (timezone-safe) */
export function formatDateLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD 文字列 → Date */
export function parseDateString(s: string): Date | null {
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  // Invalid date check
  if (isNaN(d.getTime())) return null;
  return d;
}

/** date を +/- n 日移動 */
export function addDays(dateStr: string, n: number): string {
  const d = parseDateString(dateStr);
  if (!d) return dateStr;
  d.setDate(d.getDate() + n);
  return formatDateLocal(d);
}

/** dayScope → date 変換 */
export function dayScopeToDate(scope: HandoffDayScope): string {
  const today = formatDateLocal();
  if (scope === 'yesterday') {
    return addDays(today, -1);
  }
  // 'today' | 'week' → 基準日は今日
  return today;
}

/** date → dayScope への逆変換 (互換用) */
export function dateToDayScope(dateStr: string): HandoffDayScope {
  const today = formatDateLocal();
  const yesterday = addDays(today, -1);
  if (dateStr === today) return 'today';
  if (dateStr === yesterday) return 'yesterday';
  // 任意日は 'today' として返す (data hook では date で直接取得)
  return 'today';
}

/** 日本語で日付ラベルを生成 */
export function formatDateLabel(dateStr: string): string {
  const today = formatDateLocal();
  const yesterday = addDays(today, -1);

  if (dateStr === today) return '今日';
  if (dateStr === yesterday) return '昨日';

  const d = parseDateString(dateStr);
  if (!d) return dateStr;

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const dow = weekdays[d.getDay()];

  return `${month}月${day}日（${dow}）`;
}

/** range パラメータの parse & validate */
export function parseRange(raw: string | null): DateRange {
  if (raw === 'week' || raw === 'month') return raw;
  return 'day';
}

// ────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────

/**
 * URL (?range, ?date) と location.state を統合して
 * 日付ナビゲーション状態 + アクションを返す。
 */
export function useHandoffDateNav(): HandoffDateNavState & HandoffDateNavActions {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const navState = location.state as
    | { dayScope?: HandoffDayScope; from?: 'today' }
    | undefined;

  // ── 日付解決 ──────────────────────────────────────────────
  const resolvedDate = useMemo(() => {
    // 1. URL ?date= が最優先
    const urlDate = searchParams.get('date')?.trim();
    if (urlDate && parseDateString(urlDate)) return urlDate;

    // 2. location.state.dayScope から変換
    if (navState?.dayScope) return dayScopeToDate(navState.dayScope);

    // 3. fallback: 今日
    return formatDateLocal();
  }, [searchParams, navState?.dayScope]);

  const range = parseRange(searchParams.get('range'));
  const dayScope = dateToDayScope(resolvedDate);
  const fromToday = navState?.from === 'today';
  const todayStr = formatDateLocal();
  const isToday = resolvedDate === todayStr;

  // ── 日付移動アクション ────────────────────────────────────
  const updateDate = useCallback(
    (newDate: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('range', 'day');
          next.set('date', newDate);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const goToPreviousDay = useCallback(() => {
    updateDate(addDays(resolvedDate, -1));
  }, [resolvedDate, updateDate]);

  const goToNextDay = useCallback(() => {
    // 未来は今日まで
    const next = addDays(resolvedDate, 1);
    if (next <= todayStr) {
      updateDate(next);
    }
  }, [resolvedDate, todayStr, updateDate]);

  const goToDate = useCallback(
    (dateStr: string) => {
      if (parseDateString(dateStr)) {
        updateDate(dateStr);
      }
    },
    [updateDate],
  );

  const goToToday = useCallback(() => {
    updateDate(todayStr);
  }, [todayStr, updateDate]);

  const dateLabel = formatDateLabel(resolvedDate);

  return {
    date: resolvedDate,
    range,
    dayScope,
    fromToday,
    isToday,
    dateLabel,
    goToPreviousDay,
    goToNextDay,
    goToDate,
    goToToday,
  };
}
