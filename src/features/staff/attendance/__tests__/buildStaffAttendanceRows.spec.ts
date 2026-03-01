import { describe, expect, it } from 'vitest';
import { buildStaffAttendanceRows, type StaffLike } from '../buildStaffAttendanceRows';
import type { StaffAttendance } from '../types';

const mkStaff = (staffId: string, name?: string): StaffLike => ({
  staffId,
  name,
});

const mkAtt = (
  staffId: string,
  status: StaffAttendance['status'] = '出勤',
  extra?: Partial<StaffAttendance>,
): StaffAttendance => ({
  staffId,
  recordDate: '2026-03-01',
  status,
  ...extra,
});

describe('buildStaffAttendanceRows', () => {
  it('staff 2名, attendance 0件 → 2行とも未入力', () => {
    const staff = [mkStaff('S001', '佐藤'), mkStaff('S002', '鈴木')];
    const rows = buildStaffAttendanceRows(staff, []);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ staffId: 'S001', staffName: '佐藤', status: '未入力' });
    expect(rows[1]).toMatchObject({ staffId: 'S002', staffName: '鈴木', status: '未入力' });
  });

  it('staff 2名, attendance 1件 → 1行だけ status が反映', () => {
    const staff = [mkStaff('S001', '佐藤'), mkStaff('S002', '鈴木')];
    const att = [mkAtt('S002', '出勤', { note: 'テスト' })];
    const rows = buildStaffAttendanceRows(staff, att);

    expect(rows).toHaveLength(2);
    // 未入力が先（sort order 0）
    const s001 = rows.find((r) => r.staffId === 'S001')!;
    const s002 = rows.find((r) => r.staffId === 'S002')!;
    expect(s001.status).toBe('未入力');
    expect(s002.status).toBe('出勤');
    expect(s002.note).toBe('テスト');
  });

  it('sort: 未入力 → 欠勤 → 出勤 → staffId', () => {
    const staff = [
      mkStaff('S001'),
      mkStaff('S002'),
      mkStaff('S003'),
    ];
    const att = [
      mkAtt('S001', '出勤'),
      mkAtt('S003', '欠勤'),
      // S002 is 未入力
    ];
    const rows = buildStaffAttendanceRows(staff, att);

    expect(rows.map((r) => r.staffId)).toEqual([
      'S002', // 未入力 (0)
      'S003', // 欠勤 (1)
      'S001', // 出勤 (2)
    ]);
  });

  it('staffName is preserved from staff master', () => {
    const staff = [mkStaff('S001', '田中太郎')];
    const att = [mkAtt('S001', '出勤', { isFinalized: true })];
    const rows = buildStaffAttendanceRows(staff, att);

    expect(rows[0]).toMatchObject({
      staffId: 'S001',
      staffName: '田中太郎',
      status: '出勤',
      isFinalized: true,
    });
  });

  it('same status sorts by staffId ascending', () => {
    const staff = [mkStaff('S003'), mkStaff('S001'), mkStaff('S002')];
    const rows = buildStaffAttendanceRows(staff, []);

    // All are 未入力, so sort by staffId
    expect(rows.map((r) => r.staffId)).toEqual(['S001', 'S002', 'S003']);
  });
});
