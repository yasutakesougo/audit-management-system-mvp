/**
 * 時間帯パターン分析 — Pure Function
 *
 * @description
 * HandoffRecord[] を timeBand × dayOfWeek で集約し、
 * 曜日・時間帯ごとの申し送り傾向を可視化可能な形で返す。
 *
 * 設計方針:
 * - 既存の TimeBand 定義（朝/午前/午後/夕方）に完全準拠
 * - 既存の getCurrentTimeBand() の境界値と一致
 * - createdAt から時刻・曜日を抽出してグルーピング
 * - Pure Function: React / Hook / 外部API への依存ゼロ
 *
 * @see handoffConstants.ts — getCurrentTimeBand() の境界値定義
 * @see analysisTypes.ts — TimePattern 型定義
 */

import type {
  HandoffCategory,
  HandoffRecord,
  TimeBand,
} from './analysisTypes';

// ────────────────────────────────────────────────────────────
// TimeBand 順序定義
// ────────────────────────────────────────────────────────────

/**
 * TimeBand の自然順序。
 * ソート用に使用する。
 */
const TIME_BAND_ORDER: readonly TimeBand[] = ['朝', '午前', '午後', '夕方'] as const;

/**
 * 時刻(hour) → TimeBand 変換
 *
 * getCurrentTimeBand() と同一の境界値:
 * - 朝:   6:00-8:59
 * - 午前: 9:00-11:59
 * - 午後: 12:00-16:59
 * - 夕方: 17:00-23:59, 0:00-5:59
 */
export function hourToTimeBand(hour: number): TimeBand {
  if (hour >= 6 && hour < 9) return '朝';
  if (hour >= 9 && hour < 12) return '午前';
  if (hour >= 12 && hour < 17) return '午後';
  return '夕方';
}

// ────────────────────────────────────────────────────────────
// 出力型
// ────────────────────────────────────────────────────────────

/** 曜日ラベル（UI 表示用） */
export const DAY_OF_WEEK_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/**
 * 時間帯 × 曜日パターンの集計結果
 */
export interface TimePatternEntry {
  /** 時間帯（朝/午前/午後/夕方） */
  timeBand: TimeBand;
  /** 曜日 (0=日, 1=月, ..., 6=土) */
  dayOfWeek: number;
  /** 該当する申し送り件数 */
  count: number;
  /** 件数が最も多いカテゴリ */
  topCategory: HandoffCategory;
  /** カテゴリ別内訳 */
  categoryBreakdown: { category: HandoffCategory; count: number }[];
  /** 最も多い時刻 (hour, 0-23) */
  peakHour: number;
}

/**
 * computeTimePatterns の全体結果
 */
export interface TimePatternResult {
  /** dayOfWeek → timeBand 順でソートされたパターン一覧 */
  patterns: TimePatternEntry[];
  /** timeBand 別の集計（曜日を横断した合計） */
  byTimeBand: { timeBand: TimeBand; count: number; topCategory: HandoffCategory }[];
  /** 分析対象の申し送り件数（無効日時を除く） */
  totalRecordsAnalyzed: number;
}

// ────────────────────────────────────────────────────────────
// 内部ヘルパー
// ────────────────────────────────────────────────────────────

interface ParsedTime {
  dayOfWeek: number;
  hour: number;
  timeBand: TimeBand;
}

/**
 * createdAt から dayOfWeek, hour, timeBand を抽出する。
 * 無効な日時の場合は null を返す。
 *
 * ローカル時刻ベースで処理する（UTCではない）。
 */
function parseRecordTime(createdAt: string): ParsedTime | null {
  const date = new Date(createdAt);
  if (isNaN(date.getTime())) return null;

  const dayOfWeek = date.getDay();
  const hour = date.getHours();
  const timeBand = hourToTimeBand(hour);

  return { dayOfWeek, hour, timeBand };
}

/**
 * カテゴリ件数マップから最頻カテゴリを返す。
 * 同点時はカテゴリ名昇順で安定。
 */
function topCategoryFromMap(map: Map<HandoffCategory, number>): HandoffCategory {
  let topCat: HandoffCategory = 'その他';
  let topCount = 0;

  for (const [cat, count] of map) {
    if (count > topCount || (count === topCount && cat.localeCompare(topCat, 'ja') < 0)) {
      topCat = cat;
      topCount = count;
    }
  }

  return topCat;
}

/**
 * 時刻ヒストグラムから最頻時刻を返す。
 * 同点時は早い時刻を返す。
 */
function peakHourFromHistogram(histogram: Map<number, number>): number {
  let peakHr = 0;
  let peakCount = 0;

  for (const [hour, count] of histogram) {
    if (count > peakCount || (count === peakCount && hour < peakHr)) {
      peakHr = hour;
      peakCount = count;
    }
  }

  return peakHr;
}

// グループキー
function groupKey(dayOfWeek: number, timeBand: TimeBand): string {
  return `${dayOfWeek}:${timeBand}`;
}

// ────────────────────────────────────────────────────────────
// メイン関数
// ────────────────────────────────────────────────────────────

/**
 * 申し送りの時間帯 × 曜日パターンを分析する。
 *
 * @param records 分析対象の申し送りレコード
 * @returns 時間パターン分析結果
 *
 * @example
 * ```ts
 * const result = computeTimePatterns(records);
 * // result.patterns → [{ timeBand: '朝', dayOfWeek: 1, count: 5, ... }, ...]
 * // result.byTimeBand → [{ timeBand: '朝', count: 12, topCategory: '体調' }, ...]
 * ```
 */
export function computeTimePatterns(records: HandoffRecord[]): TimePatternResult {
  if (records.length === 0) {
    return { patterns: [], byTimeBand: [], totalRecordsAnalyzed: 0 };
  }

  // グループ別集計用構造体
  const groups = new Map<string, {
    timeBand: TimeBand;
    dayOfWeek: number;
    count: number;
    categories: Map<HandoffCategory, number>;
    hourHistogram: Map<number, number>;
  }>();

  // timeBand 横断集計
  const timeBandTotals = new Map<TimeBand, {
    count: number;
    categories: Map<HandoffCategory, number>;
  }>();

  let validCount = 0;

  for (const record of records) {
    const parsed = parseRecordTime(record.createdAt);
    if (!parsed) continue; // 無効日時は除外

    validCount++;
    const key = groupKey(parsed.dayOfWeek, parsed.timeBand);
    const category = record.category as HandoffCategory;

    // グループ別集計
    let group = groups.get(key);
    if (!group) {
      group = {
        timeBand: parsed.timeBand,
        dayOfWeek: parsed.dayOfWeek,
        count: 0,
        categories: new Map(),
        hourHistogram: new Map(),
      };
      groups.set(key, group);
    }
    group.count++;
    group.categories.set(category, (group.categories.get(category) ?? 0) + 1);
    group.hourHistogram.set(parsed.hour, (group.hourHistogram.get(parsed.hour) ?? 0) + 1);

    // timeBand 横断集計
    let tbTotal = timeBandTotals.get(parsed.timeBand);
    if (!tbTotal) {
      tbTotal = { count: 0, categories: new Map() };
      timeBandTotals.set(parsed.timeBand, tbTotal);
    }
    tbTotal.count++;
    tbTotal.categories.set(category, (tbTotal.categories.get(category) ?? 0) + 1);
  }

  // patterns 組み立て + ソート
  const patterns: TimePatternEntry[] = [...groups.values()]
    .map((g) => {
      const categoryBreakdown = [...g.categories.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, 'ja'));

      return {
        timeBand: g.timeBand,
        dayOfWeek: g.dayOfWeek,
        count: g.count,
        topCategory: topCategoryFromMap(g.categories),
        categoryBreakdown,
        peakHour: peakHourFromHistogram(g.hourHistogram),
      };
    })
    .sort((a, b) => {
      // dayOfWeek 昇順 → timeBand 自然順
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return TIME_BAND_ORDER.indexOf(a.timeBand) - TIME_BAND_ORDER.indexOf(b.timeBand);
    });

  // byTimeBand 組み立て（自然順）
  const byTimeBand = TIME_BAND_ORDER
    .filter((tb) => timeBandTotals.has(tb))
    .map((tb) => {
      const data = timeBandTotals.get(tb)!;
      return {
        timeBand: tb,
        count: data.count,
        topCategory: topCategoryFromMap(data.categories),
      };
    });

  return {
    patterns,
    byTimeBand,
    totalRecordsAnalyzed: validCount,
  };
}

/** @internal テスト用エクスポート */
export const __test__ = {
  hourToTimeBand,
  parseRecordTime,
  TIME_BAND_ORDER,
};
