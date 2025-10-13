import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export interface UserMaster {
  Id: number;
  UserID: string;
  FullName: string;
  AttendanceDays: string[];
  ServiceStartDate?: string;
  ServiceEndDate?: string;
}

export interface Schedule {
  id: string | number;
  userId?: string;
  personId?: string;
  title: string;
  startLocal?: string;
  startUtc?: string;
  status?: string;
  category?: string;
}

/**
 * 指定日の曜日を取得（日本語）
 */
export function getJapaneseWeekday(date: Date): string {
  return format(date, 'E', { locale: ja });
}

/**
 * 利用者が指定日に通所予定かチェック
 */
export function isUserScheduledForDate(user: UserMaster, date: Date): boolean {
  const weekday = getJapaneseWeekday(date);

  // サービス期間内かチェック
  if (user.ServiceStartDate) {
    const serviceStart = new Date(user.ServiceStartDate);
    if (date < serviceStart) return false;
  }

  if (user.ServiceEndDate) {
    const serviceEnd = new Date(user.ServiceEndDate);
    if (date > serviceEnd) return false;
  }

  // 通所曜日に含まれているかチェック
  return user.AttendanceDays.includes(weekday);
}

/**
 * 指定日にスケジュールで欠席になっている利用者IDを取得
 */
export function getAbsentUserIds(schedules: Schedule[], date: Date): string[] {
  const targetDate = format(date, 'yyyy-MM-dd');

  return schedules
    .filter(schedule => {
      // 日付が一致し、欠席・休暇系のスケジュールを探す
      const scheduleDate = schedule.startLocal || schedule.startUtc;
      if (!scheduleDate) return false;

      const scheduleDateStr = scheduleDate.split('T')[0];
      if (scheduleDateStr !== targetDate) return false;

      // 欠席・休暇を示すキーワード
      const absentKeywords = ['欠席', '休暇', '年休', '有休', '病欠', '事故欠'];
      return absentKeywords.some(keyword =>
        schedule.title.includes(keyword) ||
        (schedule.status && schedule.status.includes('欠席'))
      );
    })
    .map(schedule => schedule.userId || schedule.personId)
    .filter((id): id is string => Boolean(id));
}

/**
 * 指定日の予定通所者数を計算
 */
export function getExpectedAttendeeCount(
  users: UserMaster[],
  schedules: Schedule[],
  date: Date
): {
  expectedCount: number;
  scheduledUsers: UserMaster[];
  absentUserIds: string[];
} {
  // 通所予定の利用者を抽出
  const scheduledUsers = users.filter(user => isUserScheduledForDate(user, date));

  // スケジュールで欠席の利用者ID
  const absentUserIds = getAbsentUserIds(schedules, date);

  // 実際の予定通所者数（欠席者を除く）
  const expectedCount = scheduledUsers.filter(user =>
    !absentUserIds.includes(user.UserID)
  ).length;

  return {
    expectedCount,
    scheduledUsers,
    absentUserIds
  };
}

/**
 * 通所率を計算
 */
export function calculateAttendanceRate(
  actualCount: number,
  expectedCount: number
): number {
  if (expectedCount === 0) return 0;
  return Math.round((actualCount / expectedCount) * 100);
}