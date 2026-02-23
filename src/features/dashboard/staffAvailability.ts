/**
 * Staff Availability Calculator
 * 
 * 職員の「フリー」状態を判定するユーティリティ
 * 
 * 責務：
 * - 職員の予定と現在時刻から「フリー」「部分フリー」「多忙」を判定
 * - 次にフリーになる時間を計算
 * - 今日の空き時間スロットを抽出
 */

import type { Staff } from '@/types';

export type StaffAvailabilityStatus = 'free' | 'partial' | 'busy' | 'occupied';

export type TimeSlot = {
  start: string;  // "09:00" 形式
  end: string;    // "10:00" 形式
};

export type StaffAssignment = {
  userId: string;
  userName: string;
  role: 'main' | 'support';
  startTime: string;  // "09:00"
  endTime: string;    // "12:00"
};

export type StaffAvailability = {
  staffId: string;
  staffName: string;
  status: StaffAvailabilityStatus;
  currentAssignment?: StaffAssignment;
  nextFreeTime?: string;  // "10:30" 形式
  freeSlots: TimeSlot[];
};

/**
 * 時刻文字列を分（0-1440）に変換
 * @example timeToMinutes("09:30") // => 570
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 分を時刻文字列に変換
 * @example minutesToTime(570) // => "09:30"
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * 現在時刻が指定時間帯内かを判定
 */
function isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
  const current = timeToMinutes(currentTime);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return current >= start && current < end;
}

/**
 * 次のフリー時間を計算
 * 割り当てが複数ある場合、空き時間の開始時刻を返す
 */
function calculateNextFreeTime(
  assignments: StaffAssignment[],
  currentTime: string,
): string | undefined {
  if (assignments.length === 0) {
    return undefined; // 今すぐフリー
  }

  // 現在時刻以降の割り当てを時系列で並べる
  const sortedAssignments = assignments
    .filter((a) => timeToMinutes(a.endTime) > timeToMinutes(currentTime))
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  if (sortedAssignments.length === 0) {
    return currentTime; // すべての予定が終わっている
  }

  // 最初の予定の開始前にフリー時間があるか
  const firstAssignment = sortedAssignments[0];
  if (timeToMinutes(currentTime) < timeToMinutes(firstAssignment.startTime)) {
    return currentTime; // 今から最初の予定まで空き
  }

  // 連続する予定の間のギャップを探す
  for (let i = 0; i < sortedAssignments.length - 1; i++) {
    const current = sortedAssignments[i];
    const next = sortedAssignments[i + 1];
    if (timeToMinutes(current.endTime) < timeToMinutes(next.startTime)) {
      return current.endTime; // ギャップあり
    }
  }

  // 最後の予定の終了時刻
  return sortedAssignments[sortedAssignments.length - 1].endTime;
}

/**
 * 今日の空き時間スロットを抽出
 * 業務時間（8:00-18:00）内で予定が入っていない時間帯
 */
function calculateFreeSlots(assignments: StaffAssignment[]): TimeSlot[] {
  const WORK_START = 8 * 60; // 8:00
  const WORK_END = 18 * 60;  // 18:00

  if (assignments.length === 0) {
    return [{ start: '08:00', end: '18:00' }]; // 終日フリー
  }

  const slots: TimeSlot[] = [];
  const sortedAssignments = assignments.sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
  );

  let currentTime = WORK_START;

  for (const assignment of sortedAssignments) {
    const assignmentStart = timeToMinutes(assignment.startTime);
    const assignmentEnd = timeToMinutes(assignment.endTime);

    // 業務時間外は無視
    if (assignmentEnd <= WORK_START || assignmentStart >= WORK_END) {
      continue;
    }

    // 前の予定と今の予定の間に空き時間がある
    if (currentTime < assignmentStart) {
      slots.push({
        start: minutesToTime(Math.max(currentTime, WORK_START)),
        end: minutesToTime(Math.min(assignmentStart, WORK_END)),
      });
    }

    currentTime = Math.max(currentTime, assignmentEnd);
  }

  // 最後の予定の後にも空き時間があるか
  if (currentTime < WORK_END) {
    slots.push({
      start: minutesToTime(currentTime),
      end: minutesToTime(WORK_END),
    });
  }

  return slots;
}

/**
 * 職員の状態を判定
 * 
 * ロジック：
 * - free: 現在予定なし、かつ次の予定まで1時間以上
 * - partial: 現在予定なし、次の予定まで30分-1時間
 * - busy: 現在1件の予定あり（サポート可能）
 * - occupied: 複数の予定が重複、またはメイン担当中
 */
function determineStatus(
  assignments: StaffAssignment[],
  currentTime: string,
): StaffAvailabilityStatus {
  const currentAssignments = assignments.filter((a) =>
    isTimeInRange(currentTime, a.startTime, a.endTime),
  );

  if (currentAssignments.length === 0) {
    // 現在予定なし → 次の予定までの時間で判定
    const upcomingAssignments = assignments
      .filter((a) => timeToMinutes(a.startTime) > timeToMinutes(currentTime))
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    
    if (upcomingAssignments.length === 0) {
      return 'free'; // これ以降予定なし
    }
    
    const nextAssignment = upcomingAssignments[0];
    const timeUntilNext = timeToMinutes(nextAssignment.startTime) - timeToMinutes(currentTime);
    if (timeUntilNext >= 60) return 'free';
    if (timeUntilNext >= 30) return 'partial';
    return 'busy';
  }

  // 現在予定あり
  if (currentAssignments.length === 1 && currentAssignments[0].role === 'support') {
    return 'busy'; // サポート役なら限定的に対応可能
  }

  return 'occupied'; // メイン担当中または複数予定
}

/**
 * 職員の利用可能性を計算（メイン関数）
 */
export function calculateStaffAvailability(
  staff: Staff[],
  assignments: StaffAssignment[],
  currentTime: string,
): StaffAvailability[] {
  return staff.map((s) => {
    const staffAssignments = assignments.filter((a) => a.userId === s.staffId);
    const status = determineStatus(staffAssignments, currentTime);
    const currentAssignment = staffAssignments.find((a) =>
      isTimeInRange(currentTime, a.startTime, a.endTime),
    );
    const nextFreeTime = calculateNextFreeTime(staffAssignments, currentTime);
    const freeSlots = calculateFreeSlots(staffAssignments);

    return {
      staffId: s.staffId,
      staffName: s.name,
      status,
      currentAssignment,
      nextFreeTime,
      freeSlots,
    };
  });
}
