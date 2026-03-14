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
} from '@/features/daily/infra/dailyTableRepository';

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

export interface DailyMonitoringSummary {
  period: PeriodSummary;
  activity: ActivitySummary;
  lunch: LunchSummary;
  behavior: BehaviorSummary;
}

// ─── 定数 ────────────────────────────────────────────────

const MAX_TOP_ACTIVITIES = 5;

const LUNCH_LABELS: Record<LunchIntake, string> = {
  full: '完食',
  '80': '8割',
  half: '半分',
  small: '少量',
  none: 'なし',
};

const BEHAVIOR_LABELS: Record<ProblemBehaviorType, string> = {
  selfHarm: '自傷',
  otherInjury: '他傷',
  shouting: '大声',
  pica: '異食',
  other: 'その他',
};

const STABLE_INTAKES: LunchIntake[] = ['full', '80'];

// ─── ヘルパー ────────────────────────────────────────────

const clean = (s: unknown): string => {
  const t = String(s ?? '').trim();
  return t || '';
};

/** YYYY-MM-DD 間の暦日数（inclusive） */
function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00');
  const b = new Date(to + 'T00:00:00');
  const diff = b.getTime() - a.getTime();
  return Math.max(1, Math.floor(diff / 86_400_000) + 1);
}

/** YYYY-MM-DD → 週番号文字列（月曜起点） */
function toWeekKey(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  const day = d.getDay();
  // 月曜起点に補正
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${mm}/${dd}〜`;
}

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
  const typeCounts: Record<string, number> = {};
  const weekCounts: Record<string, number> = {};
  let totalDays = 0;

  // 問題行動があるレコードのみ集計
  const pbRecords: DailyTableRecord[] = [];

  for (const r of records) {
    const pbs = r.problemBehaviors ?? [];
    if (pbs.length === 0) continue;
    totalDays++;
    pbRecords.push(r);

    for (const pb of pbs) {
      typeCounts[pb] = (typeCounts[pb] ?? 0) + 1;
    }

    const wk = toWeekKey(r.recordDate);
    weekCounts[wk] = (weekCounts[wk] ?? 0) + 1;
  }

  const byType = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      type: type as ProblemBehaviorType,
      label: BEHAVIOR_LABELS[type as ProblemBehaviorType] ?? type,
      count,
    }));

  const weeklyTrend = Object.entries(weekCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, count]) => ({ week, count }));

  // 直近変化: 全レコード期間の中間日を基準に前半/後半で比較
  const { recentChange, changeRate } = computeRecentChange(pbRecords, records);

  const recordedDays = records.length;
  const rate = recordedDays > 0 ? Math.round((totalDays / recordedDays) * 100) : 0;

  return { totalDays, rate, byType, weeklyTrend, recentChange, changeRate };
}

/**
 * 全レコードの日付範囲の中間日を基準に前半/後半の問題行動件数を比較する。
 */
function computeRecentChange(
  pbRecords: DailyTableRecord[],
  allRecords: DailyTableRecord[],
): { recentChange: 'up' | 'down' | 'flat'; changeRate: number } {
  if (pbRecords.length < 2) return { recentChange: 'flat', changeRate: 0 };
  if (allRecords.length < 2) return { recentChange: 'flat', changeRate: 0 };

  // 全レコード期間の中間日を算出
  const sortedDates = allRecords.map((r) => r.recordDate).sort();
  const from = sortedDates[0];
  const to = sortedDates[sortedDates.length - 1];
  const fromMs = new Date(from + 'T00:00:00').getTime();
  const toMs = new Date(to + 'T00:00:00').getTime();
  const midMs = fromMs + (toMs - fromMs) / 2;
  const midDate = new Date(midMs).toISOString().slice(0, 10);

  let olderCount = 0;
  let recentCount = 0;
  for (const r of pbRecords) {
    if (r.recordDate <= midDate) {
      olderCount++;
    } else {
      recentCount++;
    }
  }

  if (olderCount === 0 && recentCount === 0) return { recentChange: 'flat', changeRate: 0 };
  if (olderCount === 0) return { recentChange: 'up', changeRate: 100 };

  const changeRate = Math.round(((recentCount - olderCount) / olderCount) * 100);

  if (changeRate > 10) return { recentChange: 'up', changeRate };
  if (changeRate < -10) return { recentChange: 'down', changeRate };
  return { recentChange: 'flat', changeRate };
}

// ─── メイン集計 ──────────────────────────────────────────

export function buildMonitoringDailySummary(
  records: DailyTableRecord[],
): DailyMonitoringSummary | null {
  if (records.length === 0) return null;

  // 期間を recordDate の min/max から算出
  const dates = records.map((r) => r.recordDate).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
  const totalDays = daysBetween(from, to);
  const uniqueDates = new Set(dates);
  const recordedDays = uniqueDates.size;
  const recordRate = totalDays > 0 ? Math.round((recordedDays / totalDays) * 100) : 0;

  return {
    period: { from, to, totalDays, recordedDays, recordRate },
    activity: aggregateActivities(records),
    lunch: aggregateLunch(records),
    behavior: aggregateBehaviors(records),
  };
}

// ─── 所見ドラフト文生成 ──────────────────────────────────

/**
 * 集計サマリーから人が読める所見ドラフト文を生成する。
 * 示唆であり断定ではない。あくまで下書き。
 */
export function buildMonitoringInsightText(
  summary: DailyMonitoringSummary,
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

  return lines;
}
