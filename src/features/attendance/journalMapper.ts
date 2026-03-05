/**
 * Journal Mapper — Attendance Domain → Personal Journal Display
 *
 * attendanceドメインの型をPersonalJournalPage表示用の型に変換する純粋関数。
 * Excel帳票の送迎コード規約（○活, K, D, B, T）に準拠。
 */
import type { MealAmount } from '@/domain/daily/types';
import type { AttendanceVisit } from '@/features/attendance/attendance.logic';
import type { TransportMethod } from '@/features/attendance/transportMethod';

// ── Output Types ────────────────────────────────────────────────────────────

export type JournalAttendanceStatus = '出席' | '欠席' | '遅刻' | '早退' | '休日';
export type JournalTransportCode = '' | '活送迎→○' | '家族→K' | '電車→D' | 'バス→B' | '徒歩→T';

export interface PersonalDayEntry {
  day: number;
  dow: string;
  attendance: JournalAttendanceStatus;
  arrivalTransport: JournalTransportCode;
  arrivalTime: string;
  departTransport: JournalTransportCode;
  departTime: string;
  mealAmount?: MealAmount;
  amActivity: string;
  pmActivity: string;
  restraint: boolean;
  selfHarm: boolean;
  otherInjury: boolean;
  seizure: boolean;
  specialNotes: string;
  hasAttachment: boolean;
}

// ── Status Mapping ──────────────────────────────────────────────────────────

/**
 * attendanceドメインのステータス → 日誌表示ステータス
 */
export function mapStatusToJournal(
  status: AttendanceVisit['status'],
  isEarlyLeave?: boolean,
): JournalAttendanceStatus {
  switch (status) {
    case '通所中':
    case '退所済':
      return isEarlyLeave ? '早退' : '出席';
    case '当日欠席':
      return '欠席';
    case '未':
    default:
      return '出席'; // 未確認は出席として表示（入力前状態）
  }
}

// ── Transport Mapping ───────────────────────────────────────────────────────

const TRANSPORT_METHOD_TO_JOURNAL: Record<TransportMethod, JournalTransportCode> = {
  office_shuttle: '活送迎→○',
  family: '家族→K',
  self: '徒歩→T',
  guide_helper: '活送迎→○', // ガイドヘルパーは送迎扱い
  other: '',
};

/**
 * TransportMethod enum → 日誌の送迎コード
 */
export function mapTransportToJournal(method?: TransportMethod): JournalTransportCode {
  if (!method) return '';
  return TRANSPORT_METHOD_TO_JOURNAL[method] ?? '';
}

// ── Time Formatting ─────────────────────────────────────────────────────────

/**
 * ISO文字列 → HH:mm (JST)
 */
function formatTimeJST(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ja-JP', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
}

// ── Row Mapping ─────────────────────────────────────────────────────────────

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/**
 * AttendanceVisit → PersonalDayEntry 完全変換
 */
export function mapVisitToJournalEntry(
  visit: AttendanceVisit,
  date: Date,
  extra?: {
    mealAmount?: MealAmount;
    amActivity?: string;
    pmActivity?: string;
    restraint?: boolean;
    selfHarm?: boolean;
    otherInjury?: boolean;
    seizure?: boolean;
    specialNotes?: string;
    hasAttachment?: boolean;
  },
): PersonalDayEntry {
  const isAbsent = visit.status === '当日欠席';

  return {
    day: date.getDate(),
    dow: DOW_LABELS[date.getDay()],
    attendance: mapStatusToJournal(visit.status, visit.isEarlyLeave),
    arrivalTransport: isAbsent ? '' : mapTransportToJournal(visit.transportToMethod),
    arrivalTime: isAbsent ? '' : formatTimeJST(visit.checkInAt),
    departTransport: isAbsent ? '' : mapTransportToJournal(visit.transportFromMethod),
    departTime: isAbsent ? '' : formatTimeJST(visit.checkOutAt),
    mealAmount: isAbsent ? undefined : extra?.mealAmount,
    amActivity: isAbsent ? '' : (extra?.amActivity ?? ''),
    pmActivity: isAbsent ? '' : (extra?.pmActivity ?? ''),
    restraint: extra?.restraint ?? false,
    selfHarm: extra?.selfHarm ?? false,
    otherInjury: extra?.otherInjury ?? false,
    seizure: extra?.seizure ?? false,
    specialNotes: extra?.specialNotes ?? '',
    hasAttachment: extra?.hasAttachment ?? false,
  };
}
