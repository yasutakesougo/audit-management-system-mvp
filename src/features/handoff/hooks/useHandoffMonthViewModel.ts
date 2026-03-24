/**
 * useHandoffMonthViewModel — 月ビュー用 ViewModel
 *
 * 責務:
 * 1. 月範囲のカレンダーグリッド (月曜始まり 6行分) を生成
 * 2. handoff データを日別に集計
 * 3. 各日のサマリー (件数 + 上位カテゴリ + ヒヤリ) を計算
 * 4. 月全体のサマリーを計算
 *
 * UI は返り値の `MonthViewModel` だけに依存する。
 */

import { useMemo } from 'react';
import type { HandoffRecord } from '../handoffTypes';
import { useHandoffTimeline } from '../useHandoffTimeline';
import {
  getMonthRange,
  parseDateString,
} from './useHandoffDateNav';
import { formatDateIso } from '@/lib/dateFormat';
import { buildTopCategories } from './useHandoffWeekViewModel';
import type { CategoryCount } from './useHandoffWeekViewModel';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

/** 月カレンダーの1日分 */
export interface MonthDaySummary {
  /** YYYY-MM-DD */
  date: string;
  /** 日 (1-31) */
  day: number;
  /** 曜日インデックス (0=日, 1=月, ...) */
  dayOfWeek: number;
  /** その日の全件数 */
  count: number;
  /** 上位カテゴリ (最大2件) */
  topCategories: CategoryCount[];
  /** 事故・ヒヤリが含まれるか */
  hasIncident: boolean;
  /** 未対応件数 */
  unhandledCount: number;
  /** 今日かどうか */
  isToday: boolean;
  /** 未来日かどうか */
  isFuture: boolean;
  /** 対象月の日かどうか (前月/翌月のパディング日は false) */
  isCurrentMonth: boolean;
}

/** カレンダーグリッドの1週間分 */
export interface MonthWeekRow {
  /** 7日分の日サマリー (月〜日) */
  days: MonthDaySummary[];
}

/** 月全体のサマリー */
export interface MonthSummary {
  /** カレンダー行 (5-6 行) */
  weeks: MonthWeekRow[];
  /** 対象月の年 */
  year: number;
  /** 対象月 (1-12) */
  month: number;
  /** 月全体の合計件数 */
  totalCount: number;
  /** 月全体の未対応件数 */
  unhandledCount: number;
  /** 月全体の上位カテゴリ (最大3件) */
  topCategories: CategoryCount[];
  /** 事故・ヒヤリが含まれる日があるか */
  hasIncident: boolean;
  /** 1件以上の日が存在するか */
  hasAnyItems: boolean;
}

/** ViewModel の返り値 */
export interface MonthViewModel {
  summary: MonthSummary;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const MAX_TOP_CATEGORIES_DAY = 2;
const MAX_TOP_CATEGORIES_MONTH = 3;

// ────────────────────────────────────────────────────────────
// Pure helpers
// ────────────────────────────────────────────────────────────

/**
 * 月カレンダーグリッドを生成する (月曜始まり)
 *
 * 前月末・翌月頭のパディング日も含め、
 * 完全な週 (月〜日) のグリッド行を返す。
 *
 * @param year 年
 * @param month 月 (1-12)
 */
export function buildMonthGrid(year: number, month: number): MonthWeekRow[] {
  const today = formatDateIso(new Date());

  // 月の初日・末日
  const firstDate = new Date(year, month - 1, 1);
  const lastDate = new Date(year, month, 0);
  const lastDay = lastDate.getDate();

  // 月曜始まりのオフセット: JS Day 0=Sun → 6, 1=Mon → 0, ..., 6=Sat → 5
  const firstDow = firstDate.getDay();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;

  // グリッド開始日: 月初より前の月曜
  const gridStart = new Date(firstDate);
  gridStart.setDate(firstDate.getDate() - startOffset);

  const weeks: MonthWeekRow[] = [];
  const cursor = new Date(gridStart);

  // 最低4行、月末を超えるまで行を追加 (最大6行)
  while (weeks.length < 6) {
    const row: MonthDaySummary[] = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = formatDateIso(cursor);
      const isCurrentMonth =
        cursor.getMonth() === month - 1 && cursor.getFullYear() === year;

      row.push({
        date: dateStr,
        day: cursor.getDate(),
        dayOfWeek: cursor.getDay(),
        count: 0,
        topCategories: [],
        hasIncident: false,
        unhandledCount: 0,
        isToday: dateStr === today,
        isFuture: dateStr > today,
        isCurrentMonth,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push({ days: row });

    // 月末を含む行を過ぎたら終了
    // ただし最低4行は確保
    if (weeks.length >= 4) {
      const lastDayInRow = row[row.length - 1];
      if (
        !lastDayInRow.isCurrentMonth ||
        parseDateString(lastDayInRow.date)!.getDate() >= lastDay
      ) {
        break;
      }
    }
  }

  return weeks;
}

/**
 * handoff レコードをカレンダーグリッドに集計する
 */
export function populateMonthGrid(
  weeks: MonthWeekRow[],
  items: HandoffRecord[],
): MonthWeekRow[] {
  // 日付 → セルの参照マップ
  const cellMap = new Map<string, MonthDaySummary>();
  const categoryCounters = new Map<string, Map<string, number>>();

  for (const week of weeks) {
    for (const day of week.days) {
      cellMap.set(day.date, day);
      categoryCounters.set(day.date, new Map());
    }
  }

  for (const item of items) {
    const dateStr = extractDateFromRecord(item);
    if (!dateStr) continue;
    const cell = cellMap.get(dateStr);
    if (!cell) continue;

    cell.count += 1;
    if (item.status === '未対応') cell.unhandledCount += 1;

    const catMap = categoryCounters.get(dateStr)!;
    catMap.set(item.category, (catMap.get(item.category) || 0) + 1);
  }

  // カテゴリ集計を確定
  for (const [date, cell] of cellMap) {
    const catMap = categoryCounters.get(date);
    if (!catMap || catMap.size === 0) continue;

    cell.topCategories = buildTopCategories(catMap, MAX_TOP_CATEGORIES_DAY);
    cell.hasIncident = catMap.has('事故・ヒヤリ') && (catMap.get('事故・ヒヤリ')! > 0);
  }

  return weeks;
}

/**
 * カレンダーグリッドから月全体のサマリーを計算
 */
export function buildMonthSummary(
  weeks: MonthWeekRow[],
  year: number,
  month: number,
): MonthSummary {
  let totalCount = 0;
  let unhandledCount = 0;
  let hasIncident = false;
  const monthCategoryMap = new Map<string, number>();

  for (const week of weeks) {
    for (const day of week.days) {
      if (!day.isCurrentMonth) continue; // パディング日は集計外

      totalCount += day.count;
      unhandledCount += day.unhandledCount;
      if (day.hasIncident) hasIncident = true;

      for (const cat of day.topCategories) {
        monthCategoryMap.set(cat.category, (monthCategoryMap.get(cat.category) || 0) + cat.count);
      }
    }
  }

  return {
    weeks,
    year,
    month,
    totalCount,
    unhandledCount,
    topCategories: buildTopCategories(monthCategoryMap, MAX_TOP_CATEGORIES_MONTH),
    hasIncident,
    hasAnyItems: totalCount > 0,
  };
}

// ── 内部ヘルパー ──

function extractDateFromRecord(record: HandoffRecord): string | null {
  if (!record.createdAt) return null;
  try {
    const d = new Date(record.createdAt);
    if (isNaN(d.getTime())) return null;
    return formatDateIso(d);
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────

/**
 * 月ビュー ViewModel を生成する Hook
 *
 * @param date 基準日 (YYYY-MM-DD) — この日を含む月を表示
 */
export function useHandoffMonthViewModel(date: string): MonthViewModel {
  const monthRange = useMemo(() => getMonthRange(date), [date]);

  // 既存 hook: 'week' scope (直近7日) では月全体を取れないので、
  // 月の取得は dayScope='today' で全件取得し、
  // pure function 側でフィルタする方式を採用。
  // NOTE: 既存 API の制約上、直近の月データのみ対応。
  const {
    todayHandoffs: allItems,
    loading,
    error,
    reload,
  } = useHandoffTimeline('all', 'week');

  const summary = useMemo(() => {
    const d = parseDateString(date);
    const year = d ? d.getFullYear() : new Date().getFullYear();
    const month = d ? d.getMonth() + 1 : new Date().getMonth() + 1;

    const grid = buildMonthGrid(year, month);
    const populated = populateMonthGrid(grid, allItems);
    return buildMonthSummary(populated, year, month);
  }, [date, allItems]);

  // 月範囲を返り値に含めるかは省略 (hook 外で monthRange を使う)
  void monthRange;

  return {
    summary,
    loading,
    error,
    reload,
  };
}
