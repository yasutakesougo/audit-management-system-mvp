import { HYDRATION_FEATURES, estimatePayloadSize, startFeatureSpan } from '@/hydration/features';
import type { Schedule, ScheduleForm } from './types';

// === New Rule Engine API ===
export type ConflictKind =
  | 'user-life-care-vs-support'
  | 'user-life-support-vs-support'
  | 'staff-life-support-vs-staff'
  | 'org-resource-conflict'
  | 'transportation-overlap'
  | 'vehicle-double-booking'
  | 'room-double-booking'
  | 'equipment-conflict';

export interface ScheduleConflict {
  idA: string;
  idB: string;
  kind: ConflictKind;
  message: string;
}

/**
 * 1つの重複検知ルール = 2件のスケジュール間の衝突を判定する純粋関数
 */
export type ConflictRule = (
  a: Schedule,
  b: Schedule,
) => ScheduleConflict | null;

/**
 * 時間の重複をチェックするヘルパー
 */
export function hasTimeOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);

  if ([s1, e1, s2, e2].some(d => isNaN(d.getTime()))) {
    return false;
  }

  return s1 < e2 && e1 > s2;
}

/**
 * デフォルトルール一覧
 */
export const DEFAULT_CONFLICT_RULES: ConflictRule[] = [
  detectUserConflict,
  detectStaffConflict,
  detectVehicleConflict,
  detectRoomConflict,
  detectEquipmentConflict,
];

/**
 * スケジュール衝突検出（ルールエンジン型）
 */
export function detectScheduleConflicts(
  schedules: Schedule[],
  rules: ConflictRule[] = DEFAULT_CONFLICT_RULES,
): ScheduleConflict[] {
  const span = startFeatureSpan(HYDRATION_FEATURES.schedules.conflict, {
    scheduleCount: schedules.length,
    ruleCount: rules.length,
    scheduleBytes: estimatePayloadSize(schedules),
    ruleBytes: estimatePayloadSize(rules),
  });
  try {
    const conflicts: ScheduleConflict[] = [];
    const seen = new Set<string>();

    const n = schedules.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = schedules[i];
        const b = schedules[j];

        if (!hasTimeOverlap(a.start, a.end, b.start, b.end)) continue;

        for (const rule of rules) {
          const conflict = rule(a, b);
          if (!conflict) continue;

          const key = conflictKey(conflict);
          if (seen.has(key)) continue;

          seen.add(key);
          conflicts.push(conflict);
        }
      }
    }

    span({ meta: { status: 'ok', conflictCount: conflicts.length, conflictBytes: estimatePayloadSize(conflicts) } });
    return conflicts;
  } catch (error) {
    span({
      meta: { status: 'error' },
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function buildConflictIndex(
  conflicts: ScheduleConflict[],
): Record<string, ScheduleConflict[]> {
  const index: Record<string, ScheduleConflict[]> = {};

  for (const conflict of conflicts) {
    if (!index[conflict.idA]) index[conflict.idA] = [];
    if (!index[conflict.idB]) index[conflict.idB] = [];

    index[conflict.idA].push(conflict);
    index[conflict.idB].push(conflict);
  }

  return index;
}

export function hasConflict(
  conflictIndex: Record<string, ScheduleConflict[]> | undefined,
  scheduleId: string,
): boolean {
  return Boolean(conflictIndex?.[scheduleId]?.length);
}

function conflictKey(conflict: ScheduleConflict): string {
  const [id1, id2] = [conflict.idA, conflict.idB].sort();
  return `${id1}:${id2}:${conflict.kind}`;
}

function detectUserConflict(a: Schedule, b: Schedule): ScheduleConflict | null {
  if (a.category !== 'User' || b.category !== 'User') return null;

  const userA = a as Schedule & { personId?: string; personName?: string };
  const userB = b as Schedule & { personId?: string; personName?: string };

  if (userA.personId && userB.personId && userA.personId === userB.personId) {
    return {
      idA: a.id,
      idB: b.id,
      kind: 'user-life-care-vs-support',
      message: `利用者${userA.personName || userA.personId}の予定が重複しています`,
    };
  }

  if (userA.personId !== userB.personId) {
    return {
      idA: a.id,
      idB: b.id,
      kind: 'user-life-support-vs-support',
      message: `施設利用が同時間帯で重複しています`,
    };
  }

  return null;
}

function detectStaffConflict(a: Schedule, b: Schedule): ScheduleConflict | null {
  const staffSchedule = a.category === 'Staff' ? a : (b.category === 'Staff' ? b : null);
  const userSchedule = a.category === 'User' ? a : (b.category === 'User' ? b : null);

  if (!staffSchedule || !userSchedule) return null;

  const staff = staffSchedule as Schedule & { staffIds?: string[] };
  const user = userSchedule as Schedule & { staffIds?: string[] };

  if (staff.staffIds?.some((id: string) => user.staffIds?.includes(id))) {
    return {
      idA: a.id,
      idB: b.id,
      kind: 'staff-life-support-vs-staff',
      message: `職員のダブルブッキングが発生しています`,
    };
  }

  return null;
}

// === Legacy API ===
export interface ConflictCheck {
  hasConflict: boolean;
  conflicts: ConflictDetail[];
}

export interface ConflictDetail {
  schedule: Schedule;
  reason: 'time_overlap' | 'double_booking' | 'staff_unavailable';
  message: string;
}

export function checkScheduleConflicts(
  newSchedule: ScheduleForm,
  existingSchedules: Schedule[],
  excludeId?: string
): ConflictCheck {
  const span = startFeatureSpan(HYDRATION_FEATURES.schedules.conflict, {
    mode: 'legacy',
    existingCount: existingSchedules.length,
    existingBytes: estimatePayloadSize(existingSchedules),
    newBytes: estimatePayloadSize(newSchedule),
  });
  try {
    if (!newSchedule.start || !newSchedule.end) {
      span({ meta: { status: 'ok', conflictCount: 0 } });
      return { hasConflict: false, conflicts: [] };
    }

    const conflicts: ConflictDetail[] = [];
    const filteredSchedules = existingSchedules.filter(
      schedule => schedule.id !== excludeId
    );

    for (const existing of filteredSchedules) {
      if (hasTimeOverlap(newSchedule.start, newSchedule.end, existing.start, existing.end)) {
        if (newSchedule.userId &&
            ((existing.category === 'Staff' && existing.staffIds?.includes(newSchedule.userId)) ||
             (existing.category === 'User' && existing.staffIds?.includes(newSchedule.userId)))) {
          conflicts.push({
            schedule: existing,
            reason: 'double_booking',
            message: `${formatDateTime(existing.start)} に「${existing.title}」の予定があります`,
          });
        }
        else if (existing.category === 'User') {
          conflicts.push({
            schedule: existing,
            reason: 'time_overlap',
            message: `${formatDateTime(existing.start)} に利用者の予定「${existing.title}」があります`,
          });
        }
        else if (existing.category === 'Staff') {
          conflicts.push({
            schedule: existing,
            reason: 'staff_unavailable',
            message: `${formatDateTime(existing.start)} に職員の予定「${existing.title}」があります`,
          });
        }
      }
    }

    const result = {
      hasConflict: conflicts.length > 0,
      conflicts: conflicts,
    };
    span({ meta: { status: 'ok', conflictCount: conflicts.length, conflictBytes: estimatePayloadSize(conflicts) } });
    return result;
  } catch (error) {
    span({
      meta: { status: 'error' },
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function getConflictSeverity(reason: ConflictDetail['reason']): 'error' | 'warning' | 'info' {
  switch (reason) {
    case 'double_booking':
      return 'error';
    case 'staff_unavailable':
      return 'warning';
    case 'time_overlap':
      return 'info';
    default:
      return 'warning';
  }
}

function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * 車両重複予約を検出
 */
function detectVehicleConflict(a: Schedule, b: Schedule): ScheduleConflict | null {
  // 車両IDが設定されているスケジュールのみチェック
  const vehicleA = (a as Schedule & { vehicleId?: string }).vehicleId;
  const vehicleB = (b as Schedule & { vehicleId?: string }).vehicleId;

  if (!vehicleA || !vehicleB) return null;
  if (vehicleA !== vehicleB) return null;

  return {
    idA: String(a.id),
    idB: String(b.id),
    kind: 'vehicle-double-booking',
    message: `車両「${vehicleA}」が重複予約されています（${formatDateTime(a.start)} ↔ ${formatDateTime(b.start)}）`,
  };
}

/**
 * 部屋重複予約を検出
 */
function detectRoomConflict(a: Schedule, b: Schedule): ScheduleConflict | null {
  // 部屋IDが設定されているスケジュールのみチェック
  const roomA = (a as Schedule & { roomId?: string }).roomId;
  const roomB = (b as Schedule & { roomId?: string }).roomId;

  if (!roomA || !roomB) return null;
  if (roomA !== roomB) return null;

  return {
    idA: String(a.id),
    idB: String(b.id),
    kind: 'room-double-booking',
    message: `部屋「${roomA}」が重複予約されています（${formatDateTime(a.start)} ↔ ${formatDateTime(b.start)}）`,
  };
}

/**
 * 設備競合を検出
 */
function detectEquipmentConflict(a: Schedule, b: Schedule): ScheduleConflict | null {
  // 設備IDが設定されているスケジュールのみチェック
  const equipmentA = (a as Schedule & { equipmentId?: string }).equipmentId;
  const equipmentB = (b as Schedule & { equipmentId?: string }).equipmentId;

  if (!equipmentA || !equipmentB) return null;
  if (equipmentA !== equipmentB) return null;

  return {
    idA: String(a.id),
    idB: String(b.id),
    kind: 'equipment-conflict',
    message: `設備「${equipmentA}」が重複予約されています（${formatDateTime(a.start)} ↔ ${formatDateTime(b.start)}）`,
  };
}
