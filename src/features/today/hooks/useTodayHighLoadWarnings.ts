/**
 * useTodayHighLoadWarnings — Today 向け高負荷警告の薄いファサード
 *
 * Schedule Ops の週間負荷スコアを算出し、high / critical な日だけを返す。
 * Today ページは「件数 + 最初の日付」だけ表示し、詳細は /schedule-ops に誘導する。
 *
 * @see computeHighLoadWarnings (scheduleOpsLoadScore.ts)
 */
import { addDays, startOfWeek, endOfWeek } from 'date-fns';
import { useMemo } from 'react';
import { useScheduleOpsData } from '@/features/schedules/hooks/useScheduleOpsData';
import { useScheduleOpsSummary } from '@/features/schedules/hooks/useScheduleOpsSummary';
import { toDateKey } from '@/features/schedules/lib/dateKey';
import { DEFAULT_OPS_FILTER } from '@/features/schedules/domain/scheduleOps';
import type { HighLoadWarning } from '@/features/schedules/domain/scheduleOpsLoadScore';

export type TodayHighLoadSummary = {
  /** high / critical な日の件数 */
  count: number;
  /** 最も危険度が高い警告（スコア降順の先頭） */
  top: HighLoadWarning | null;
  /** 全警告リスト（スコア降順） */
  warnings: readonly HighLoadWarning[];
  /** データ取得中 */
  isLoading: boolean;
};

export function useTodayHighLoadWarnings(): TodayHighLoadSummary {
  const now = useMemo(() => new Date(), []);

  const range = useMemo(() => {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    return {
      from: start.toISOString(),
      to: endOfWeek(start, { weekStartsOn: 1 }).toISOString(),
    };
  }, [now]);

  const weekDates = useMemo(() => {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(start, i)));
  }, [now]);

  const { rawItems, isLoading } = useScheduleOpsData(range);

  const { highLoadWarnings } = useScheduleOpsSummary(rawItems, DEFAULT_OPS_FILTER, weekDates);

  return useMemo(() => ({
    count: highLoadWarnings.length,
    top: highLoadWarnings[0] ?? null,
    warnings: highLoadWarnings,
    isLoading,
  }), [highLoadWarnings, isLoading]);
}
