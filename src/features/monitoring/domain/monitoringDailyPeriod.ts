import type { DailyTableRecord } from '@/features/daily/infra/dailyTableRepository';

export interface MonitoringPeriodMetrics {
  from: string;
  to: string;
  totalDays: number;
  recordedDays: number;
  recordRate: number;
}

/** YYYY-MM-DD 間の暦日数（inclusive） */
function daysBetweenInclusive(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00');
  const b = new Date(to + 'T00:00:00');
  const diff = b.getTime() - a.getTime();
  return Math.max(1, Math.floor(diff / 86_400_000) + 1);
}

export function buildMonitoringPeriodMetrics(
  records: DailyTableRecord[],
): MonitoringPeriodMetrics {
  if (records.length === 0) {
    return { from: '', to: '', totalDays: 0, recordedDays: 0, recordRate: 0 };
  }

  const dates = records.map((r) => r.recordDate).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
  const totalDays = daysBetweenInclusive(from, to);
  const recordedDays = new Set(dates).size;
  const recordRate =
    totalDays > 0 ? Math.round((recordedDays / totalDays) * 100) : 0;

  return { from, to, totalDays, recordedDays, recordRate };
}
