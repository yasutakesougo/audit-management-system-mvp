/**
 * useDashboardSummary Contract Tests
 *
 * Purpose: Ensure the hook maintains its API contract
 * - Returns correct shape (all keys present)
 * - Handles empty/minimal data gracefully
 * - Does not throw on valid inputs
 *
 * Note: These are contract tests, not exhaustive business logic tests.
 * Detailed logic testing belongs in component/integration tests.
 */

import type { PersonDaily } from '@/domain/daily/types';
import type { AttendanceCounts } from '@/features/staff/attendance/port';
import type { IUserMaster } from '@/sharepoint/fields';
import type { Staff } from '@/types';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDashboardSummary } from '../useDashboardSummary';

// ============================================================================
// Test Fixtures (Minimal valid data)
// ============================================================================

export interface UseDashboardSummaryArgs {
  users: IUserMaster[];
  staff: Staff[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visits: Record<string, any>;
  today: string;
  currentMonth: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generateMockActivityRecords: any;
  attendanceCounts: AttendanceCounts;
}

const createMinimalUser = (overrides?: Partial<IUserMaster>): IUserMaster => ({
  Id: 1,
  UserID: 'U001',
  FullName: 'Test User',
  IsSupportProcedureTarget: false,
  ...overrides,
});

const createMinimalPersonDaily = (overrides?: Partial<PersonDaily>): PersonDaily => ({
  id: 1,
  personId: 'U001',
  personName: 'Test User',
  date: '2026-02-23',
  status: '完了',
  reporter: { name: 'Staff A' },
  draft: { isDraft: false },
  kind: 'A',
  data: {
    amActivities: [],
    pmActivities: [],
    amNotes: '',
    pmNotes: '',
    mealAmount: '完食',
    problemBehavior: {
      selfHarm: false,
      violence: false,
      loudVoice: false,
      pica: false,
      other: false,
    },
    seizureRecord: {
      occurred: false,
    },
    specialNotes: '',
  },
  ...overrides,
});

const createMinimalStaff = (overrides?: Partial<Staff>): Staff => ({
  staffId: 'S001',
  name: 'Staff Member',
  ...overrides,
} as Staff);

const createMinimalAttendanceCounts = (
  overrides?: Partial<AttendanceCounts>
): AttendanceCounts => ({
  onDuty: 0,
  out: 0,
  absent: 0,
  total: 0,
  ...overrides,
});

const mockGenerateMockActivityRecords = (users: IUserMaster[], _today: string): PersonDaily[] => {
  return users.map((user, index) => createMinimalPersonDaily({
    id: index + 1,
    personId: user.UserID,
    personName: user.FullName,
  }));
};

// ============================================================================
// Contract Tests
// ============================================================================

describe('useDashboardSummary', () => {
  describe('API Contract', () => {
    it('returns all required keys in the result object', () => {
      const args: UseDashboardSummaryArgs = {
        users: [createMinimalUser()],
        today: '2026-02-23',
        currentMonth: '2026-02',
        visits: {},
        staff: [createMinimalStaff()],
        attendanceCounts: createMinimalAttendanceCounts(),
        generateMockActivityRecords: mockGenerateMockActivityRecords,
      };

      const { result } = renderHook(() => useDashboardSummary(args.users, args.staff, args.visits, args.today, args.currentMonth, args.generateMockActivityRecords, args.attendanceCounts, { state: 'idle' } as unknown as import('../types/hub').HubSyncStatus));

      // Verify all expected keys exist
      expect(result.current).toHaveProperty('activityRecords');
      expect(result.current).toHaveProperty('usageMap');
      expect(result.current).toHaveProperty('stats');
      expect(result.current).toHaveProperty('attendanceSummary');
      expect(result.current).toHaveProperty('dailyRecordStatus');
      expect(result.current).toHaveProperty('scheduleLanesToday');
      expect(result.current).toHaveProperty('scheduleLanesTomorrow');
      expect(result.current).toHaveProperty('prioritizedUsers');
      expect(result.current).toHaveProperty('intensiveSupportUsers');
    });

    it('returns correct types for each key', () => {
      const args: UseDashboardSummaryArgs = {
        users: [createMinimalUser()],
        today: '2026-02-23',
        currentMonth: '2026-02',
        visits: {},
        staff: [createMinimalStaff()],
        attendanceCounts: createMinimalAttendanceCounts(),
        generateMockActivityRecords: mockGenerateMockActivityRecords,
      };

      const { result } = renderHook(() => useDashboardSummary(args.users, args.staff, args.visits, args.today, args.currentMonth, args.generateMockActivityRecords, args.attendanceCounts, { state: 'idle' } as unknown as import('../types/hub').HubSyncStatus));

      // Type checks
      expect(Array.isArray(result.current.activityRecords)).toBe(true);
      expect(typeof result.current.usageMap).toBe('object');
      expect(typeof result.current.stats).toBe('object');
      expect(typeof result.current.attendanceSummary).toBe('object');
      expect(typeof result.current.dailyRecordStatus).toBe('object');
      expect(typeof result.current.scheduleLanesToday).toBe('object');
      expect(typeof result.current.scheduleLanesTomorrow).toBe('object');
      expect(Array.isArray(result.current.prioritizedUsers)).toBe(true);
      expect(Array.isArray(result.current.intensiveSupportUsers)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty users array without throwing', () => {
      const args: UseDashboardSummaryArgs = {
        users: [],
        today: '2026-02-23',
        currentMonth: '2026-02',
        visits: {},
        staff: [],
        attendanceCounts: createMinimalAttendanceCounts(),
        generateMockActivityRecords: mockGenerateMockActivityRecords,
      };

      const { result } = renderHook(() => useDashboardSummary(args.users, args.staff, args.visits, args.today, args.currentMonth, args.generateMockActivityRecords, args.attendanceCounts, { state: 'idle' } as unknown as import('../types/hub').HubSyncStatus));

      expect(result.current.activityRecords).toEqual([]);
      expect(result.current.intensiveSupportUsers).toEqual([]);
      expect(result.current.prioritizedUsers).toEqual([]);
      expect(result.current.stats.totalUsers).toBe(0);
    });

    it('handles minimal valid data', () => {
      const args: UseDashboardSummaryArgs = {
        users: [createMinimalUser()],
        today: '2026-02-23',
        currentMonth: '2026-02',
        visits: {},
        staff: [createMinimalStaff()],
        attendanceCounts: createMinimalAttendanceCounts({ onDuty: 1 }),
        generateMockActivityRecords: mockGenerateMockActivityRecords,
      };

      const { result } = renderHook(() => useDashboardSummary(args.users, args.staff, args.visits, args.today, args.currentMonth, args.generateMockActivityRecords, args.attendanceCounts, { state: 'idle' } as unknown as import('../types/hub').HubSyncStatus));

      // Should not throw
      expect(result.current.activityRecords.length).toBe(1);
      expect(result.current.stats.totalUsers).toBe(1);
    });
  });

  describe('Stats Shape Contract', () => {
    it('stats object has required properties', () => {
      const args: UseDashboardSummaryArgs = {
        users: [createMinimalUser()],
        today: '2026-02-23',
        currentMonth: '2026-02',
        visits: {},
        staff: [createMinimalStaff()],
        attendanceCounts: createMinimalAttendanceCounts(),
        generateMockActivityRecords: mockGenerateMockActivityRecords,
      };

      const { result } = renderHook(() => useDashboardSummary(args.users, args.staff, args.visits, args.today, args.currentMonth, args.generateMockActivityRecords, args.attendanceCounts, { state: 'idle' } as unknown as import('../types/hub').HubSyncStatus));

      expect(result.current.stats).toHaveProperty('totalUsers');
      expect(result.current.stats).toHaveProperty('recordedUsers');
      expect(result.current.stats).toHaveProperty('completionRate');
      expect(result.current.stats).toHaveProperty('problemBehaviorStats');
      expect(result.current.stats).toHaveProperty('seizureCount');
      expect(result.current.stats).toHaveProperty('lunchStats');
    });
  });

  describe('Attendance Summary Shape Contract', () => {
    it('attendanceSummary object has required properties', () => {
      const args: UseDashboardSummaryArgs = {
        users: [createMinimalUser()],
        today: '2026-02-23',
        currentMonth: '2026-02',
        visits: {},
        staff: [createMinimalStaff()],
        attendanceCounts: createMinimalAttendanceCounts(),
        generateMockActivityRecords: mockGenerateMockActivityRecords,
      };

      const { result } = renderHook(() => useDashboardSummary(args.users, args.staff, args.visits, args.today, args.currentMonth, args.generateMockActivityRecords, args.attendanceCounts, { state: 'idle' } as unknown as import('../types/hub').HubSyncStatus));

      expect(result.current.attendanceSummary).toHaveProperty('facilityAttendees');
      expect(result.current.attendanceSummary).toHaveProperty('lateOrEarlyLeave');
      expect(result.current.attendanceSummary).toHaveProperty('lateOrEarlyNames');
      expect(result.current.attendanceSummary).toHaveProperty('absenceCount');
      expect(result.current.attendanceSummary).toHaveProperty('absenceNames');
      expect(result.current.attendanceSummary).toHaveProperty('onDutyStaff');
      expect(result.current.attendanceSummary).toHaveProperty('lateOrShiftAdjust');
      expect(result.current.attendanceSummary).toHaveProperty('outStaff');
      expect(result.current.attendanceSummary).toHaveProperty('outStaffNames');
    });
  });

  describe('Daily Record Status Shape Contract', () => {
    it('dailyRecordStatus object has required properties', () => {
      const args: UseDashboardSummaryArgs = {
        users: [createMinimalUser()],
        today: '2026-02-23',
        currentMonth: '2026-02',
        visits: {},
        staff: [createMinimalStaff()],
        attendanceCounts: createMinimalAttendanceCounts(),
        generateMockActivityRecords: mockGenerateMockActivityRecords,
      };

      const { result } = renderHook(() => useDashboardSummary(args.users, args.staff, args.visits, args.today, args.currentMonth, args.generateMockActivityRecords, args.attendanceCounts, { state: 'idle' } as unknown as import('../types/hub').HubSyncStatus));

      expect(result.current.dailyRecordStatus).toHaveProperty('total');
      expect(result.current.dailyRecordStatus).toHaveProperty('pending');
      expect(result.current.dailyRecordStatus).toHaveProperty('inProgress');
      expect(result.current.dailyRecordStatus).toHaveProperty('completed');
    });
  });

  describe('Schedule Lanes Shape Contract', () => {
    it('scheduleLanesToday has required structure', () => {
      const args: UseDashboardSummaryArgs = {
        users: [createMinimalUser()],
        today: '2026-02-23',
        currentMonth: '2026-02',
        visits: {},
        staff: [createMinimalStaff()],
        attendanceCounts: createMinimalAttendanceCounts(),
        generateMockActivityRecords: mockGenerateMockActivityRecords,
      };

      const { result } = renderHook(() => useDashboardSummary(args.users, args.staff, args.visits, args.today, args.currentMonth, args.generateMockActivityRecords, args.attendanceCounts, { state: 'idle' } as unknown as import('../types/hub').HubSyncStatus));

      expect(result.current.scheduleLanesToday).toHaveProperty('userLane');
      expect(result.current.scheduleLanesToday).toHaveProperty('staffLane');
      expect(result.current.scheduleLanesToday).toHaveProperty('organizationLane');
      expect(Array.isArray(result.current.scheduleLanesToday.userLane)).toBe(true);
      expect(Array.isArray(result.current.scheduleLanesToday.staffLane)).toBe(true);
      expect(Array.isArray(result.current.scheduleLanesToday.organizationLane)).toBe(true);
    });

    it('scheduleLanesTomorrow has required structure', () => {
      const args: UseDashboardSummaryArgs = {
        users: [createMinimalUser()],
        today: '2026-02-23',
        currentMonth: '2026-02',
        visits: {},
        staff: [createMinimalStaff()],
        attendanceCounts: createMinimalAttendanceCounts(),
        generateMockActivityRecords: mockGenerateMockActivityRecords,
      };

      const { result } = renderHook(() => useDashboardSummary(args.users, args.staff, args.visits, args.today, args.currentMonth, args.generateMockActivityRecords, args.attendanceCounts, { state: 'idle' } as unknown as import('../types/hub').HubSyncStatus));

      expect(result.current.scheduleLanesTomorrow).toHaveProperty('userLane');
      expect(result.current.scheduleLanesTomorrow).toHaveProperty('staffLane');
      expect(result.current.scheduleLanesTomorrow).toHaveProperty('organizationLane');
      expect(Array.isArray(result.current.scheduleLanesTomorrow.userLane)).toBe(true);
      expect(Array.isArray(result.current.scheduleLanesTomorrow.staffLane)).toBe(true);
      expect(Array.isArray(result.current.scheduleLanesTomorrow.organizationLane)).toBe(true);
    });
  });

  describe('Intensive Support Users', () => {
    it('filters intensive support users correctly', () => {
      const args: UseDashboardSummaryArgs = {
        users: [
          createMinimalUser({ Id: 1, UserID: 'U001', IsSupportProcedureTarget: true }),
          createMinimalUser({ Id: 2, UserID: 'U002', IsSupportProcedureTarget: false }),
          createMinimalUser({ Id: 3, UserID: 'U003', IsSupportProcedureTarget: true }),
        ],
        today: '2026-02-23',
        currentMonth: '2026-02',
        visits: {},
        staff: [createMinimalStaff()],
        attendanceCounts: createMinimalAttendanceCounts(),
        generateMockActivityRecords: mockGenerateMockActivityRecords,
      };

      const { result } = renderHook(() => useDashboardSummary(args.users, args.staff, args.visits, args.today, args.currentMonth, args.generateMockActivityRecords, args.attendanceCounts, { state: 'idle' } as unknown as import('../types/hub').HubSyncStatus));

      expect(result.current.intensiveSupportUsers.length).toBe(2);
      expect(result.current.intensiveSupportUsers.every(u => u.IsSupportProcedureTarget)).toBe(true);
    });

    it('returns top 3 prioritized users', () => {
      const args: UseDashboardSummaryArgs = {
        users: [
          createMinimalUser({ Id: 1, UserID: 'U001', IsSupportProcedureTarget: true }),
          createMinimalUser({ Id: 2, UserID: 'U002', IsSupportProcedureTarget: true }),
          createMinimalUser({ Id: 3, UserID: 'U003', IsSupportProcedureTarget: true }),
          createMinimalUser({ Id: 4, UserID: 'U004', IsSupportProcedureTarget: true }),
        ],
        today: '2026-02-23',
        currentMonth: '2026-02',
        visits: {},
        staff: [createMinimalStaff()],
        attendanceCounts: createMinimalAttendanceCounts(),
        generateMockActivityRecords: mockGenerateMockActivityRecords,
      };

      const { result } = renderHook(() => useDashboardSummary(args.users, args.staff, args.visits, args.today, args.currentMonth, args.generateMockActivityRecords, args.attendanceCounts, { state: 'idle' } as unknown as import('../types/hub').HubSyncStatus));

      expect(result.current.prioritizedUsers.length).toBe(3);
      expect(result.current.intensiveSupportUsers.length).toBe(4);
    });
  });
});
