/**
 * @fileoverview Phase F1: 行動タグ分析 — pure domain functions
 * @description
 * DailyTableRecord[] を入力に、タグ頻度集計・トレンド計算を行う。
 * 既存の aggregateBehaviorTags (monitoringDailyAnalytics) の上位レイヤーとして、
 * より軽量 & 汎用な集計を提供する。
 *
 * SSOT: タグ定義は behaviorTag.ts、集計詳細は monitoringDailyAnalytics.ts
 */

import { BEHAVIOR_TAGS, type BehaviorTagKey, BEHAVIOR_TAG_CATEGORIES, type BehaviorTagCategory } from '@/features/daily/domain/behaviorTag';

// ─── 型定義 ──────────────────────────────────────────────

/** タグキー → 出現回数 */
export type TagCount = Record<string, number>;

/** トレンド1件分 */
export type TagTrendItem = {
  diff: number;
  direction: 'up' | 'down' | 'flat';
};

/** トレンド全体 */
export type TagTrend = Record<string, TagTrendItem>;

/** タグ × 時間帯の集計 */
export type TagTimeSlotDistribution = {
  /** 午前に出現したタグ頻度 */
  am: TagCount;
  /** 午後に出現したタグ頻度 */
  pm: TagCount;
};

/** 利用者別トップタグ */
export type UserTopTags = {
  userId: string;
  topTags: Array<{ key: string; label: string; count: number }>;
  totalTags: number;
};

/** 入力の最小型 */
export type TagAnalyticsInput = {
  userId?: string;
  recordDate: string;
  behaviorTags?: string[];
  activities?: { am?: string; pm?: string };
};

// ─── 定数 ────────────────────────────────────────────────

const MAX_TOP_TAGS = 5;

// ─── computeTagCounts ────────────────────────────────────

/**
 * 期間内のタグ出現回数を集計する。
 *
 * @param records 日次記録の配列
 * @returns タグキー → 出現回数のマップ。タグが1つもなければ空 Record を返す。
 */
export function computeTagCounts(records: TagAnalyticsInput[]): TagCount {
  const counts: TagCount = {};

  for (const r of records) {
    for (const tag of r.behaviorTags ?? []) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }

  return counts;
}

// ─── computeTagTrend ─────────────────────────────────────

/**
 * 2つの期間（current, previous）のタグ頻度を比較し、増減を計算する。
 * 両方に存在しないタグは結果に含まれない。
 * current のみに存在するタグは diff = +count, direction = 'up'。
 * previous のみに存在するタグは diff = -count, direction = 'down'。
 *
 * @param current 現在期間のタグカウント
 * @param previous 前期間のタグカウント
 * @returns タグキーごとの差分と方向
 */
export function computeTagTrend(
  current: TagCount,
  previous: TagCount,
): TagTrend {
  const allKeys = new Set([...Object.keys(current), ...Object.keys(previous)]);
  const trend: TagTrend = {};

  for (const key of allKeys) {
    const cur = current[key] ?? 0;
    const prev = previous[key] ?? 0;
    const diff = cur - prev;

    trend[key] = {
      diff,
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    };
  }

  return trend;
}

// ─── computeTagTimeSlots ─────────────────────────────────

/**
 * タグの出現を午前/午後の活動スロットで分類する。
 * 活動が記録されているスロットに対してのみカウント。
 *
 * @param records 日次記録の配列
 * @returns 午前/午後別のタグ頻度
 */
export function computeTagTimeSlots(
  records: TagAnalyticsInput[],
): TagTimeSlotDistribution {
  const am: TagCount = {};
  const pm: TagCount = {};

  for (const r of records) {
    const tags = r.behaviorTags ?? [];
    if (tags.length === 0) continue;

    const hasAm = (r.activities?.am ?? '').trim() !== '';
    const hasPm = (r.activities?.pm ?? '').trim() !== '';

    for (const tag of tags) {
      if (hasAm) {
        am[tag] = (am[tag] ?? 0) + 1;
      }
      if (hasPm) {
        pm[tag] = (pm[tag] ?? 0) + 1;
      }
    }
  }

  return { am, pm };
}

// ─── computeUserTopTags ──────────────────────────────────

/**
 * 利用者別にトップタグ（最大5件）を集計する。
 *
 * @param records 日次記録の配列（userId 付き）
 * @returns 利用者別のトップタグ一覧。タグなしの利用者は含まない。
 */
export function computeUserTopTags(
  records: TagAnalyticsInput[],
): UserTopTags[] {
  // userId ごとにタグ頻度を集計
  const userTagCounts = new Map<string, Map<string, number>>();

  for (const r of records) {
    const uid = r.userId;
    if (!uid) continue;

    for (const tag of r.behaviorTags ?? []) {
      if (!userTagCounts.has(uid)) {
        userTagCounts.set(uid, new Map());
      }
      const tagMap = userTagCounts.get(uid)!;
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
    }
  }

  // 結果を組み立て
  const results: UserTopTags[] = [];
  for (const [userId, tagMap] of userTagCounts) {
    const sorted = [...tagMap.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_TOP_TAGS);

    const totalTags = [...tagMap.values()].reduce((sum, c) => sum + c, 0);

    results.push({
      userId,
      topTags: sorted.map(([key, count]) => {
        const def = BEHAVIOR_TAGS[key as BehaviorTagKey];
        return {
          key,
          label: def?.label ?? key,
          count,
        };
      }),
      totalTags,
    });
  }

  // totalTags 降順でソート
  results.sort((a, b) => b.totalTags - a.totalTags);

  return results;
}

// ─── getTopTags (ソートヘルパー) ─────────────────────────

/**
 * TagCount からトップ N タグをラベル付きで取得する。
 *
 * @param counts タグ頻度
 * @param n 最大件数（default: 5）
 * @returns ラベル付きのトップタグ配列
 */
export function getTopTagsFromCounts(
  counts: TagCount,
  n: number = MAX_TOP_TAGS,
): Array<{ key: string; label: string; category: string; categoryLabel: string; count: number }> {
  return Object.entries(counts)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([key, count]) => {
      const def = BEHAVIOR_TAGS[key as BehaviorTagKey];
      return {
        key,
        label: def?.label ?? key,
        category: def?.category ?? 'unknown',
        categoryLabel: BEHAVIOR_TAG_CATEGORIES[def?.category as BehaviorTagCategory] ?? '不明',
        count,
      };
    });
}

// ─── 期間プリセット ──────────────────────────────────────

/** 期間プリセットキー */
export type PeriodPreset = '7d' | '30d' | '90d';

/** プリセット定義（表示ラベル + 日数） */
export const PERIOD_PRESETS: Record<PeriodPreset, { label: string; days: number }> = {
  '7d':  { label: '7日', days: 7 },
  '30d': { label: '30日', days: 30 },
  '90d': { label: '90日', days: 90 },
};

/** プリセットの表示順序 */
export const PERIOD_PRESET_ORDER: PeriodPreset[] = ['7d', '30d', '90d'];

/**
 * PeriodPreset を { from, to } の日付範囲に変換する。
 * to は今日、from は (days - 1) 日前。
 *
 * @param preset プリセットキー
 * @param today 基準日（テスト用に注入可能）
 */
export function presetToDateRange(
  preset: PeriodPreset,
  today?: string,
): { from: string; to: string } {
  const toDate = today
    ? new Date(today + 'T00:00:00')
    : new Date();
  const days = PERIOD_PRESETS[preset].days;
  const fromDate = new Date(toDate);
  fromDate.setDate(fromDate.getDate() - (days - 1));

  return {
    from: formatLocalDate(fromDate),
    to: formatLocalDate(toDate),
  };
}

/** ローカルタイムベースで YYYY-MM-DD を返す（toISOString は UTC で日付がずれるため回避） */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
