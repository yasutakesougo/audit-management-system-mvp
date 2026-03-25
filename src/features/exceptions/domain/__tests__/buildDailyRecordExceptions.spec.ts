import { describe, expect, it } from 'vitest';
import type { DailyRecordSummary } from '../exceptionLogic';
import { buildDailyRecordExceptions } from '../buildDailyRecordExceptions';

function makeRecord(
  overrides: Partial<DailyRecordSummary> & { userId: string },
): DailyRecordSummary {
  return {
    userName: '対象者',
    date: '2026-03-25',
    status: 'completed',
    ...overrides,
  };
}

describe('buildDailyRecordExceptions', () => {
  it('missing-record を parent + child に変換する', () => {
    const result = buildDailyRecordExceptions({
      expectedUsers: [
        { userId: 'U-001', userName: '田中 太郎' },
        { userId: 'U-002', userName: '佐藤 花子' },
        { userId: 'U-003', userName: '高橋 次郎' },
      ],
      existingRecords: [
        makeRecord({ userId: 'U-002', userName: '佐藤 花子' }),
      ],
      targetDate: '2026-03-25',
    });

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      id: 'daily-missing-record-2026-03-25',
      category: 'missing-record',
      severity: 'high',
    });
    const childU001 = result.find(r => r.targetUserId === 'U-001');
    const childU003 = result.find(r => r.targetUserId === 'U-003');

    expect(childU001).toMatchObject({
      id: 'missing-U-001-2026-03-25',
      parentId: 'daily-missing-record-2026-03-25',
      targetUserId: 'U-001',
      actionPath: '/daily/activity?userId=U-001&date=2026-03-25',
    });
    expect(childU003).toMatchObject({
      id: 'missing-U-003-2026-03-25',
      parentId: 'daily-missing-record-2026-03-25',
      targetUserId: 'U-003',
    });
  });

  it('child は最大5件、超過分は parent 説明に反映する', () => {
    const expectedUsers = Array.from({ length: 7 }, (_, index) => ({
      userId: `U-${String(index + 1).padStart(3, '0')}`,
      userName: `User ${index + 1}`,
    }));

    const result = buildDailyRecordExceptions({
      expectedUsers,
      existingRecords: [],
      targetDate: '2026-03-25',
    });

    expect(result.filter((item) => item.parentId)).toHaveLength(5);
    expect(result[0]?.description).toContain('他 2 件');
  });

  it('userId 不正はスキップする', () => {
    const result = buildDailyRecordExceptions({
      expectedUsers: [
        { userId: 'U-001', userName: '田中 太郎' },
        { userId: '', userName: '不明' },
      ],
      existingRecords: [],
      targetDate: '2026-03-25',
    });

    const childIds = result.filter((item) => item.parentId).map((item) => item.id);
    expect(childIds).toEqual(['missing-U-001-2026-03-25']);
  });

  it('missing がなければ空配列', () => {
    const result = buildDailyRecordExceptions({
      expectedUsers: [{ userId: 'U-001', userName: '田中 太郎' }],
      existingRecords: [makeRecord({ userId: 'U-001', userName: '田中 太郎' })],
      targetDate: '2026-03-25',
    });

    expect(result).toEqual([]);
  });
});
