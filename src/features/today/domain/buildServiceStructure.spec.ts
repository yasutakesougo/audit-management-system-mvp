import { describe, expect, it } from 'vitest';
import type { Staff } from '@/types';
import { buildServiceStructure } from './buildServiceStructure';

function makeStaff(overrides: Partial<Staff>): Staff {
  return {
    id: 1,
    staffId: 'S001',
    name: '職員',
    certifications: [],
    workDays: [],
    baseWorkingDays: [],
    ...overrides,
  };
}

describe('buildServiceStructure', () => {
  it('owner が役割名でも職員マスタの氏名を優先して生活介護に割り当てる', () => {
    const staff = [
      makeStaff({ id: 1, staffId: 'S001', name: '山田', jobTitle: '生活支援員' }),
      makeStaff({ id: 2, staffId: 'S002', name: '佐藤', jobTitle: '生活支援員' }),
      makeStaff({ id: 3, staffId: 'S003', name: '鈴木', jobTitle: '生活支援員' }),
      makeStaff({ id: 4, staffId: 'S004', name: '村上', jobTitle: '生活支援員' }),
      makeStaff({ id: 5, staffId: 'S005', name: '高橋', jobTitle: '生活支援員' }),
      makeStaff({ id: 6, staffId: 'S006', name: '伊藤', jobTitle: '外活動担当' }),
      makeStaff({ id: 7, staffId: 'S007', name: '中村', jobTitle: '受付' }),
      makeStaff({ id: 8, staffId: 'S008', name: '退職済', jobTitle: '生活支援員', active: false }),
    ];

    const staffLane = [
      { id: 'lane-1', time: '09:00', title: '午前記録', owner: '支援員' },
      { id: 'lane-2', time: '10:00', title: '外活動', owner: '外活動' },
      { id: 'lane-3', time: '16:00', title: '退所対応', owner: '受付' },
    ];

    const result = buildServiceStructure(staffLane, staff);

    expect(result.dayCare.firstWorkroomStaff).toEqual(['山田', '佐藤']);
    expect(result.dayCare.secondWorkroomStaff).toEqual(['鈴木', '村上']);
    expect(result.dayCare.japaneseRoomStaff).toEqual(['高橋']);
    expect(result.dayCare.outdoorActivityStaff).toEqual(['伊藤']);
    expect(result.dayCare.playroomStaff).toContain('中村');
    expect(result.dayCare.firstWorkroomStaff).not.toContain('支援員');
    expect(result.dayCare.playroomStaff).not.toContain('受付');
    expect(result.dayCare.firstWorkroomStaff).not.toContain('退職済');
  });
});

