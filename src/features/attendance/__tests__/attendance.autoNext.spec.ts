import { describe, expect, it } from 'vitest';

import { getNextTargetUserCode } from '../attendance.autoNext';

describe('getNextTargetUserCode', () => {
  it('prioritizes checked-in rows with missing temperature', () => {
    const rows = [
      { userCode: 'U001', status: '通所中' as const, checkInAt: '2026-03-01T09:00:00Z' },
      { userCode: 'U002', status: '未' as const },
    ];
    const temps: Record<string, number | undefined> = {};

    expect(getNextTargetUserCode(rows, temps)).toBe('U001');
  });

  it('falls back to canCheckIn row when all checked-in rows have temperature', () => {
    const rows = [
      { userCode: 'U001', status: '通所中' as const, checkInAt: '2026-03-01T09:00:00Z' },
      { userCode: 'U002', status: '未' as const },
    ];
    const temps: Record<string, number | undefined> = { U001: 36.5 };

    expect(getNextTargetUserCode(rows, temps)).toBe('U002');
  });

  it('returns null when all rows are complete', () => {
    const rows = [
      { userCode: 'U001', status: '通所中' as const, checkInAt: '2026-03-01T09:00:00Z' },
      { userCode: 'U002', status: '退所済' as const, checkInAt: '2026-03-01T08:30:00Z' },
    ];
    const temps: Record<string, number | undefined> = { U001: 36.5, U002: 36.8 };

    expect(getNextTargetUserCode(rows, temps)).toBeNull();
  });
});
