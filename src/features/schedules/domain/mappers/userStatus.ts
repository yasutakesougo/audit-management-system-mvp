// contract:allow-interface — Pure domain DTO types, not API boundary schemas
/**
 * User Status — 利用者状態の共通ドメインモデル
 *
 * 責務:
 *   - 型定義（UserStatusType, UserStatusSource, UserStatusRecord）
 *   - Schedule item との相互変換
 *   - 一意性判定・重複チェック
 *   - ラベル定数
 *
 * 設計判断:
 *   - 利用者状態は Schedule アイテムとして統一保存
 *     (category: 'User', serviceType: absence|late|earlyLeave|preAbsence)
 *   - 入口は Today / Handoff / Schedule の3箇所
 *   - 同一利用者・同一日の有効状態は原則1件（update扱い）
 *
 * @see Phase 8-A: Today/Handoff からの利用者状態登録
 */

import type { CreateScheduleEventInput } from '../../data/port';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 利用者状態種別
 *
 * 既存の ScheduleServiceType と整合:
 *   - 'absence'      → 当日欠席
 *   - 'late'         → 遅刻
 *   - 'earlyLeave'   → 早退
 *   - 'preAbsence'   → 事前欠席（前日以前に連絡済み、報酬算定で区別が必要）
 */
export const USER_STATUS_TYPES = [
  'absence',
  'late',
  'earlyLeave',
  'preAbsence',
] as const;

export type UserStatusType = (typeof USER_STATUS_TYPES)[number];

/** 入力元 */
export type UserStatusSource = 'today' | 'handoff' | 'schedule';

/**
 * 利用者状態レコード — UI <-> Domain の中間表現
 *
 * Schedule アイテムから抽出 or 新規入力から生成される軽量 DTO。
 * UI ではこの型を介して表示/入力し、保存時に Schedule 形式に変換する。
 */
export type UserStatusRecord = {
  /** 利用者 ID */
  readonly userId: string;
  /** 利用者名 */
  readonly userName: string;
  /** 対象日 (YYYY-MM-DD) */
  readonly date: string;
  /** 状態種別 */
  readonly statusType: UserStatusType;
  /** 入力元 */
  readonly source: UserStatusSource;
  /** 備考（申し送り文面の引き継ぎ等） */
  readonly note?: string | null;
  /** 時刻（遅刻の到着予定時刻等、HH:MM 形式） */
  readonly time?: string;
  /** 紐付きスケジュール ID（既存の状態を更新する場合） */
  readonly scheduleId?: string;
  /** 紐付き申し送り ID（Handoff 起点の場合） */
  readonly handoffId?: number;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Constants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 状態種別 → 日本語ラベル */
export const USER_STATUS_LABELS: Record<UserStatusType, string> = {
  absence: '欠席',
  late: '遅刻',
  earlyLeave: '早退',
  preAbsence: '事前欠席',
};

/** 状態種別 → Schedule status へのマッピング */
const STATUS_TO_SCHEDULE_STATUS: Record<UserStatusType, 'Planned' | 'Cancelled'> = {
  absence: 'Cancelled',
  preAbsence: 'Cancelled',
  late: 'Planned',
  earlyLeave: 'Planned',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pure Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * serviceType が利用者状態を表すかどうか判定する。
 *
 * Schedule アイテムの一覧から利用者状態レコードだけを
 * 抽出するフィルタとして使用。
 */
export function isUserStatusServiceType(
  serviceType: string | null | undefined,
): serviceType is UserStatusType {
  if (!serviceType) return false;
  return (USER_STATUS_TYPES as readonly string[]).includes(serviceType);
}

/**
 * Schedule アイテムから UserStatusRecord へ変換する。
 *
 * Schedule 一覧の中から利用者状態アイテムを抽出して
 * 軽量な DTO に変換する。
 *
 * @returns 変換結果。serviceType が状態種別でない場合は null。
 */
export function toUserStatusRecord(schedule: {
  id: string;
  userId?: string | null;
  userName?: string | null;
  start: string;
  serviceType?: string | null;
  notes?: string | null;
}): UserStatusRecord | null {
  if (!isUserStatusServiceType(schedule.serviceType)) return null;
  if (!schedule.userId) return null;

  return {
    userId: schedule.userId,
    userName: schedule.userName ?? '',
    date: schedule.start.slice(0, 10),
    statusType: schedule.serviceType,
    source: 'schedule', // 既存アイテムからの変換はソース不明 → schedule とみなす
    note: schedule.notes,
    scheduleId: schedule.id,
  };
}

/**
 * UserStatusRecord を Schedule 新規作成用の入力に変換する。
 *
 * SchedulesPort.create() に渡すための DTO を生成。
 * notes にソース情報を埋め込む。
 */
export function toScheduleDraft(
  record: UserStatusRecord,
): CreateScheduleEventInput {
  const label = USER_STATUS_LABELS[record.statusType];
  const noteLines: string[] = [];
  if (record.note) noteLines.push(record.note);
  noteLines.push(`[source:${record.source}]`);
  if (record.handoffId != null) noteLines.push(`[handoff:${record.handoffId}]`);
  if (record.time) noteLines.push(`[time:${record.time}]`);

  return {
    title: `${record.userName} - ${label}`,
    category: 'User',
    serviceType: record.statusType,
    startLocal: `${record.date}T00:00:00`,
    endLocal: `${record.date}T23:59:59`,
    userId: record.userId,
    userName: record.userName,
    notes: noteLines.join('\n'),
    status: STATUS_TO_SCHEDULE_STATUS[record.statusType],
    statusReason: `${label}（${record.source}から登録）`,
  };
}

/**
 * 一意性キーを生成する。
 *
 * 同一利用者・同一日 で有効な状態は1件。
 * このキーで既存レコードを検索し、
 * 存在すれば update、なければ create する。
 */
export function buildUserStatusKey(userId: string, date: string): string {
  return `${userId}::${date}`;
}

/**
 * 既存の状態を新しい状態で置き換えるべきか判定する。
 *
 * ルール:
 *   - 同一状態種別 → 更新（note/time の変更）
 *   - 異なる状態種別 → 置き換え（例: 遅刻 → 欠席に変更）
 *
 * @returns true なら既存を上書きする
 */
export function shouldReplaceExistingStatus(
  existing: UserStatusRecord,
  incoming: UserStatusRecord,
): boolean {
  // 同一利用者・同一日なら常に上書き
  return (
    existing.userId === incoming.userId &&
    existing.date === incoming.date
  );
}

/**
 * Schedule アイテム一覧から、指定利用者・指定日の利用者状態を検索する。
 *
 * @returns 既存の状態。見つからなければ undefined。
 */
export function findExistingUserStatus<
  T extends {
    userId?: string | null;
    start?: string;
    serviceType?: string | null;
  },
>(
  items: readonly T[],
  userId: string,
  dateIso: string,
): T | undefined {
  return items.find(
    (item) =>
      item.userId === userId &&
      item.start?.startsWith(dateIso) &&
      isUserStatusServiceType(item.serviceType),
  );
}

/**
 * Handoff カテゴリから推奨する状態種別を判定する。
 *
 * Handoff 起点で「欠席として登録」などのデフォルト選択に使用。
 * カテゴリ「体調」の場合は欠席を推奨する。
 */
export function suggestStatusFromHandoffCategory(
  category: string,
): UserStatusType {
  switch (category) {
    case '体調':
      return 'absence';
    case '家族連絡':
      return 'absence';
    default:
      return 'late'; // デフォルトは遅刻（最も軽い状態変更）
  }
}

/**
 * 欠席種別を日付で自動判定する。
 *
 * - 当日 → 'absence'（当日欠席）
 * - 未来日 → 'preAbsence'（事前欠席）
 *
 * 遅刻・早退はそのまま返す（日付による区別なし）。
 *
 * @param statusType ユーザーが選んだ状態種別
 * @param targetDate 対象日 (YYYY-MM-DD)
 * @param todayDate 今日の日付 (YYYY-MM-DD) - テスト注入用
 */
export function resolveAbsenceType(
  statusType: UserStatusType,
  targetDate: string,
  todayDate: string,
): UserStatusType {
  if (statusType === 'absence' && targetDate > todayDate) {
    return 'preAbsence';
  }
  if (statusType === 'preAbsence' && targetDate === todayDate) {
    return 'absence';
  }
  return statusType;
}

/**
 * UserStatusType を Attendance 系のステータス文字列に変換する。
 *
 * Attendance リスト (AttendanceDailyItem.Status) は日本語文字列:
 *   - '当日欠席'
 *   - '事前欠席'
 *   - '未' (遅刻・早退は通所扱いのため未変更)
 *
 * @returns Attendance のステータス値。null の場合は Attendance 書き込み不要。
 */
export function toAttendanceStatus(
  statusType: UserStatusType,
): '当日欠席' | '事前欠席' | null {
  switch (statusType) {
    case 'absence':
      return '当日欠席';
    case 'preAbsence':
      return '事前欠席';
    default:
      // 遅刻・早退は Attendance のステータスを変更しない
      return null;
  }
}

/** 未来の予定登録で許容する最大日数 */
export const MAX_FUTURE_DAYS = 31;

/**
 * 対象日が登録可能な範囲かバリデーションする。
 *
 * @returns エラーメッセージ。null なら有効。
 */
export function validateTargetDate(
  targetDate: string,
  todayDate: string,
  maxFutureDays: number = MAX_FUTURE_DAYS,
): string | null {
  if (targetDate < todayDate) {
    return '過去の日付には登録できません';
  }
  const targetMs = new Date(`${targetDate}T00:00:00`).getTime();
  const todayMs = new Date(`${todayDate}T00:00:00`).getTime();
  const diffDays = Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));
  if (diffDays > maxFutureDays) {
    return `${maxFutureDays}日先までしか登録できません`;
  }
  return null;
}
