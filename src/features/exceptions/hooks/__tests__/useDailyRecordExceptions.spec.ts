import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDailyRecordExceptions } from '../useDailyRecordExceptions';

describe('useDailyRecordExceptions', () => {
  it('daily-record missing を parent + child で返す', () => {
    const { result } = renderHook(() => useDailyRecordExceptions({
      expectedUsers: [
        { userId: 'U-001', userName: '田中 太郎' },
        { userId: 'U-002', userName: '佐藤 花子' },
      ],
      existingRecords: [],
      targetDate: '2026-03-25',
    }));

    expect(result.current.items).toHaveLength(3);
    expect(result.current.count).toBe(2);
    expect(result.current.items[0]?.id).toBe('daily-missing-record-2026-03-25');
  });

  it('missing がない場合は空', () => {
    const { result } = renderHook(() => useDailyRecordExceptions({
      expectedUsers: [{ userId: 'U-001', userName: '田中 太郎' }],
      existingRecords: [
        { userId: 'U-001', userName: '田中 太郎', date: '2026-03-25', status: 'completed' },
      ],
      targetDate: '2026-03-25',
    }));

    expect(result.current.items).toEqual([]);
    expect(result.current.count).toBe(0);
  });
});
