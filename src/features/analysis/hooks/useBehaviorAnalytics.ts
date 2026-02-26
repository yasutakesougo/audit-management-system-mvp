import type { BehaviorObservation } from '@/features/daily';
import { useMemo } from 'react';

export type DailyBehaviorStat = {
  dateLabel: string;
  dateKey: string;
  count: number;
  avgIntensity: number;
  maxIntensity: number;
};

const dateFormatter = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' });

export const useBehaviorAnalytics = (records: BehaviorObservation[]) => {
  const dailyStats = useMemo<DailyBehaviorStat[]>(() => {
    if (!records?.length) return [];

    const stats = new Map<string, { count: number; sumIntensity: number; maxIntensity: number }>();

    records.forEach((record) => {
      const date = new Date(record.timestamp);
      if (Number.isNaN(date.getTime())) return;
      const dateKey = date.toISOString().slice(0, 10);
      const current = stats.get(dateKey) ?? { count: 0, sumIntensity: 0, maxIntensity: 0 };
      stats.set(dateKey, {
        count: current.count + 1,
        sumIntensity: current.sumIntensity + record.intensity,
        maxIntensity: Math.max(current.maxIntensity, record.intensity),
      });
    });

    return Array.from(stats.entries())
      .map(([dateKey, value]) => ({
        dateKey,
        dateLabel: dateFormatter.format(new Date(dateKey)),
        count: value.count,
        avgIntensity: Number((value.sumIntensity / value.count).toFixed(1)),
        maxIntensity: value.maxIntensity,
      }))
      .sort((a, b) => new Date(a.dateKey).getTime() - new Date(b.dateKey).getTime());
  }, [records]);

  return { dailyStats } as const;
};
