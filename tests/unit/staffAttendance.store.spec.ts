import { useStaffAttendanceStore } from '@/features/staff/attendance/store';
import { beforeEach, describe, expect, it } from 'vitest';

describe('useStaffAttendanceStore', () => {
  beforeEach(() => {
    // Reset in-memory store
    const store = useStaffAttendanceStore();
    store.attendances = {};
  });

  it('upsert/get/listByDate works', () => {
    const store = useStaffAttendanceStore();

    store.upsert({ staffId: 's1', recordDate: '2026-01-31', status: '出勤' });
    store.upsert({
      staffId: 's2',
      recordDate: '2026-01-31',
      status: '欠勤',
    });
    store.upsert({ staffId: 's3', recordDate: '2026-02-01', status: '欠勤' });

    expect(store.get('2026-01-31', 's1')?.status).toBe('出勤');
    expect(store.listByDate('2026-01-31')).toHaveLength(2);
    expect(store.listByDate('2026-02-01')).toHaveLength(1);
  });

  it('remove deletes only the target key', () => {
    const store = useStaffAttendanceStore();

    store.upsert({ staffId: 's1', recordDate: '2026-01-31', status: '出勤' });
    store.upsert({
      staffId: 's2',
      recordDate: '2026-01-31',
      status: '欠勤',
    });

    store.remove('2026-01-31', 's1');

    expect(store.get('2026-01-31', 's1')).toBeUndefined();
    expect(store.get('2026-01-31', 's2')?.status).toBe('欠勤');
  });

  it('countByDate returns correct counts', () => {
    const store = useStaffAttendanceStore();

    store.upsert({ staffId: 's1', recordDate: '2026-01-31', status: '出勤' });
    store.upsert({ staffId: 's2', recordDate: '2026-01-31', status: '欠勤' });
    store.upsert({
      staffId: 's3',
      recordDate: '2026-01-31',
      status: '出勤',
    });

    expect(store.countByDate('2026-01-31')).toEqual({
      onDuty: 2,
      out: 0,
      absent: 1,
      total: 3,
    });
  });
});
