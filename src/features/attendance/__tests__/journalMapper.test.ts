import { describe, expect, it } from 'vitest';
import type { AttendanceVisit } from '../attendance.logic';
import {
    mapStatusToJournal,
    mapTransportToJournal,
    mapVisitToJournalEntry,
} from '../journalMapper';

// ── mapStatusToJournal ──────────────────────────────────────────────────────

describe('mapStatusToJournal', () => {
  it.each([
    ['通所中', false, '出席'],
    ['退所済', false, '出席'],
    ['当日欠席', false, '欠席'],
    ['未', false, '出席'],
  ] as const)('status=%s, earlyLeave=%s → %s', (status, earlyLeave, expected) => {
    expect(mapStatusToJournal(status, earlyLeave)).toBe(expected);
  });

  it('早退: 退所済 + isEarlyLeave → 早退', () => {
    expect(mapStatusToJournal('退所済', true)).toBe('早退');
  });

  it('早退: 通所中 + isEarlyLeave → 早退', () => {
    expect(mapStatusToJournal('通所中', true)).toBe('早退');
  });

  it('欠席は早退フラグ無視', () => {
    expect(mapStatusToJournal('当日欠席', true)).toBe('欠席');
  });
});

// ── mapTransportToJournal ───────────────────────────────────────────────────

describe('mapTransportToJournal', () => {
  it.each([
    ['office_shuttle', '活送迎→○'],
    ['family', '家族→K'],
    ['self', '徒歩→T'],
    ['guide_helper', '活送迎→○'],
    ['other', ''],
  ] as const)('method=%s → %s', (method, expected) => {
    expect(mapTransportToJournal(method)).toBe(expected);
  });

  it('undefined → 空文字', () => {
    expect(mapTransportToJournal(undefined)).toBe('');
  });
});

// ── mapVisitToJournalEntry ──────────────────────────────────────────────────

describe('mapVisitToJournalEntry', () => {
  const baseVisit: AttendanceVisit = {
    userCode: 'U001',
    status: '通所中',
    recordDate: '2026-03-05',
    cntAttendIn: 1,
    cntAttendOut: 0,
    transportTo: true,
    transportFrom: true,
    transportToMethod: 'office_shuttle',
    transportFromMethod: 'family',
    isEarlyLeave: false,
    absentMorningContacted: false,
    absentMorningMethod: '',
    eveningChecked: false,
    eveningNote: '',
    isAbsenceAddonClaimable: false,
    providedMinutes: 360,
    checkInAt: '2026-03-05T00:15:00.000Z', // JST 09:15
    checkOutAt: '2026-03-05T07:00:00.000Z', // JST 16:00
  };

  it('出席行を変換', () => {
    const date = new Date(2026, 2, 5); // 2026-03-05 Thu
    const entry = mapVisitToJournalEntry(baseVisit, date, {
      mealAmount: '完食',
      amActivity: '軽作業',
      pmActivity: '散歩',
    });

    expect(entry.day).toBe(5);
    expect(entry.dow).toBe('木');
    expect(entry.attendance).toBe('出席');
    expect(entry.arrivalTransport).toBe('活送迎→○');
    expect(entry.departTransport).toBe('家族→K');
    expect(entry.arrivalTime).toBe('09:15');
    expect(entry.departTime).toBe('16:00');
    expect(entry.mealAmount).toBe('完食');
    expect(entry.amActivity).toBe('軽作業');
    expect(entry.pmActivity).toBe('散歩');
  });

  it('欠席行: 送迎・時刻は空', () => {
    const absentVisit: AttendanceVisit = {
      ...baseVisit,
      status: '当日欠席',
      checkInAt: undefined,
      checkOutAt: undefined,
    };
    const date = new Date(2026, 2, 5);
    const entry = mapVisitToJournalEntry(absentVisit, date);

    expect(entry.attendance).toBe('欠席');
    expect(entry.arrivalTransport).toBe('');
    expect(entry.arrivalTime).toBe('');
    expect(entry.departTransport).toBe('');
    expect(entry.departTime).toBe('');
    expect(entry.mealAmount).toBeUndefined();
  });

  it('早退行', () => {
    const earlyVisit: AttendanceVisit = {
      ...baseVisit,
      status: '退所済',
      isEarlyLeave: true,
    };
    const date = new Date(2026, 2, 5);
    const entry = mapVisitToJournalEntry(earlyVisit, date);

    expect(entry.attendance).toBe('早退');
  });
});
