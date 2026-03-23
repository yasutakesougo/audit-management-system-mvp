import type {
  DailyTableRecord,
  ProblemBehaviorType,
} from '@/features/daily/infra/dailyTableRepository';

export interface MonitoringBehaviorSummary {
  totalDays: number;
  rate: number;
  byType: { type: ProblemBehaviorType; label: string; count: number }[];
  weeklyTrend: { week: string; count: number }[];
  recentChange: 'up' | 'down' | 'flat';
  changeRate: number;
}

const BEHAVIOR_LABELS: Record<ProblemBehaviorType, string> = {
  selfHarm: '自傷',
  otherInjury: '他傷',
  shouting: '大声',
  pica: '異食',
  other: 'その他',
};

/** YYYY-MM-DD → 週番号文字列（月曜起点） */
function toWeekKey(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${mm}/${dd}〜`;
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

export function aggregateMonitoringBehaviors(
  records: DailyTableRecord[],
): MonitoringBehaviorSummary {
  const typeCounts: Record<string, number> = {};
  const weekCounts: Record<string, number> = {};
  let totalDays = 0;

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

  const { recentChange, changeRate } = computeRecentChange(pbRecords, records);
  const recordedDays = records.length;
  const rate = recordedDays > 0 ? Math.round((totalDays / recordedDays) * 100) : 0;

  return { totalDays, rate, byType, weeklyTrend, recentChange, changeRate };
}
