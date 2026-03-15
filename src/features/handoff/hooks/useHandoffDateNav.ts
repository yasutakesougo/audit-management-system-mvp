/**
 * useHandoffDateNav — /handoff-timeline の日付ナビゲーション管理
 *
 * URL: ?range=day|week|month&date=YYYY-MM-DD
 *
 * 解決ルール:
 *  1. URL の `date` パラメータがあればそれを使う
 *  2. なければ location.state.dayScope を date に変換
 *  3. 最終 fallback: 今日
 *
 * P0: day ビュー
 * P1: week ビュー（月曜始まり）
 * P2: month ビュー（カレンダーグリッド）
 */

import { useCallback, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import type { HandoffDayScope } from '../handoffTypes';
import type { EntryMode } from './useHandoffDayViewState';
import { formatDateIso } from '@/lib/dateFormat';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type DateRange = 'day' | 'week' | 'month';

export interface HandoffDateNavState {
  /** 基準日 (YYYY-MM-DD, JST) */
  date: string;
  /** 表示レンジ */
  range: DateRange;
  /** 旧互換: dayScope 相当 ('today' | 'yesterday' | 日付指定) */
  dayScope: HandoffDayScope;
  /** 遷移経路: /today 経由か直接アクセスか */
  entryMode: EntryMode;
  /** range=week のとき: 週の月〜日 [start, end] */
  weekRange: [string, string] | null;
  /** range=month のとき: 月の [1日, 末日] */
  monthRange: [string, string] | null;
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
  /** 前週に移動 */
  goToPreviousWeek: () => void;
  /** 翌週に移動 (未来は今週まで) */
  goToNextWeek: () => void;
  /** 指定日を含む週に移動 */
  goToWeekOf: (dateStr: string) => void;
  /** 前月に移動 */
  goToPreviousMonth: () => void;
  /** 翌月に移動 (未来は今月まで) */
  goToNextMonth: () => void;
  /** 指定日を含む月に移動 */
  goToMonthOf: (dateStr: string) => void;
  /** range を切り替え */
  setRange: (range: DateRange) => void;
  /** 今日かどうか */
  isToday: boolean;
  /** 表示用ラベル (day: '今日', week: '3/10〜3/16', month: '2026年3月') */
  dateLabel: string;
}

// ────────────────────────────────────────────────────────────
// Pure helpers
// ────────────────────────────────────────────────────────────

/** YYYY-MM-DD を JST で生成 (timezone-safe)
 * @deprecated 内部実装は formatDateIso に委譲。デフォルト引数の維持のため wrapper を残す。
 */
export function formatDateLocal(d: Date = new Date()): string {
  return formatDateIso(d);
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

// ── Week helpers (月曜始まり) ──────────────────────────────────

/**
 * 指定日を含む週の [月曜, 日曜] を返す。
 * 月曜始まり: JS Date.getDay() で 0=日, 1=月, ..., 6=土
 */
export function getWeekRange(dateStr: string): [string, string] {
  const d = parseDateString(dateStr);
  if (!d) {
    // fallback: 今日の週
    return getWeekRange(formatDateLocal());
  }
  // JS getDay: 0=Sun → offset=6, 1=Mon → offset=0, ..., 6=Sat → offset=5
  const jsDay = d.getDay();
  const offset = jsDay === 0 ? 6 : jsDay - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - offset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [formatDateLocal(monday), formatDateLocal(sunday)];
}

/** 基準日を +/- n 週移動 (7日単位) */
export function addWeeks(dateStr: string, n: number): string {
  return addDays(dateStr, n * 7);
}

/** 週ラベル: "3/10（月）〜 3/16（日）" */
export function formatWeekLabel(startStr: string, endStr: string): string {
  const s = parseDateString(startStr);
  const e = parseDateString(endStr);
  if (!s || !e) return `${startStr} 〜 ${endStr}`;

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const sLabel = `${s.getMonth() + 1}/${s.getDate()}（${weekdays[s.getDay()]}）`;
  const eLabel = `${e.getMonth() + 1}/${e.getDate()}（${weekdays[e.getDay()]}）`;
  return `${sLabel}〜 ${eLabel}`;
}

// ── Month helpers ─────────────────────────────────────────────

/**
 * 指定日を含む月の [1日, 末日] を返す。
 */
export function getMonthRange(dateStr: string): [string, string] {
  const d = parseDateString(dateStr);
  if (!d) {
    return getMonthRange(formatDateLocal());
  }
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0); // 翌月0日 = 今月末日
  return [formatDateLocal(firstDay), formatDateLocal(lastDay)];
}

/** 基準日を +/- n 月移動 (同日を維持。28→28, 31→末日clamp) */
export function addMonths(dateStr: string, n: number): string {
  const d = parseDateString(dateStr);
  if (!d) return dateStr;
  const targetMonth = d.getMonth() + n;
  const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const maxDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const day = Math.min(d.getDate(), maxDay);
  return formatDateLocal(new Date(targetYear, normalizedMonth, day));
}

/** 月ラベル: "2026年3月" */
export function formatMonthLabel(dateStr: string): string {
  const d = parseDateString(dateStr);
  if (!d) return dateStr;
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

// ────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────

/**
 * URL (?range, ?date) と location.state を統合して
 * 日付ナビゲーション状態 + アクションを返す。
 *
 * range=day: 基準日1日
 * range=week: 基準日を含む月〜日の7日間
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
  const entryMode: EntryMode = navState?.from === 'today' ? 'from-today' : 'direct';
  const todayStr = formatDateLocal();
  const isToday = resolvedDate === todayStr;

  // ── Week range ─────────────────────────────────────────────
  const weekRange = useMemo<[string, string] | null>(() => {
    if (range !== 'week') return null;
    return getWeekRange(resolvedDate);
  }, [range, resolvedDate]);

  // ── Month range ────────────────────────────────────────────
  const monthRange = useMemo<[string, string] | null>(() => {
    if (range !== 'month') return null;
    return getMonthRange(resolvedDate);
  }, [range, resolvedDate]);

  // ── URL 更新共通 ───────────────────────────────────────────
  const updateParams = useCallback(
    (newDate: string, newRange: DateRange) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('range', newRange);
          next.set('date', newDate);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // ── Day アクション ─────────────────────────────────────────
  const goToPreviousDay = useCallback(() => {
    updateParams(addDays(resolvedDate, -1), 'day');
  }, [resolvedDate, updateParams]);

  const goToNextDay = useCallback(() => {
    const next = addDays(resolvedDate, 1);
    if (next <= todayStr) {
      updateParams(next, 'day');
    }
  }, [resolvedDate, todayStr, updateParams]);

  const goToDate = useCallback(
    (dateStr: string) => {
      if (parseDateString(dateStr)) {
        updateParams(dateStr, 'day');
      }
    },
    [updateParams],
  );

  const goToToday = useCallback(() => {
    updateParams(todayStr, range);
  }, [todayStr, range, updateParams]);

  // ── Week アクション ────────────────────────────────────────
  const goToPreviousWeek = useCallback(() => {
    updateParams(addWeeks(resolvedDate, -1), 'week');
  }, [resolvedDate, updateParams]);

  const goToNextWeek = useCallback(() => {
    const nextDate = addWeeks(resolvedDate, 1);
    const [, nextSunday] = getWeekRange(nextDate);
    // 翌週の日曜が今日以降なら今週止まり
    if (nextSunday > todayStr) return;
    updateParams(nextDate, 'week');
  }, [resolvedDate, todayStr, updateParams]);

  const goToWeekOf = useCallback(
    (dateStr: string) => {
      if (parseDateString(dateStr)) {
        updateParams(dateStr, 'week');
      }
    },
    [updateParams],
  );

  // ── Month アクション ───────────────────────────────────────
  const goToPreviousMonth = useCallback(() => {
    updateParams(addMonths(resolvedDate, -1), 'month');
  }, [resolvedDate, updateParams]);

  const goToNextMonth = useCallback(() => {
    const nextDate = addMonths(resolvedDate, 1);
    const [, nextEnd] = getMonthRange(nextDate);
    if (nextEnd > todayStr) return;
    updateParams(nextDate, 'month');
  }, [resolvedDate, todayStr, updateParams]);

  const goToMonthOf = useCallback(
    (dateStr: string) => {
      if (parseDateString(dateStr)) {
        updateParams(dateStr, 'month');
      }
    },
    [updateParams],
  );

  // ── Range 切り替え ─────────────────────────────────────────
  const setRange = useCallback(
    (newRange: DateRange) => {
      updateParams(resolvedDate, newRange);
    },
    [resolvedDate, updateParams],
  );

  // ── Label ──────────────────────────────────────────────────
  const dateLabel = useMemo(() => {
    if (range === 'month') {
      return formatMonthLabel(resolvedDate);
    }
    if (range === 'week' && weekRange) {
      return formatWeekLabel(weekRange[0], weekRange[1]);
    }
    return formatDateLabel(resolvedDate);
  }, [range, weekRange, resolvedDate]);

  return {
    date: resolvedDate,
    range,
    dayScope,
    entryMode,
    isToday,
    weekRange,
    monthRange,
    dateLabel,
    goToPreviousDay,
    goToNextDay,
    goToDate,
    goToToday,
    goToPreviousWeek,
    goToNextWeek,
    goToWeekOf,
    goToPreviousMonth,
    goToNextMonth,
    goToMonthOf,
    setRange,
  };
}
