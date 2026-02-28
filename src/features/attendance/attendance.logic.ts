/**
 * Attendance Business Logic Utilities
 *
 * 通所記録に関するビジネスロジックを純粋関数として分離。
 * テスト可能性とコンポーネント間の再利用性を向上。
 */
import { ABSENCE_MONTHLY_LIMIT, FACILITY_CLOSE_TIME } from '@/config/serviceRecords';
import type { AbsentSupportLog } from '@/features/service-provision/domain/absentSupportLog';
import type { TransportMethod } from './transportMethod';

export type AttendanceUser = {
  userCode: string;
  userName: string;
  isTransportTarget: boolean;
  absenceClaimedThisMonth: number;
  standardMinutes: number;

  // Transport method defaults (enum migration - optional for backward compat)
  defaultTransportToMethod?: TransportMethod;
  defaultTransportFromMethod?: TransportMethod;
  defaultTransportToNote?: string;
  defaultTransportFromNote?: string;
};

export type AttendanceStatus = '未' | '通所中' | '退所済' | '当日欠席';

export type AbsentMethod = '電話' | 'SMS' | '家族' | 'その他' | '';

export type AttendanceVisit = {
  userCode: string;
  status: AttendanceStatus;
  recordDate: string;

  cntAttendIn: number;
  cntAttendOut: number;

  transportTo: boolean;
  transportFrom: boolean;

  // Transport method enum (migration - optional for backward compat)
  transportToMethod?: TransportMethod;
  transportFromMethod?: TransportMethod;
  transportToNote?: string;
  transportFromNote?: string;

  isEarlyLeave: boolean;

  absentMorningContacted: boolean;
  absentMorningMethod: AbsentMethod;

  eveningChecked: boolean;
  eveningNote: string;

  isAbsenceAddonClaimable: boolean;

  // 欠席時対応ログ（AbsentSupportLog を統合 — 制度要件補完用）
  absentSupport?: AbsentSupportLog;

  providedMinutes: number;

  userConfirmedAt?: string;

  // 入退所のタイムスタンプ（あれば）
  checkInAt?: string;
  checkOutAt?: string;
};

/**
 * 欠席加算の算定条件判定
 */
export function computeAbsenceEligibility(
  user: AttendanceUser,
  morningContacted: boolean,
  eveningChecked: boolean,
  monthlyLimit: number = ABSENCE_MONTHLY_LIMIT,
): boolean {
  // 朝連絡・夕方確認の両方が揃っていないと NG
  if (!morningContacted || !eveningChecked) return false;

  // 月間上限チェック（当月請求件数 < 上限）
  if (user.absenceClaimedThisMonth >= monthlyLimit) return false;

  return true;
}

/**
 * 欠席用の Visit 行を構築
 */
export function buildAbsentVisit(
  base: AttendanceVisit,
  params: {
    morningContacted: boolean;
    morningMethod: AbsentMethod;
    eveningChecked: boolean;
    eveningNote: string;
    eligible: boolean;
    absentSupport?: AbsentSupportLog;
  },
): AttendanceVisit {
  return {
    ...base,
    status: '当日欠席',
    cntAttendIn: 0,
    cntAttendOut: 0,
    checkInAt: undefined,
    checkOutAt: undefined,
    transportTo: false,
    transportFrom: false,
    absentMorningContacted: params.morningContacted,
    absentMorningMethod: params.morningMethod,
    eveningChecked: params.eveningChecked,
    eveningNote: params.eveningNote,
    isAbsenceAddonClaimable: params.eligible,
    absentSupport: params.absentSupport,
    providedMinutes: 0,
    userConfirmedAt: undefined,
    isEarlyLeave: false,
  };
}

/**
 * 2つのISO文字列の差分（分）を返す。切り捨て＆0未満は0。
 */
export function diffMinutes(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;

  const diffMs = endMs - startMs;
  if (diffMs <= 0) return 0;

  return Math.floor(diffMs / (1000 * 60));
}

/**
 * 退所可否判定
 */
export function canCheckOut(visit?: AttendanceVisit): boolean {
  if (!visit) return false;
  if (visit.status !== '通所中') return false;
  if (visit.cntAttendOut !== 0) return false;
  // cntAttendIn が 0 でも true を返す仕様（テストどおり）
  return true;
}

/**
 * 乖離件数カウント
 */
export function getDiscrepancyCount(
  visits: Record<string, AttendanceVisit>,
  users: AttendanceUser[],
  threshold: number,
): number {
  if (!users.length || !Object.keys(visits).length) return 0;

  const userMap = new Map<string, AttendanceUser>();
  for (const u of users) {
    userMap.set(u.userCode, u);
  }

  let count = 0;

  for (const visit of Object.values(visits)) {
    const user = userMap.get(visit.userCode);
    if (!user) continue;

    const provided = visit.providedMinutes ?? 0;
    if (provided <= 0) continue;

    const limit = user.standardMinutes * threshold;
    if (provided < limit) {
      count += 1;
    }
  }

  return count;
}

/**
 * ユーザー一覧から初期の Visit レコードを構築
 */
export function buildInitialVisits(
  users: AttendanceUser[],
  recordDate: string,
): Record<string, AttendanceVisit> {
  const result: Record<string, AttendanceVisit> = {};

  for (const u of users) {
    result[u.userCode] = {
      userCode: u.userCode,
      status: '未',
      recordDate,
      cntAttendIn: 0,
      cntAttendOut: 0,
      transportTo: false,
      transportFrom: false,
      isEarlyLeave: false,
      absentMorningContacted: false,
      absentMorningMethod: '',
      eveningChecked: false,
      eveningNote: '',
      isAbsenceAddonClaimable: false,
      providedMinutes: 0,
      userConfirmedAt: undefined,
    };
  }

  return result;
}

/**
 * 閉所時間前かどうかの判定
 * closeTimeStr は "HH:mm" 形式
 */
export function isBeforeCloseTime(
  date: Date,
  closeTimeStr: string = FACILITY_CLOSE_TIME,
): boolean {
  const [hh, mm] = closeTimeStr.split(':').map((v) => parseInt(v, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    // フォーマットがおかしい場合や時間の範囲が無効な場合は false を返す
    return false;
  }

  const close = new Date(date.getTime());
  close.setHours(hh, mm, 0, 0);

  return date.getTime() < close.getTime();
}

/**
 * ISO文字列 → JST HH:mm
 */
export function formatTime(iso?: string | null): string {
  if (!iso) return '--:--';

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    // 無効な文字列の場合でも必ず文字列を返す
    return '--:--';
  }

  // テストでは 09:15Z → 18:15 となっているので、明示的に JST でフォーマット
  return d.toLocaleTimeString('ja-JP', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
}
