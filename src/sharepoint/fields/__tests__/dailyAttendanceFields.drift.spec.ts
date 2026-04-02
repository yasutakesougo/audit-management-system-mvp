/**
 * daily_attendance drift 耐性テスト
 *
 * DAILY_ATTENDANCE_CANDIDATES が resolveInternalNamesDetailed を通して
 * 各種 drift シナリオを正しく吸収できることを確認する。
 *
 * 背景:
 *   registry の provisioningFields は 'UserID' / 'Date' で定義しているが、
 *   DAILY_ATTENDANCE_FIELDS (旧フィールドマップ) は 'UserCode' / 'RecordDate' を使用。
 *   candidates に両方を含めることで、実テナントのどちらの命名でも WARN として吸収する。
 *
 * シナリオ:
 *  1. 標準名 (UserID / Date / Status) がそのまま解決される（drift なし）
 *  2. UserCode (旧フィールドマップ名) が userID として解決される (WARN)
 *  3. RecordDate / EntryDate が date として解決される (WARN)
 *  4. Date0 (サフィックス drift) が date として解決される (WARN)
 *  5. cr013_ プレフィックスへのリネームを吸収 (WARN)
 *  6. 必須 3 フィールド (userID, date, status) が揃えば isHealthy=true
 *  7. 各必須フィールドが欠落すれば isHealthy=false (FAIL)
 *  8. オプション列 (isTrial, notes) のみ欠落なら isHealthy=true
 */
import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  DAILY_ATTENDANCE_CANDIDATES,
  DAILY_ATTENDANCE_ESSENTIALS,
} from '../dailyAttendanceFields';

const cands = DAILY_ATTENDANCE_CANDIDATES as unknown as Record<string, string[]>;
const essentials = DAILY_ATTENDANCE_ESSENTIALS as unknown as string[];

function resolve(available: Set<string>) {
  return resolveInternalNamesDetailed(available, cands);
}

function isHealthy(resolved: ReturnType<typeof resolve>['resolved']) {
  return areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials);
}

// ── 1. 標準名 ─────────────────────────────────────────────────────────────────

describe('DAILY_ATTENDANCE_CANDIDATES — 標準名', () => {
  const available = new Set([
    'Id', 'Title', 'UserID', 'Date', 'Status', 'IsTrial', 'Notes',
  ]);

  it('必須 3 フィールドがすべて解決される', () => {
    const { resolved, missing } = resolve(available);
    expect(resolved.userID).toBe('UserID');
    expect(resolved.date).toBe('Date');
    expect(resolved.status).toBe('Status');
    expect(missing).toHaveLength(0);
  });

  it('drift フラグが false（完全一致）', () => {
    const { fieldStatus } = resolve(available);
    expect(fieldStatus.userID.isDrifted).toBe(false);
    expect(fieldStatus.date.isDrifted).toBe(false);
    expect(fieldStatus.status.isDrifted).toBe(false);
  });

  it('isHealthy=true', () => {
    const { resolved } = resolve(available);
    expect(isHealthy(resolved)).toBe(true);
  });
});

// ── 2. UserID → UserCode (旧フィールドマップ名) ──────────────────────────────

describe('DAILY_ATTENDANCE_CANDIDATES — userID drift', () => {
  it('UserCode が userID として解決される (WARN)', () => {
    const available = new Set(['UserCode', 'Date', 'Status']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.userID).toBe('UserCode');
    expect(fieldStatus.userID.isDrifted).toBe(true);
  });

  it('UserId が userID として解決される (WARN)', () => {
    const available = new Set(['UserId', 'Date', 'Status']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.userID).toBe('UserId');
    expect(fieldStatus.userID.isDrifted).toBe(true);
  });

  it('UserIdId (Lookup サフィックス) が userID として解決される (WARN)', () => {
    const available = new Set(['UserIdId', 'Date', 'Status']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.userID).toBe('UserIdId');
    expect(fieldStatus.userID.isDrifted).toBe(true);
  });

  it('cr013_userId が userID として解決される (WARN)', () => {
    const available = new Set(['cr013_userId', 'Date', 'Status']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.userID).toBe('cr013_userId');
    expect(fieldStatus.userID.isDrifted).toBe(true);
  });
});

// ── 3. Date → RecordDate / EntryDate リネーム ─────────────────────────────────

describe('DAILY_ATTENDANCE_CANDIDATES — date drift', () => {
  it('RecordDate (旧フィールドマップ名) が date として解決される (WARN)', () => {
    const available = new Set(['UserID', 'RecordDate', 'Status']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.date).toBe('RecordDate');
    expect(fieldStatus.date.isDrifted).toBe(true);
  });

  it('EntryDate が date として解決される (WARN)', () => {
    const available = new Set(['UserID', 'EntryDate', 'Status']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.date).toBe('EntryDate');
    expect(fieldStatus.date.isDrifted).toBe(true);
  });

  it('AttendanceDate が date として解決される (WARN)', () => {
    const available = new Set(['UserID', 'AttendanceDate', 'Status']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.date).toBe('AttendanceDate');
    expect(fieldStatus.date.isDrifted).toBe(true);
  });

  it('Date0 (サフィックス drift) が date として解決される (WARN)', () => {
    const available = new Set(['UserID', 'Date0', 'Status']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.date).toBe('Date0');
    expect(fieldStatus.date.isDrifted).toBe(true);
  });
});

// ── 4. Status drift ───────────────────────────────────────────────────────────

describe('DAILY_ATTENDANCE_CANDIDATES — status drift', () => {
  it('AttendanceStatus が status として解決される (WARN)', () => {
    const available = new Set(['UserID', 'Date', 'AttendanceStatus']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.status).toBe('AttendanceStatus');
    expect(fieldStatus.status.isDrifted).toBe(true);
  });

  it('Status0 (サフィックス drift) が status として解決される (WARN)', () => {
    const available = new Set(['UserID', 'Date', 'Status0']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.status).toBe('Status0');
    expect(fieldStatus.status.isDrifted).toBe(true);
  });
});

// ── 5. isHealthy 境界 ─────────────────────────────────────────────────────────

describe('DAILY_ATTENDANCE_ESSENTIALS 境界', () => {
  it('必須 3 フィールドが揃えば isHealthy=true（drift 経由でも可）', () => {
    // UserCode / RecordDate / AttendanceStatus — すべて drift
    const available = new Set(['UserCode', 'RecordDate', 'AttendanceStatus']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved)).toBe(true);
  });

  it('userID が完全欠落すれば isHealthy=false', () => {
    const available = new Set(['Date', 'Status']); // UserID 系なし
    const { resolved } = resolve(available);
    expect(isHealthy(resolved)).toBe(false);
  });

  it('date が完全欠落すれば isHealthy=false', () => {
    const available = new Set(['UserID', 'Status']); // Date 系なし
    const { resolved } = resolve(available);
    expect(isHealthy(resolved)).toBe(false);
  });

  it('status が完全欠落すれば isHealthy=false', () => {
    const available = new Set(['UserID', 'Date']); // Status 系なし
    const { resolved } = resolve(available);
    expect(isHealthy(resolved)).toBe(false);
  });

  it('オプション列 (IsTrial, Notes) のみ欠落でも isHealthy=true', () => {
    const available = new Set(['UserID', 'Date', 'Status']); // 必須のみ
    const { resolved } = resolve(available);
    expect(isHealthy(resolved)).toBe(true);
  });
});
