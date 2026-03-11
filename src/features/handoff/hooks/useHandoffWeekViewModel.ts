/**
 * useHandoffWeekViewModel — 週ビュー用 ViewModel
 *
 * 責務:
 * 1. 週範囲 (月〜日) の handoff データを取得
 * 2. 日別バケットに分類
 * 3. 各日のサマリーを計算
 * 4. 週全体のサマリーを計算
 *
 * UI は返り値の `WeekViewModel` だけに依存する。
 */

import { useMemo } from 'react';
import type { HandoffCategory, HandoffRecord, HandoffSeverity, HandoffStatus } from '../handoffTypes';
import { useHandoffTimeline } from '../useHandoffTimeline';
import { formatDateLocal, getWeekRange, parseDateString } from './useHandoffDateNav';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

/** カテゴリ別件数 */
export interface CategoryCount {
  category: HandoffCategory;
  count: number;
}

/** 1日分のサマリー */
export interface WeekDaySummary {
  /** YYYY-MM-DD */
  date: string;
  /** 表示用ラベル (例: '3/10 月') */
  label: string;
  /** 曜日インデックス (0=日, 1=月, ...) */
  dayOfWeek: number;
  /** その日の全件数 */
  count: number;
  /** severity='重要' の件数 */
  criticalCount: number;
  /** status='未対応' の件数 */
  unhandledCount: number;
  /** 上位カテゴリ (件数降順, 最大 MAX_TOP_CATEGORIES 件) */
  topCategories: CategoryCount[];
  /** 事故・ヒヤリが含まれるか */
  hasIncident: boolean;
  /** 今日かどうか */
  isToday: boolean;
  /** 未来日かどうか (データなし想定) */
  isFuture: boolean;
}

/** 週全体のサマリー */
export interface WeekSummary {
  /** 7日分の日別サマリー (月〜日順) */
  days: WeekDaySummary[];
  /** 週全体の合計件数 */
  totalCount: number;
  /** 週全体の重要件数 */
  criticalCount: number;
  /** 週全体の未対応件数 */
  unhandledCount: number;
  /** 週全体の上位カテゴリ (件数降順) */
  topCategories: CategoryCount[];
  /** 事故・ヒヤリが含まれる日があるか */
  hasIncident: boolean;
  /** 1件以上の日が存在するか */
  hasAnyItems: boolean;
}

/** ViewModel の返り値 */
export interface WeekViewModel {
  /** 週サマリー */
  summary: WeekSummary;
  /** ローディング中か */
  loading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** 再取得 */
  reload: () => void;
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const WEEKDAY_SHORT = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** カードに表示する上位カテゴリの最大数 */
const MAX_TOP_CATEGORIES = 2;

/**
 * カテゴリの優先度 (数値が大きいほど同件数時に上に来る)
 * 事故・ヒヤリは特別扱いで最高優先度
 */
const CATEGORY_PRIORITY: Record<string, number> = {
  '事故・ヒヤリ': 100,
  '体調': 80,
  '行動面': 60,
  '家族連絡': 40,
  '送迎': 30,
  '支援の工夫': 20,
  '良かったこと': 10,
  'その他': 0,
};

// ────────────────────────────────────────────────────────────
// Pure helpers
// ────────────────────────────────────────────────────────────

/**
 * 月曜〜日曜の7日分の空バケットを生成
 *
 * @param startStr 月曜の日付 (YYYY-MM-DD)
 * @param endStr   日曜の日付 (YYYY-MM-DD)
 */
export function buildWeekBuckets(startStr: string, endStr: string): WeekDaySummary[] {
  const start = parseDateString(startStr);
  const end = parseDateString(endStr);
  if (!start || !end) return [];

  const today = formatDateLocal();
  const days: WeekDaySummary[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const dateStr = formatDateLocal(cursor);
    const dow = cursor.getDay();
    days.push({
      date: dateStr,
      label: `${cursor.getMonth() + 1}/${cursor.getDate()} ${WEEKDAY_SHORT[dow]}`,
      dayOfWeek: dow,
      count: 0,
      criticalCount: 0,
      unhandledCount: 0,
      topCategories: [],
      hasIncident: false,
      isToday: dateStr === today,
      isFuture: dateStr > today,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

/**
 * handoff レコードを日付で分類し、日別サマリーのバケットに集計する
 *
 * @param items     handoff 全件 (日付混在可)
 * @param weekRange [月曜, 日曜]
 */
export function groupHandoffsByDate(
  items: HandoffRecord[],
  weekRange: [string, string],
): WeekDaySummary[] {
  const buckets = buildWeekBuckets(weekRange[0], weekRange[1]);
  const bucketMap = new Map<string, WeekDaySummary>();
  // 日ごとのカテゴリ別カウンタ
  const categoryCounters = new Map<string, Map<string, number>>();

  for (const b of buckets) {
    bucketMap.set(b.date, b);
    categoryCounters.set(b.date, new Map());
  }

  for (const item of items) {
    const dateStr = extractDateFromRecord(item);
    if (!dateStr) continue;
    const bucket = bucketMap.get(dateStr);
    if (!bucket) continue;

    bucket.count += 1;
    if (isCritical(item.severity)) bucket.criticalCount += 1;
    if (isUnhandled(item.status)) bucket.unhandledCount += 1;

    // カテゴリ集計
    const catMap = categoryCounters.get(dateStr)!;
    catMap.set(item.category, (catMap.get(item.category) || 0) + 1);
  }

  // 各日のカテゴリ集計を確定
  for (const bucket of buckets) {
    const catMap = categoryCounters.get(bucket.date);
    if (!catMap || catMap.size === 0) continue;

    bucket.topCategories = buildTopCategories(catMap, MAX_TOP_CATEGORIES);
    bucket.hasIncident = catMap.has('事故・ヒヤリ') && (catMap.get('事故・ヒヤリ')! > 0);
  }

  return buckets;
}

/**
 * 日別サマリーから週全体のサマリーを計算
 */
export function buildWeekSummary(days: WeekDaySummary[]): WeekSummary {
  let totalCount = 0;
  let criticalCount = 0;
  let unhandledCount = 0;
  let hasIncident = false;
  const weekCategoryMap = new Map<string, number>();

  for (const day of days) {
    totalCount += day.count;
    criticalCount += day.criticalCount;
    unhandledCount += day.unhandledCount;
    if (day.hasIncident) hasIncident = true;

    for (const cat of day.topCategories) {
      weekCategoryMap.set(cat.category, (weekCategoryMap.get(cat.category) || 0) + cat.count);
    }
  }

  return {
    days,
    totalCount,
    criticalCount,
    unhandledCount,
    topCategories: buildTopCategories(weekCategoryMap, 3),
    hasIncident,
    hasAnyItems: totalCount > 0,
  };
}

// ── 内部ヘルパー ──

/** HandoffRecord から日付 (YYYY-MM-DD) を抽出 */
function extractDateFromRecord(record: HandoffRecord): string | null {
  if (!record.createdAt) return null;
  // ISO 形式: "2026-03-11T09:30:00.000Z" → "2026-03-11"
  // ローカル日付で判定するため Date 経由で変換
  try {
    const d = new Date(record.createdAt);
    if (isNaN(d.getTime())) return null;
    return formatDateLocal(d);
  } catch {
    return null;
  }
}

function isCritical(severity: HandoffSeverity): boolean {
  return severity === '重要';
}

function isUnhandled(status: HandoffStatus): boolean {
  return status === '未対応';
}

/**
 * カテゴリカウントマップから上位N件を抽出する
 * 同件数の場合は CATEGORY_PRIORITY が高い方を優先
 */
export function buildTopCategories(
  catMap: Map<string, number>,
  maxCount: number,
): CategoryCount[] {
  return Array.from(catMap.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => {
      // 件数降順
      if (b[1] !== a[1]) return b[1] - a[1];
      // 同件数なら優先度降順
      return (CATEGORY_PRIORITY[b[0]] ?? 0) - (CATEGORY_PRIORITY[a[0]] ?? 0);
    })
    .slice(0, maxCount)
    .map(([category, count]) => ({ category: category as HandoffCategory, count }));
}

// ────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────

/**
 * 週ビュー ViewModel を生成する Hook
 *
 * 既存の useHandoffTimeline(timeFilter, 'week') を流用して
 * 7日分のデータを一括取得し、pure function で日別集計する。
 *
 * @param date 基準日 (YYYY-MM-DD) — この日を含む週の月〜日を表示
 */
export function useHandoffWeekViewModel(date: string): WeekViewModel {
  const weekRange = useMemo(() => getWeekRange(date), [date]);

  // 既存 hook: 'week' scope で直近7日を取得
  // NOTE: 既存 repo は 'week' = 直近7日だが、週範囲とは完全一致しない可能性がある。
  // 許容範囲として、取得後に weekRange でフィルタする。
  const {
    todayHandoffs: allItems,
    loading,
    error,
    reload,
  } = useHandoffTimeline('all', 'week');

  const summary = useMemo(() => {
    const days = groupHandoffsByDate(allItems, weekRange);
    return buildWeekSummary(days);
  }, [allItems, weekRange]);

  return {
    summary,
    loading,
    error,
    reload,
  };
}
