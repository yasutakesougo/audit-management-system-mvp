/**
 * @fileoverview モニタリング用日次記録集計（pure function）
 * @description
 * DailyTableRecord[] を入力に、ISPモニタリングに必要な客観指標を算出する。
 *
 * Phase 1 スコープ:
 * - 期間サマリー（記録日数・記録率）
 * - 活動頻度（AM/PM 別 Top 活動）
 * - 昼食傾向（摂取量分布・安定度）
 * - 問題行動推移（種別件数・週次推移・直近変化）
 * - 所見ドラフト文の自動生成
 *
 * 副作用なし。UI 非依存。テスト容易。
 */ // contract:allow-interface

import type {
  DailyTableRecord,
  LunchIntake,
  ProblemBehaviorType,
} from '@/features/daily/repositories/sharepoint/dailyTableRepository';

import { BEHAVIOR_TAGS, type BehaviorTagKey, BEHAVIOR_TAG_CATEGORIES, type BehaviorTagCategory } from '@/features/daily/domain/behavior/behaviorTag';

import type { GoalLike, GoalProgressSummary } from './goalProgressTypes';
import { PROGRESS_LEVEL_LABELS } from './goalProgressTypes';
import { inferGoalTagLinks, assessGoalProgress } from './goalProgressUtils';
import type { IspRecommendationSummary } from './ispRecommendationTypes';
import { ISP_RECOMMENDATION_LABELS } from './ispRecommendationTypes';
import { buildIspRecommendations } from './ispRecommendationUtils';
import { aggregateMonitoringBehaviors } from './monitoringDailyBehaviors';
import { buildMonitoringPeriodMetrics } from './monitoringDailyPeriod';

// ─── 型定義 ──────────────────────────────────────────────

export interface PeriodSummary {
  from: string;
  to: string;
  /** 期間内の暦日数 */
  totalDays: number;
  /** 記録が存在する日数 */
  recordedDays: number;
  /** 記録率 (0–100 整数%) */
  recordRate: number;
}

export interface ActivityRank {
  label: string;
  count: number;
}

export interface ActivitySummary {
  amCounts: Record<string, number>;
  pmCounts: Record<string, number>;
  topAm: ActivityRank[];
  topPm: ActivityRank[];
}

export interface LunchSummary {
  counts: Partial<Record<LunchIntake, number>>;
  ratios: Partial<Record<LunchIntake, number>>;
  totalWithData: number;
  /** 安定度スコア（0–100）: 完食+8割の割合 */
  stableScore: number;
}

export interface BehaviorWeek {
  week: string; // 'YYYY-Www' or 'MM/DD〜'
  count: number;
}

export interface BehaviorSummary {
  /** 問題行動が1つ以上記録された日数 */
  totalDays: number;
  /** 全記録日に対する問題行動発生率 */
  rate: number;
  byType: { type: ProblemBehaviorType; label: string; count: number }[];
  weeklyTrend: BehaviorWeek[];
  /** 直近2週間と前2週間の比較 */
  recentChange: 'up' | 'down' | 'flat';
  /** 変化率（%、符号付き） */
  changeRate: number;
}

export interface BehaviorTagRank {
  key: string;
  label: string;
  category: string;
  categoryLabel: string;
  count: number;
}

export interface BehaviorTagSummary {
  /** 使用頻度 Top タグ（最大5件） */
  topTags: BehaviorTagRank[];
  /** 1記録あたりの平均タグ数（小数1桁） */
  avgTagsPerRecord: number;
  /** タグが1つ以上ある記録の割合（0–100 整数%） */
  tagUsageRate: number;
  /** カテゴリ別の出現回数 */
  categoryDistribution: { category: string; label: string; count: number; percentage: number }[];
  /** 計算対象の記録数 */
  totalRecords: number;
  /** タグが1つ以上ある記録数 */
  taggedRecords: number;
  /** 直近半分 vs 前半のタグ使用増減 */
  usageTrend: 'up' | 'down' | 'flat';
  /** 増減率（%） */
  usageTrendRate: number;
}

export interface DailyMonitoringSummary {
  period: PeriodSummary;
  activity: ActivitySummary;
  lunch: LunchSummary;
  behavior: BehaviorSummary;
  /** Phase 2: 行動タグ集計（タグ付き記録がない場合は null） */
  behaviorTagSummary: BehaviorTagSummary | null;
  /** Phase 3: 目標ごとの進捗判定（goals 未指定時は undefined） */
  goalProgress?: GoalProgressSummary[];
  /** Phase 4-A: ISP 見直し提案（goalProgress から自動導出、goals 未指定時は undefined） */
  ispRecommendations?: IspRecommendationSummary;
}

// ─── 定数 ────────────────────────────────────────────────

const MAX_TOP_ACTIVITIES = 5;
const MAX_TOP_TAGS = 5;

const LUNCH_LABELS: Record<LunchIntake, string> = {
  full: '完食',
  '80': '8割',
  half: '半分',
  small: '少量',
  none: 'なし',
};

const STABLE_INTAKES: LunchIntake[] = ['full', '80'];

// ─── ヘルパー ────────────────────────────────────────────

const clean = (s: unknown): string => {
  const t = String(s ?? '').trim();
  return t || '';
};

function topN(counts: Record<string, number>, n: number): ActivityRank[] {
  return Object.entries(counts)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count }));
}

// ─── 集計関数 ────────────────────────────────────────────

export function aggregateActivities(records: DailyTableRecord[]): ActivitySummary {
  const amCounts: Record<string, number> = {};
  const pmCounts: Record<string, number> = {};

  for (const r of records) {
    const am = clean(r.activities?.am);
    const pm = clean(r.activities?.pm);
    if (am) amCounts[am] = (amCounts[am] ?? 0) + 1;
    if (pm) pmCounts[pm] = (pmCounts[pm] ?? 0) + 1;
  }

  return {
    amCounts,
    pmCounts,
    topAm: topN(amCounts, MAX_TOP_ACTIVITIES),
    topPm: topN(pmCounts, MAX_TOP_ACTIVITIES),
  };
}

export function aggregateLunch(records: DailyTableRecord[]): LunchSummary {
  const counts: Partial<Record<LunchIntake, number>> = {};
  let totalWithData = 0;

  for (const r of records) {
    if (!r.lunchIntake) continue;
    totalWithData++;
    counts[r.lunchIntake] = (counts[r.lunchIntake] ?? 0) + 1;
  }

  const ratios: Partial<Record<LunchIntake, number>> = {};
  for (const [key, count] of Object.entries(counts)) {
    ratios[key as LunchIntake] = totalWithData > 0
      ? Math.round((count / totalWithData) * 100)
      : 0;
  }

  const stableCount = STABLE_INTAKES.reduce(
    (sum, key) => sum + (counts[key] ?? 0),
    0,
  );
  const stableScore = totalWithData > 0
    ? Math.round((stableCount / totalWithData) * 100)
    : 0;

  return { counts, ratios, totalWithData, stableScore };
}

export function aggregateBehaviors(records: DailyTableRecord[]): BehaviorSummary {
  return aggregateMonitoringBehaviors(records);
}

// ─── 行動タグ集計 ────────────────────────────────────────

export function aggregateBehaviorTags(
  records: DailyTableRecord[],
): BehaviorTagSummary | null {
  if (records.length === 0) return null;

  // タグ付き記録数
  const taggedRecords = records.filter(
    (r) => (r.behaviorTags ?? []).length > 0,
  ).length;
  if (taggedRecords === 0) return null;

  // 全タグをフラット化して頻度カウント
  const freq = new Map<string, number>();
  const categoryFreq = new Map<string, number>();
  let totalTags = 0;

  for (const r of records) {
    for (const tag of r.behaviorTags ?? []) {
      freq.set(tag, (freq.get(tag) ?? 0) + 1);
      totalTags++;

      const def = BEHAVIOR_TAGS[tag as BehaviorTagKey];
      if (def) {
        const cat = def.category;
        categoryFreq.set(cat, (categoryFreq.get(cat) ?? 0) + 1);
      }
    }
  }

  // Top タグ（最大5件）— 同率時は key の辞書順で安定ソート
  const topTags: BehaviorTagRank[] = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_TOP_TAGS)
    .map(([key, count]) => {
      const def = BEHAVIOR_TAGS[key as BehaviorTagKey];
      return {
        key,
        label: def?.label ?? key,
        category: def?.category ?? 'unknown',
        categoryLabel:
          BEHAVIOR_TAG_CATEGORIES[def?.category as BehaviorTagCategory] ?? '不明',
        count,
      };
    });

  // カテゴリ分布（割合付き）
  const categoryDistribution = [...categoryFreq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([cat, count]) => ({
      category: cat,
      label: BEHAVIOR_TAG_CATEGORIES[cat as BehaviorTagCategory] ?? cat,
      count,
      percentage: totalTags > 0 ? Math.round((count / totalTags) * 100) : 0,
    }));

  // 指標
  const avgTagsPerRecord = Math.round((totalTags / records.length) * 10) / 10;
  const tagUsageRate = Math.round((taggedRecords / records.length) * 100);

  // 使用頻度の前半/後半比較
  const { usageTrend, usageTrendRate } = computeTagUsageTrend(records);

  return {
    topTags,
    avgTagsPerRecord,
    tagUsageRate,
    categoryDistribution,
    totalRecords: records.length,
    taggedRecords,
    usageTrend,
    usageTrendRate,
  };
}

function computeTagUsageTrend(
  records: DailyTableRecord[],
): { usageTrend: 'up' | 'down' | 'flat'; usageTrendRate: number } {
  if (records.length < 4) return { usageTrend: 'flat', usageTrendRate: 0 };

  const sorted = [...records].sort((a, b) =>
    a.recordDate.localeCompare(b.recordDate),
  );
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const firstTagged = firstHalf.filter(
    (r) => (r.behaviorTags ?? []).length > 0,
  ).length;
  const secondTagged = secondHalf.filter(
    (r) => (r.behaviorTags ?? []).length > 0,
  ).length;

  // 件数ベースで比較（割合ではなく密度）
  const firstRate =
    firstHalf.length > 0 ? firstTagged / firstHalf.length : 0;
  const secondRate =
    secondHalf.length > 0 ? secondTagged / secondHalf.length : 0;

  if (firstRate === 0 && secondRate === 0)
    return { usageTrend: 'flat', usageTrendRate: 0 };
  if (firstRate === 0)
    return { usageTrend: 'up', usageTrendRate: 100 };

  const changeRate = Math.round(
    ((secondRate - firstRate) / firstRate) * 100,
  );

  if (changeRate > 10) return { usageTrend: 'up', usageTrendRate: changeRate };
  if (changeRate < -10)
    return { usageTrend: 'down', usageTrendRate: changeRate };
  return { usageTrend: 'flat', usageTrendRate: changeRate };
}

// ─── 目標進捗の照合 ──────────────────────────────────────

/**
 * Goal の linkedCategories に該当する behaviorTags を持つ記録を照合し、
 * GoalProgressSummary[] を返す。
 *
 * trend は既存の前半/後半比較ロジックを目標ごとに適用する。
 */
function computeGoalProgress(
  records: DailyTableRecord[],
  goals: GoalLike[],
): GoalProgressSummary[] {
  const links = inferGoalTagLinks(goals);

  // 記録を日付順にソート（trend 計算用）
  const sorted = [...records].sort((a, b) =>
    a.recordDate.localeCompare(b.recordDate),
  );
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  return links.map((link) => {
    const cats = new Set(link.inferredCategories);
    if (cats.size === 0) {
      return {
        ...assessGoalProgress({
          goalId: link.goalId,
          linkedCategories: [],
          matchedRecordCount: 0,
          matchedTagCount: 0,
          totalRecordCount: records.length,
          trend: 'stable',
        }),
        source: link.source,
      };
    }

    // 記録ごとに「この goal に関連するタグを持つか」を判定
    let matchedRecordCount = 0;
    let matchedTagCount = 0;

    for (const r of records) {
      const tags = r.behaviorTags ?? [];
      let recordMatched = false;
      for (const tag of tags) {
        const def = BEHAVIOR_TAGS[tag as BehaviorTagKey];
        if (def && cats.has(def.category)) {
          matchedTagCount++;
          recordMatched = true;
        }
      }
      if (recordMatched) matchedRecordCount++;
    }

    // trend: 前半/後半で matched 密度を比較
    const countInHalf = (half: DailyTableRecord[]): number => {
      let c = 0;
      for (const r of half) {
        for (const tag of r.behaviorTags ?? []) {
          const def = BEHAVIOR_TAGS[tag as BehaviorTagKey];
          if (def && cats.has(def.category)) {
            c++;
            break;
          }
        }
      }
      return c;
    };

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (sorted.length >= 4) {
      const firstRate =
        firstHalf.length > 0 ? countInHalf(firstHalf) / firstHalf.length : 0;
      const secondRate =
        secondHalf.length > 0 ? countInHalf(secondHalf) / secondHalf.length : 0;
      if (firstRate > 0) {
        const changeRate = ((secondRate - firstRate) / firstRate) * 100;
        if (changeRate > 10) trend = 'improving';
        else if (changeRate < -10) trend = 'declining';
      } else if (secondRate > 0) {
        trend = 'improving';
      }
    }

    return {
      ...assessGoalProgress({
        goalId: link.goalId,
        linkedCategories: link.inferredCategories,
        matchedRecordCount,
        matchedTagCount,
        totalRecordCount: records.length,
        trend,
      }),
      source: link.source,
    };
  });
}

// ─── メイン集計 ──────────────────────────────────────────

/**
 * @param records 日次記録
 * @param goals ISP 目標（省略時は goalProgress を算出しない）
 * @param options.goalNames 目標名のマッピング（ISP提案の reason に使用）
 */
export function buildMonitoringDailySummary(
  records: DailyTableRecord[],
  goals?: GoalLike[],
  options?: { goalNames?: Record<string, string> },
): DailyMonitoringSummary | null {
  if (records.length === 0) return null;

  const period = buildMonitoringPeriodMetrics(records);

  const result: DailyMonitoringSummary = {
    period,
    activity: aggregateActivities(records),
    lunch: aggregateLunch(records),
    behavior: aggregateBehaviors(records),
    behaviorTagSummary: aggregateBehaviorTags(records),
  };

  // goals が渡されたときだけ goalProgress を算出
  if (goals && goals.length > 0) {
    result.goalProgress = computeGoalProgress(records, goals);

    // Phase 4-A: goalProgress から ISP 見直し提案を自動導出
    result.ispRecommendations = buildIspRecommendations(
      result.goalProgress,
      { goalNames: options?.goalNames },
    );
  }

  return result;
}

// ─── 所見ドラフト文生成 ──────────────────────────────────

/**
 * 集計サマリーから人が読める所見ドラフト文を生成する。
 * 示唆であり断定ではない。あくまで下書き。
 */
export function buildMonitoringInsightText(
  summary: DailyMonitoringSummary,
  options?: { goalNames?: Record<string, string> },
): string[] {
  const lines: string[] = [];

  // 期間
  lines.push(
    `【モニタリング期間】${summary.period.from} 〜 ${summary.period.to}（${summary.period.recordedDays}日分 / ${summary.period.totalDays}日中 → 記録率 ${summary.period.recordRate}%）`,
  );

  // 活動
  const { topAm, topPm } = summary.activity;
  if (topAm.length > 0 || topPm.length > 0) {
    const amText = topAm.length > 0
      ? `午前は${topAm.map((a) => `${a.label}(${a.count}回)`).join('・')}が中心`
      : '午前活動の記録なし';
    const pmText = topPm.length > 0
      ? `午後は${topPm.map((a) => `${a.label}(${a.count}回)`).join('・')}が中心`
      : '午後活動の記録なし';
    lines.push(`【活動状況】${amText}、${pmText}。`);
  }

  // 昼食
  if (summary.lunch.totalWithData > 0) {
    const entries = Object.entries(summary.lunch.ratios)
      .filter(([, r]) => (r ?? 0) > 0)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([key, r]) => `${LUNCH_LABELS[key as LunchIntake] ?? key} ${r}%`);
    const stabilityText = summary.lunch.stableScore >= 70
      ? '摂取状況は概ね安定していた'
      : summary.lunch.stableScore >= 40
        ? '摂取量にばらつきがみられた'
        : '摂取量の不安定さがみられた';
    lines.push(`【昼食摂取】${entries.join('・')}。${stabilityText}。`);
  }

  // 問題行動
  if (summary.behavior.totalDays > 0) {
    const typeText = summary.behavior.byType
      .map((b) => `${b.label} ${b.count}件`)
      .join('・');
    const trendLabel = summary.behavior.recentChange === 'down'
      ? '減少傾向がみられた'
      : summary.behavior.recentChange === 'up'
        ? '増加傾向がみられた'
        : '大きな変動はみられなかった';
    const changeText = summary.behavior.changeRate !== 0
      ? `（前半比 ${summary.behavior.changeRate > 0 ? '+' : ''}${summary.behavior.changeRate}%）`
      : '';
    lines.push(
      `【問題行動】期間中 ${summary.behavior.totalDays}日で発生（発生率 ${summary.behavior.rate}%）。内訳: ${typeText}。直近では${trendLabel}${changeText}。`,
    );
  } else {
    lines.push('【問題行動】期間中、問題行動の記録はなかった。');
  }

  // 行動タグ
  if (summary.behaviorTagSummary) {
    const ts = summary.behaviorTagSummary;
    const topText = ts.topTags
      .map((t) => `${t.label}(${t.count}回)`)
      .join('・');
    const catText = ts.categoryDistribution
      .map((c) => `${c.label}${c.count}件(${c.percentage}%)`)
      .join('・');
    const trendLabel =
      ts.usageTrend === 'up'
        ? '活用が増加傾向にある'
        : ts.usageTrend === 'down'
          ? '活用が減少傾向にある'
          : '一定の活用がみられる';
    lines.push(
      `【行動タグ】${ts.taggedRecords}件の記録にタグ付与あり（付与率 ${ts.tagUsageRate}%、平均 ${ts.avgTagsPerRecord}個/記録）。` +
        `頻出タグ: ${topText}。カテゴリ別: ${catText}。${trendLabel}。`,
    );
  }

  // 目標進捗
  if (summary.goalProgress && summary.goalProgress.length > 0) {
    const goalNames = options?.goalNames;
    const progressTexts = summary.goalProgress.map((gp) => {
      const levelLabel = PROGRESS_LEVEL_LABELS[gp.level];
      const ratePercent = Math.round(gp.rate * 100);
      const name = goalNames?.[gp.goalId] ?? `目標(${gp.goalId})`;
      if (gp.level === 'noData') {
        return `${name}: 判定根拠不足（記録の蓄積により判定可能）`;
      }
      return (
        `${name}: ${levelLabel}` +
        `（根拠記録 ${gp.matchedRecordCount}件 / 達成率${ratePercent}%、` +
        `関連タグ ${gp.matchedTagCount}件）`
      );
    });
    lines.push(`【目標進捗】${progressTexts.join('。')}。`);
  }

  // ISP 見直し提案
  if (summary.ispRecommendations && summary.ispRecommendations.actionableCount > 0) {
    const rec = summary.ispRecommendations;
    const overallLabel = ISP_RECOMMENDATION_LABELS[rec.overallLevel];
    const details = rec.recommendations
      .filter((r) => r.level !== 'pending')
      .map((r) => {
        const goalNames = options?.goalNames;
        const name = goalNames?.[r.goalId] ?? `目標(${r.goalId})`;
        return `${name}: ${ISP_RECOMMENDATION_LABELS[r.level]}`;
      });
    lines.push(
      `【ISP見直し提案】総合判定: ${overallLabel}。${details.join('、')}。` +
        `※本提案は支援記録の分析に基づく補助情報です。最終的な見直し判断は担当者が行ってください。`,
    );
  }

  return lines;
}
