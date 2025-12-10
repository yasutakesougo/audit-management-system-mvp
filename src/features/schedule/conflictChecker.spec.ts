import { describe, expect, it } from 'vitest';
import {
    checkScheduleConflicts,
    getConflictSeverity,
    hasTimeOverlap,
} from './conflictChecker';
import {
    Schedule,
    ScheduleForm,
    Status,
} from './types';

// --- test helpers ----------------------------------------------------

const DEFAULT_STATUS: Status = '承認済み';

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `S${idCounter}`;
}

function makeUserSchedule(params: {
  userId?: string;
  staffIds?: string[];
  start: string;
  end: string;
  title?: string;
}): Schedule {
  const { userId, staffIds, start, end, title = 'テスト予定' } = params;
  return {
    id: nextId(),
    etag: 'test',
    category: 'User',
    title,
    start,
    end,
    allDay: false,
    status: DEFAULT_STATUS,
    serviceType: '一時ケア',
    personType: 'Internal',
    personId: userId,
    personName: `利用者${userId}`,
    staffIds: staffIds || ['ST001'],
    staffNames: ['職員A'],
  };
}

function makeStaffSchedule(params: {
  staffIds: string[];
  start: string;
  end: string;
  title?: string;
}): Schedule {
  const { staffIds, start, end, title = '職員予定' } = params;
  return {
    id: nextId(),
    etag: 'test',
    category: 'Staff',
    title,
    start,
    end,
    allDay: false,
    status: DEFAULT_STATUS,
    subType: '会議',
    staffIds,
    staffNames: ['職員A'],
  };
}

function makeScheduleForm(params: {
  userId?: string;
  start: string;
  end: string;
  title?: string;
}): ScheduleForm {
  const { userId, start, end, title = '新規予定' } = params;
  return {
    userId: userId || 'U001',
    title,
    start,
    end,
    status: 'planned',
  };
}

// --- tests -----------------------------------------------------------

describe('hasTimeOverlap', () => {
  it('detects overlap when intervals intersect', () => {
    expect(hasTimeOverlap(
      '2025-01-01T09:00:00',
      '2025-01-01T10:00:00',
      '2025-01-01T09:30:00',
      '2025-01-01T10:30:00'
    )).toBe(true);
  });

  it('does NOT detect overlap when intervals are adjacent', () => {
    expect(hasTimeOverlap(
      '2025-01-01T09:00:00',
      '2025-01-01T10:00:00',
      '2025-01-01T10:00:00',
      '2025-01-01T11:00:00'
    )).toBe(false);
  });

  it('detects overlap when one interval contains another', () => {
    expect(hasTimeOverlap(
      '2025-01-01T08:00:00',
      '2025-01-01T18:00:00',
      '2025-01-01T12:00:00',
      '2025-01-01T13:00:00'
    )).toBe(true);
  });

  it('handles invalid dates gracefully', () => {
    expect(hasTimeOverlap(
      'invalid-date',
      '2025-01-01T10:00:00',
      '2025-01-01T09:00:00',
      '2025-01-01T11:00:00'
    )).toBe(false);
  });
});

describe('checkScheduleConflicts', () => {
  it('detects double booking for same staff member', () => {
    const existingSchedule = makeUserSchedule({
      userId: 'U001',
      staffIds: ['ST001'],
      start: '2025-01-01T09:00:00',
      end: '2025-01-01T10:00:00',
    });

    const newForm = makeScheduleForm({
      userId: 'ST001', // 同じ職員が別の予定に
      start: '2025-01-01T09:30:00',
      end: '2025-01-01T10:30:00',
    });

    const result = checkScheduleConflicts(newForm, [existingSchedule]);

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].reason).toBe('double_booking');
  });

  it('detects time overlap for user schedules', () => {
    const existingSchedule = makeUserSchedule({
      userId: 'U001',
      start: '2025-01-01T09:00:00',
      end: '2025-01-01T10:00:00',
    });

    const newForm = makeScheduleForm({
      userId: 'U002', // 異なる利用者
      start: '2025-01-01T09:30:00',
      end: '2025-01-01T10:30:00',
    });

    const result = checkScheduleConflicts(newForm, [existingSchedule]);

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].reason).toBe('time_overlap');
  });

  it('detects staff unavailability', () => {
    const existingStaffSchedule = makeStaffSchedule({
      staffIds: ['ST001'],
      start: '2025-01-01T09:00:00',
      end: '2025-01-01T10:00:00',
    });

    const newForm = makeScheduleForm({
      userId: 'U001',
      start: '2025-01-01T09:30:00',
      end: '2025-01-01T10:30:00',
    });

    const result = checkScheduleConflicts(newForm, [existingStaffSchedule]);

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].reason).toBe('staff_unavailable');
  });

  it('does NOT detect conflict when no time overlap', () => {
    const existingSchedule = makeUserSchedule({
      userId: 'U001',
      start: '2025-01-01T09:00:00',
      end: '2025-01-01T10:00:00',
    });

    const newForm = makeScheduleForm({
      userId: 'U002',
      start: '2025-01-01T10:00:00', // 隣接（重複なし）
      end: '2025-01-01T11:00:00',
    });

    const result = checkScheduleConflicts(newForm, [existingSchedule]);

    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });

  it('excludes specified schedule ID when editing', () => {
    const existingSchedule = makeUserSchedule({
      userId: 'U001',
      start: '2025-01-01T09:00:00',
      end: '2025-01-01T10:00:00',
    });

    const newForm = makeScheduleForm({
      userId: 'U001',
      start: '2025-01-01T09:00:00',
      end: '2025-01-01T10:00:00',
    });

    // 自分自身を除外して編集
    const result = checkScheduleConflicts(newForm, [existingSchedule], existingSchedule.id);

    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });

  it('handles missing required fields gracefully', () => {
    const existingSchedule = makeUserSchedule({
      userId: 'U001',
      start: '2025-01-01T09:00:00',
      end: '2025-01-01T10:00:00',
    });

    const incompleteForm: ScheduleForm = {
      userId: 'U002',
      status: 'planned',
      start: '', // 空の開始時間
      end: '',
    };

    const result = checkScheduleConflicts(incompleteForm, [existingSchedule]);

    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });
});

describe('getConflictSeverity', () => {
  it('returns error for double booking', () => {
    expect(getConflictSeverity('double_booking')).toBe('error');
  });

  it('returns warning for staff unavailability', () => {
    expect(getConflictSeverity('staff_unavailable')).toBe('warning');
  });

  it('returns info for time overlap', () => {
    expect(getConflictSeverity('time_overlap')).toBe('info');
  });
});

describe('Complex Conflict Scenarios', () => {
  it('handles multiple conflicts of different types', () => {
    const userSchedule = makeUserSchedule({
      userId: 'U001',
      staffIds: ['ST001'],
      start: '2025-01-01T09:00:00',
      end: '2025-01-01T10:00:00',
      title: '利用者予定',
    });

    const staffSchedule = makeStaffSchedule({
      staffIds: ['ST002'],
      start: '2025-01-01T09:30:00',
      end: '2025-01-01T10:30:00',
      title: '職員会議',
    });

    const newForm = makeScheduleForm({
      userId: 'U002',
      start: '2025-01-01T09:15:00',
      end: '2025-01-01T09:45:00',
    });

    const result = checkScheduleConflicts(newForm, [userSchedule, staffSchedule]);

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts).toHaveLength(2);

    const conflictReasons = result.conflicts.map(c => c.reason);
    expect(conflictReasons).toContain('time_overlap');
    expect(conflictReasons).toContain('staff_unavailable');
  });

  it('handles edge case: exactly same time boundaries', () => {
    const existingSchedule = makeUserSchedule({
      userId: 'U001',
      start: '2025-01-01T09:00:00',
      end: '2025-01-01T10:00:00',
    });

    const newForm = makeScheduleForm({
      userId: 'U002',
      start: '2025-01-01T09:00:00', // 完全に同じ時間
      end: '2025-01-01T10:00:00',
    });

    const result = checkScheduleConflicts(newForm, [existingSchedule]);

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts[0].reason).toBe('time_overlap');
  });

  it('handles edge case: 1-minute overlap', () => {
    const existingSchedule = makeUserSchedule({
      userId: 'U001',
      start: '2025-01-01T09:00:00',
      end: '2025-01-01T10:00:00',
    });

    const newForm = makeScheduleForm({
      userId: 'U002',
      start: '2025-01-01T09:59:00', // 1分だけ重複
      end: '2025-01-01T10:30:00',
    });

    const result = checkScheduleConflicts(newForm, [existingSchedule]);

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts[0].reason).toBe('time_overlap');
  });

  it('handles cross-midnight schedules', () => {
    const existingSchedule = makeUserSchedule({
      userId: 'U001',
      start: '2025-01-01T23:00:00',
      end: '2025-01-02T01:00:00', // 日をまたぐ
    });

    const newForm = makeScheduleForm({
      userId: 'U002',
      start: '2025-01-02T00:30:00', // 翌日の深夜
      end: '2025-01-02T02:00:00',
    });

    const result = checkScheduleConflicts(newForm, [existingSchedule]);

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts[0].reason).toBe('time_overlap');
  });

  it('properly handles timezone information in ISO strings', () => {
    const existingSchedule = makeUserSchedule({
      userId: 'U001',
      start: '2025-01-01T09:00:00+09:00', // JST
      end: '2025-01-01T10:00:00+09:00',
    });

    const newForm = makeScheduleForm({
      userId: 'U002',
      start: '2025-01-01T00:30:00+00:00', // UTC (JST 09:30)
      end: '2025-01-01T01:30:00+00:00',   // UTC (JST 10:30)
    });

    const result = checkScheduleConflicts(newForm, [existingSchedule]);

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts[0].reason).toBe('time_overlap');
  });

  it('performance: handles large number of existing schedules', () => {
    // 大量の予定データを生成
    const existingSchedules: Schedule[] = [];
    for (let i = 0; i < 1000; i++) {
      existingSchedules.push(makeUserSchedule({
        userId: `U${String(i).padStart(3, '0')}`,
        start: `2025-01-01T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00`,
        end: `2025-01-01T${String(Math.floor((i + 30) / 60)).padStart(2, '0')}:${String((i + 30) % 60).padStart(2, '0')}:00`,
      }));
    }

    const newForm = makeScheduleForm({
      userId: 'U999',
      start: '2025-01-01T08:15:00',
      end: '2025-01-01T08:45:00',
    });

    const startTime = performance.now();
    const result = checkScheduleConflicts(newForm, existingSchedules);
    const endTime = performance.now();

    // パフォーマンステスト: 1000件の処理が100ms以内
    expect(endTime - startTime).toBeLessThan(100);
    expect(result.hasConflict).toBe(true); // 重複するはず
  });
});