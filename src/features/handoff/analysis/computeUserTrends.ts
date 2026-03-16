/**
 * 利用者別申し送り傾向分析 — Pure Function
 *
 * @description
 * HandoffRecord[] を利用者単位にグループ化し、
 * カテゴリ分布・キーワード傾向・重要度推移・増減トレンドを算出する。
 *
 * 設計方針:
 * - `extractKeywords()` を再利用（辞書・正規化の二重実装を防ぐ）
 * - Pure Function: React / Hook / 外部API への依存ゼロ
 * - 期間フィルタは呼び出し側の責務でもよいが、option で内部でも対応
 *
 * @see analysisTypes.ts — UserTrend 型定義
 * @see extractKeywords.ts — キーワード抽出エンジン
 */

import type {
  HandoffCategory,
  HandoffRecord,
  HandoffSeverity,
  TrendDirection,
  UserTrend,
} from './analysisTypes';
import { extractKeywords } from './extractKeywords';

// ────────────────────────────────────────────────────────────
// オプション型
// ────────────────────────────────────────────────────────────

export interface ComputeUserTrendsOptions {
  /**
   * 分析対象期間（日数）。
   * 指定すると、最新レコードの createdAt から遡って periodDays 日分のみ分析対象にする。
   * 未指定の場合は全レコードを対象とする。
   */
  periodDays?: number;

  /**
   * トレンド比較の基準日。
   * 未指定の場合は最新レコードの createdAt を基準とする。
   * テストで日付を固定したい場合に使用。
   */
  baseDate?: Date;

  /**
   * topCategories の返却件数（デフォルト: 3）
   */
  topCategoryCount?: number;

  /**
   * topKeywords の返却件数（デフォルト: 5）
   */
  topKeywordCount?: number;
}

// ────────────────────────────────────────────────────────────
// 内部ヘルパー
// ────────────────────────────────────────────────────────────

/**
 * レコード群から最新の createdAt を返す。
 * 空配列の場合は現在日時。
 */
function getLatestDate(records: HandoffRecord[], baseDate?: Date): Date {
  if (baseDate) return baseDate;
  if (records.length === 0) return new Date();

  let latest = records[0].createdAt;
  for (const r of records) {
    if (r.createdAt > latest) latest = r.createdAt;
  }
  return new Date(latest);
}

/**
 * 期間フィルタを適用する。
 */
function filterByPeriod(
  records: HandoffRecord[],
  periodDays: number | undefined,
  baseDate: Date,
): HandoffRecord[] {
  if (periodDays == null) return records;

  const cutoff = new Date(baseDate);
  cutoff.setDate(cutoff.getDate() - periodDays);
  const cutoffIso = cutoff.toISOString();

  return records.filter((r) => r.createdAt >= cutoffIso);
}

/**
 * 直近 N 日 vs 前 N 日の件数比較でトレンドを判定する。
 *
 * - recent > prev × 1.2 → increasing
 * - recent < prev × 0.8 → decreasing
 * - それ以外 → stable
 * - 両方 0 → stable
 */
function computeTrendDirection(
  records: HandoffRecord[],
  baseDate: Date,
): TrendDirection {
  const recentCutoff = new Date(baseDate);
  recentCutoff.setDate(recentCutoff.getDate() - 7);
  const prevCutoff = new Date(baseDate);
  prevCutoff.setDate(prevCutoff.getDate() - 14);

  const recentIso = recentCutoff.toISOString();
  const prevIso = prevCutoff.toISOString();

  let recentCount = 0;
  let prevCount = 0;

  for (const r of records) {
    if (r.createdAt >= recentIso) {
      recentCount++;
    } else if (r.createdAt >= prevIso) {
      prevCount++;
    }
  }

  if (recentCount === 0 && prevCount === 0) return 'stable';
  if (prevCount === 0 && recentCount > 0) return 'increasing';
  if (recentCount === 0 && prevCount > 0) return 'decreasing';

  if (recentCount > prevCount * 1.2) return 'increasing';
  if (recentCount < prevCount * 0.8) return 'decreasing';
  return 'stable';
}

/**
 * カテゴリ別件数を集計し、上位 N 件を返す。
 */
function computeTopCategories(
  records: HandoffRecord[],
  count: number,
): { category: HandoffCategory; count: number }[] {
  const categoryMap = new Map<HandoffCategory, number>();

  for (const r of records) {
    const c = r.category as HandoffCategory;
    categoryMap.set(c, (categoryMap.get(c) ?? 0) + 1);
  }

  return [...categoryMap.entries()]
    .map(([category, cnt]) => ({ category, count: cnt }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, 'ja'))
    .slice(0, count);
}

/**
 * 重要度分布をゼロ埋めで返す。
 */
function computeSeverityDistribution(
  records: HandoffRecord[],
): Record<HandoffSeverity, number> {
  const dist: Record<HandoffSeverity, number> = {
    '通常': 0,
    '要注意': 0,
    '重要': 0,
  };

  for (const r of records) {
    if (r.severity in dist) {
      dist[r.severity]++;
    }
  }

  return dist;
}

/**
 * 同一 userCode の最新 displayName を取得する。
 */
function resolveDisplayName(records: HandoffRecord[]): string {
  if (records.length === 0) return '';

  let latest = records[0];
  for (const r of records) {
    if (r.createdAt > latest.createdAt) {
      latest = r;
    }
  }
  return latest.userDisplayName;
}

// ────────────────────────────────────────────────────────────
// メイン関数
// ────────────────────────────────────────────────────────────

/**
 * 利用者別の申し送り傾向を算出する。
 *
 * @param records 分析対象の申し送りレコード
 * @param options 分析オプション
 * @returns 申し送り件数降順の UserTrend 配列
 *
 * @example
 * ```ts
 * const trends = computeUserTrends(records, { periodDays: 30 });
 * // trends[0] → { userCode: 'U001', totalMentions: 12, recentTrend: 'increasing', ... }
 * ```
 */
export function computeUserTrends(
  records: HandoffRecord[],
  options?: ComputeUserTrendsOptions,
): UserTrend[] {
  if (records.length === 0) return [];

  const baseDate = getLatestDate(records, options?.baseDate);
  const topCategoryCount = options?.topCategoryCount ?? 3;
  const topKeywordCount = options?.topKeywordCount ?? 5;

  // 1. 期間フィルタ
  const filtered = filterByPeriod(records, options?.periodDays, baseDate);
  if (filtered.length === 0) return [];

  // 2. userCode なしのレコードは除外
  const validRecords = filtered.filter((r) => r.userCode && r.userCode.trim() !== '');

  // 3. userCode ごとにグループ化
  const userGroups = new Map<string, HandoffRecord[]>();
  for (const r of validRecords) {
    const group = userGroups.get(r.userCode);
    if (group) {
      group.push(r);
    } else {
      userGroups.set(r.userCode, [r]);
    }
  }

  // 4. 各利用者について傾向を算出
  const trends: UserTrend[] = [];

  for (const [userCode, userRecords] of userGroups) {
    // カテゴリ分布
    const topCategories = computeTopCategories(userRecords, topCategoryCount);

    // キーワード抽出（extractKeywords を再利用）
    const keywordResult = extractKeywords(userRecords);
    const topKeywords = keywordResult.hits
      .slice(0, topKeywordCount)
      .map((h) => ({ keyword: h.keyword, count: h.count }));

    // 重要度分布
    const severityDistribution = computeSeverityDistribution(userRecords);

    // トレンド判定
    const recentTrend = computeTrendDirection(userRecords, baseDate);

    // 表示名（最新レコードから取得）
    const userDisplayName = resolveDisplayName(userRecords);

    trends.push({
      userCode,
      userDisplayName,
      totalMentions: userRecords.length,
      topCategories,
      topKeywords,
      severityDistribution,
      recentTrend,
    });
  }

  // 5. 件数降順、同数なら userCode 昇順
  trends.sort((a, b) => b.totalMentions - a.totalMentions || a.userCode.localeCompare(b.userCode));

  return trends;
}
