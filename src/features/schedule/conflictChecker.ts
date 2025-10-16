import type { Schedule, ScheduleForm } from './types';

export interface ConflictCheck {
  hasConflict: boolean;
  conflicts: ConflictDetail[];
}

export interface ConflictDetail {
  schedule: Schedule;
  reason: 'time_overlap' | 'double_booking' | 'staff_unavailable';
  message: string;
}

/**
 * 時間の重複をチェックするヘルパー
 *
 * @param start1 開始時刻1 (ISO string)
 * @param end1 終了時刻1 (ISO string)
 * @param start2 開始時刻2 (ISO string)
 * @param end2 終了時刻2 (ISO string)
 * @returns 重複している場合 true
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

  // 無効な日付の場合は重複なしとする
  if ([s1, e1, s2, e2].some(d => isNaN(d.getTime()))) {
    return false;
  }

  // 時間の重複チェック: 開始時刻が他方の終了時刻より前 AND 終了時刻が他方の開始時刻より後
  return s1 < e2 && e1 > s2;
}

/**
 * 新しい予定が既存の予定と競合するかをチェック
 *
 * @param newSchedule 追加しようとしている予定
 * @param existingSchedules 既存の予定一覧
 * @param excludeId 除外する予定ID（編集時の自分自身）
 * @returns 競合チェック結果
 */
export function checkScheduleConflicts(
  newSchedule: ScheduleForm,
  existingSchedules: Schedule[],
  excludeId?: string
): ConflictCheck {
  const conflicts: ConflictDetail[] = [];

  // 必要なフィールドが不足している場合は競合チェックをスキップ
  if (!newSchedule.start || !newSchedule.end) {
    return { hasConflict: false, conflicts: [] };
  }

  const filteredSchedules = existingSchedules.filter(
    schedule => schedule.id !== excludeId
  );

  for (const existing of filteredSchedules) {
    // 時間の重複をチェック
    if (hasTimeOverlap(newSchedule.start, newSchedule.end, existing.start, existing.end)) {
      // 同じ担当者の重複（ダブルブッキング）
      if (newSchedule.userId &&
          ((existing.category === 'Staff' && existing.staffIds?.includes(newSchedule.userId)) ||
           (existing.category === 'User' && existing.staffIds?.includes(newSchedule.userId)))) {
        conflicts.push({
          schedule: existing,
          reason: 'double_booking',
          message: `${formatDateTime(existing.start)} に「${existing.title}」の予定があります`,
        });
      }
      // 利用者の場合は施設の利用が重複
      else if (existing.category === 'User') {
        conflicts.push({
          schedule: existing,
          reason: 'time_overlap',
          message: `${formatDateTime(existing.start)} に利用者の予定「${existing.title}」があります`,
        });
      }
      // 職員レーンの重複
      else if (existing.category === 'Staff') {
        conflicts.push({
          schedule: existing,
          reason: 'staff_unavailable',
          message: `${formatDateTime(existing.start)} に職員の予定「${existing.title}」があります`,
        });
      }
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts: conflicts,
  };
}

/**
 * 日時を読みやすい形式でフォーマット
 */
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
 * 競合の重要度を判定
 * @param reason 競合理由
 * @returns 'error' | 'warning' | 'info'
 */
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