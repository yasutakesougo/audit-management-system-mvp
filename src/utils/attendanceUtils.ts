import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export interface UserMaster {
  Id: number;
  UserID: string;
  FullName: string;
  /**
   * 通所曜日（日本語1文字形式: ['月','火','水', ...]）
   * ※ date-fns/locale/ja の 'E' 形式に対応
   * ※ 将来的には内部表現を 'monday' | 'tuesday' に統一する可能性あり
   */
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
 * 指定日の曜日を取得（日本語1文字形式）
 * @param date 対象日
 * @returns 日本語曜日（'月', '火', '水', '木', '金', '土', '日'）
 * @note UserMaster.AttendanceDays と同じ形式で返す
 */
export function getJapaneseWeekday(date: Date): string {
  return format(date, 'E', { locale: ja });
}

/**
 * Date または 日付文字列を YYYY-MM-DD 形式のキーに変換
 */
function toDateKey(date: Date | string): string {
  if (typeof date === 'string') return date;
  return format(date, 'yyyy-MM-dd');
}

/**
 * 利用者が指定日に通所予定かチェック
 * @param user 利用者マスタ
 * @param date 対象日
 * @returns 通所予定の場合 true
 */
export function isUserScheduledForDate(user: UserMaster, date: Date): boolean {
  const targetDateKey = toDateKey(date);
  const weekday = getJapaneseWeekday(date);

  // サービス期間内かチェック（日付キーベースで境界ブレを回避）
  if (user.ServiceStartDate && targetDateKey < user.ServiceStartDate) {
    return false;
  }

  if (user.ServiceEndDate && targetDateKey > user.ServiceEndDate) {
    return false;
  }

  // 通所曜日に含まれているかチェック
  return user.AttendanceDays.includes(weekday);
}

/**
 * スケジュールが欠席・休暇系かどうかを判定
 * @param schedule スケジュール情報
 * @returns 欠席・休暇の場合 true
 */
function isAbsentSchedule(schedule: Schedule): boolean {
  // 1. 構造化フィールド優先（status, category）
  if (schedule.status && schedule.status.includes('欠席')) return true;
  if (schedule.category && schedule.category.includes('欠席')) return true;

  // 2. フォールバック: タイトルでのキーワード判定
  const absentKeywords = ['欠席', '休暇', '年休', '有休', '病欠', '事故欠'];
  return absentKeywords.some(keyword => schedule.title.includes(keyword));
}

/**
 * 指定日にスケジュールで欠席になっている利用者IDを取得
 * @param schedules スケジュール一覧
 * @param date 対象日
 * @param options オプション設定
 * @returns 欠席利用者ID配列
 */
export function getAbsentUserIds(
  schedules: Schedule[],
  date: Date,
  options: { removeDuplicates?: boolean } = {}
): string[] {
  const { removeDuplicates = false } = options;
  const targetDateKey = toDateKey(date);

  const absentIds = schedules
    .filter(schedule => {
      // 日付が一致するスケジュールを抽出
      const scheduleDate = schedule.startLocal || schedule.startUtc;
      if (!scheduleDate) return false;

      const scheduleDateKey = scheduleDate.split('T')[0];
      if (scheduleDateKey !== targetDateKey) return false;

      // 欠席・休暇系のスケジュールかチェック
      return isAbsentSchedule(schedule);
    })
    .map(schedule => {
      const id = schedule.userId || schedule.personId;
      // number型対応: 文字列に統一
      return typeof id === 'number' ? String(id) : id;
    })
    .filter((id): id is string => Boolean(id));

  // 重複除去オプション対応
  return removeDuplicates ? Array.from(new Set(absentIds)) : absentIds;
}

/**
 * 指定日の予定通所者数を計算
 * @param users 利用者マスタ一覧
 * @param schedules スケジュール一覧
 * @param date 対象日
 * @returns 予定通所者数情報
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

  // スケジュールで欠席の利用者ID（重複除去）
  const absentUserIds = getAbsentUserIds(schedules, date, { removeDuplicates: true });

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
 * @param actualCount 実際の通所者数
 * @param expectedCount 予定通所者数
 * @param digits 小数点以下桁数（デフォルト: 0）
 * @returns 通所率（パーセンテージ）
 */
export function calculateAttendanceRate(
  actualCount: number,
  expectedCount: number,
  digits: number = 0
): number {
  if (expectedCount === 0) return 0;

  const raw = (actualCount / expectedCount) * 100;
  const factor = 10 ** digits;
  return Math.round(raw * factor) / factor;
}