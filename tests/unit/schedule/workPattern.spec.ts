import type { Schedule, ScheduleUserCare } from '@/features/schedule/types';
import {
    buildStaffPatternIndex,
    collectBaseShiftWarnings,
    summarizeBaseShiftWarnings,
} from '@/features/schedule/workPattern';
import type { Staff } from '@/types';
import { describe, expect, it } from 'vitest';

const makeSchedule = (overrides: Partial<ScheduleUserCare> = {}): Schedule => ({
  id: overrides.id ?? 'schedule-1',
  etag: overrides.etag ?? 'W/"demo"',
  category: 'User',
  title: overrides.title ?? '訪問',
  start: overrides.start ?? '2025-04-01T09:00:00Z',
  end: overrides.end ?? '2025-04-01T11:00:00Z',
  allDay: overrides.allDay ?? false,
  status: overrides.status ?? '承認済み',
  serviceType: overrides.serviceType ?? '一時ケア',
  personType: overrides.personType ?? 'Internal',
  personId: overrides.personId ?? '201',
  personName: overrides.personName ?? '山田 太郎',
  staffIds: overrides.staffIds ?? ['101', '102'],
  staffNames: overrides.staffNames ?? ['佐藤 花子', '鈴木 次郎'],
  recurrenceRule: overrides.recurrenceRule,
  location: overrides.location,
  notes: overrides.notes,
}) as Schedule;

describe('workPattern helpers', () => {
  describe('summarizeBaseShiftWarnings', () => {
    it('joins staff labels into an advisory sentence', () => {
      const summary = summarizeBaseShiftWarnings([
        { staffId: '101', staffName: '佐藤 花子', reasons: ['day'] },
        { staffId: '102', staffName: '鈴木 次郎', reasons: ['time'] },
      ]);
      expect(summary).toBe('佐藤 花子、鈴木 次郎のシフトに注意が必要です');
    });

    it('returns empty string when no meaningful labels exist', () => {
      expect(summarizeBaseShiftWarnings([])).toBe('');
      expect(summarizeBaseShiftWarnings([{ staffId: '', reasons: ['day'] }])).toBe('');
    });

    it('falls back to staffId when names are missing', () => {
      const summary = summarizeBaseShiftWarnings([
        { staffId: '201', staffName: undefined, reasons: ['day'] },
        { staffId: '202', staffName: undefined, reasons: ['time'] },
      ]);
      expect(summary).toBe('201、202のシフトに注意が必要です');
    });
  });

  describe('collectBaseShiftWarnings', () => {
    it('returns missing staff warnings when index lacks entries', () => {
      const schedule = makeSchedule({ staffIds: ['999'] });
      const warnings = collectBaseShiftWarnings(schedule, {});
      expect(warnings).toEqual([
        {
          staffId: '999',
          staffName: undefined,
          reasons: ['day'],
        },
      ]);
    });

    it('returns empty list when all staff are indexed', () => {
      const schedule = makeSchedule({ staffIds: ['101'] });
      const index = buildStaffPatternIndex([
        { id: 1, staffId: '101', name: '佐藤 花子', certifications: [], workDays: [], baseWorkingDays: [] },
      ] as Staff[]);
      expect(collectBaseShiftWarnings(schedule, index)).toEqual([]);
    });

    it('returns empty list when index is absent or schedule has no staffIds array', () => {
      const minimalSchedule = { id: 'sched-0' } as unknown as Schedule;
      expect(collectBaseShiftWarnings(minimalSchedule, null)).toEqual([]);
      expect(collectBaseShiftWarnings(minimalSchedule, undefined)).toEqual([]);
    });

    it('ignores falsy staff entries within staffIds array', () => {
      const schedule = makeSchedule({ staffIds: ['101', '', undefined as unknown as string] });
      const warnings = collectBaseShiftWarnings(schedule, {});
      expect(warnings).toEqual([
        { staffId: '101', staffName: undefined, reasons: ['day'] },
      ]);
    });
  });

  describe('buildStaffPatternIndex', () => {
    it('maps staff members by staffId while preserving metadata', () => {
      const staff: Staff[] = [
        {
          id: 1,
          staffId: '201',
          name: '高橋 三郎',
          certifications: ['介護福祉士'],
          workDays: ['月', '水'],
          baseWorkingDays: ['月', '火', '水', '木', '金'],
        },
      ];
      const index = buildStaffPatternIndex(staff);
      expect(index).toMatchObject({
        201: {
          staffId: '201',
          staffName: '高橋 三郎',
          workDays: ['月', '水'],
          baseWorkingDays: ['月', '火', '水', '木', '金'],
        },
      });
    });

    it('returns null when staff collection is empty or missing', () => {
      expect(buildStaffPatternIndex([])).toBeNull();
      expect(buildStaffPatternIndex(null)).toBeNull();
      expect(buildStaffPatternIndex(undefined)).toBeNull();
    });

    it('skips staff entries without usable identifiers and falls back to id when staffId missing', () => {
      const staff: Staff[] = [
        { id: 5, staffId: undefined as unknown as string, name: 'Fallback Id', certifications: [], workDays: [], baseWorkingDays: [] },
        { id: undefined as unknown as number, staffId: undefined as unknown as string, name: 'No Key', certifications: [], workDays: [], baseWorkingDays: [] },
      ];
      const index = buildStaffPatternIndex(staff);
      expect(index).not.toBeNull();
      const keys = Object.keys(index!);
      expect(keys).toContain('5');
      expect(keys).not.toContain('');
    });
  });
});
