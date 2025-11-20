// src/features/schedule/opsSummary.ts
import dayjs from 'dayjs';
import type { ConflictKind, ScheduleConflict } from './conflictChecker';
import type { Schedule } from './types';

// 今日 1 日分の予定の重なり集計
export type DailyConflictSummary = {
  date: string; // YYYY-MM-DD
  totalConflicts: number;
  byKind: Partial<Record<ConflictKind, number>>;
};

export type StaffLoadItem = {
  staffId: string;
  scheduleCount: number;
};

export type VehicleUsageItem = {
  vehicleId: string;
  tripCount: number;
};

export function buildDailyConflictSummary(
  date: string,
  conflicts: ScheduleConflict[],
  schedules: Schedule[],
): DailyConflictSummary {
  const target = dayjs(date).format('YYYY-MM-DD');

  // 予定の重なりに関与するスケジュールIDを取得して、その日のものだけフィルタ
  const scheduleMap = new Map(schedules.map(s => [s.id, s]));

  const filtered = conflicts.filter((c) => {
    const scheduleA = scheduleMap.get(c.idA);
    const scheduleB = scheduleMap.get(c.idB);

    if (!scheduleA || !scheduleB) return false;

    const dateA = dayjs(scheduleA.start).format('YYYY-MM-DD');
    const dateB = dayjs(scheduleB.start).format('YYYY-MM-DD');

    return dateA === target || dateB === target;
  });

  const byKind: Partial<Record<ConflictKind, number>> = {};
  for (const c of filtered) {
    byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
  }

  return {
    date: target,
    totalConflicts: filtered.length,
    byKind,
  };
}

// Phase1: 「負荷ミニパネル」は "今日そのスタッフが何件担当しているか" のシンプル版
export function buildStaffLoadSummary(
  date: string,
  schedules: Schedule[],
): StaffLoadItem[] {
  const target = dayjs(date).format('YYYY-MM-DD');

  const map = new Map<string, number>();

  for (const s of schedules) {
    const startDate = dayjs(s.start).format('YYYY-MM-DD');
    if (startDate !== target) continue;

    // スケジュール種別に応じてスタッフIDを抽出
    let staffIds: string[] = [];

    if (s.category === 'User') {
      const userSchedule = s as Extract<Schedule, { category: 'User' }>;
      staffIds = userSchedule.staffIds || [];
    } else if (s.category === 'Staff') {
      const staffSchedule = s as Extract<Schedule, { category: 'Staff' }>;
      staffIds = staffSchedule.staffIds || [];
    }
    // 他の拡張プロパティ（primaryStaffId等）があれば追加
    const extendedSchedule = s as Schedule & { primaryStaffId?: string };
    if (extendedSchedule.primaryStaffId) {
      staffIds.push(extendedSchedule.primaryStaffId);
    }

    for (const staffId of staffIds) {
      map.set(staffId, (map.get(staffId) ?? 0) + 1);
    }
  }

  return Array.from(map.entries())
    .map(([staffId, scheduleCount]) => ({ staffId, scheduleCount }))
    .sort((a, b) => b.scheduleCount - a.scheduleCount);
}

// Phase1: 車両は "今日、何本の便に使われたか" を素直にカウント
export function buildVehicleUsageSummary(
  date: string,
  schedules: Schedule[],
): VehicleUsageItem[] {
  const target = dayjs(date).format('YYYY-MM-DD');

  const map = new Map<string, number>();

  for (const s of schedules) {
    const startDate = dayjs(s.start).format('YYYY-MM-DD');
    if (startDate !== target) continue;

    // 車両IDを拡張プロパティから取得
    const extendedSchedule = s as Schedule & { vehicleId?: string };
    if (!extendedSchedule.vehicleId) continue;

    map.set(extendedSchedule.vehicleId, (map.get(extendedSchedule.vehicleId) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([vehicleId, tripCount]) => ({ vehicleId, tripCount }))
    .sort((a, b) => b.tripCount - a.tripCount);
}