import { result, type Result } from '@/shared/result';
import type { StaffAttendance, RecordDate } from '../types';
import type { StaffAttendancePort, AttendanceCounts } from '../port';
import { useStaffAttendanceStore } from '../store';

/**
 * Parse key in format "{YYYY-MM-DD}#{STAFF_ID}" to (date, staffId)
 */
const parseKey = (key: string): { date: RecordDate; staffId: string } | null => {
  const [date, staffId] = key.split('#');
  if (!date || !staffId) return null;
  return { date: date as RecordDate, staffId };
};

/**
 * Local Storage Adapter for StaffAttendancePort
 * Phase 3.1-A: Wraps existing in-memory store
 * Phase 3.1-B: Will be replaced by SharePoint adapter
 */
export const createLocalStorageAdapter = (): StaffAttendancePort => ({
  async upsert(a: StaffAttendance): Promise<Result<void>> {
    try {
      const store = useStaffAttendanceStore();
      store.upsert(a);
      return result.ok(undefined);
    } catch (e) {
      return result.unknown('Failed to upsert attendance', e);
    }
  },

  async remove(key: string): Promise<Result<void>> {
    try {
      const parsed = parseKey(key);
      if (!parsed) {
        return result.validation('Invalid key format. Expected "{YYYY-MM-DD}#{STAFF_ID}"');
      }
      const store = useStaffAttendanceStore();
      store.remove(parsed.date, parsed.staffId);
      return result.ok(undefined);
    } catch (e) {
      return result.unknown('Failed to remove attendance', e);
    }
  },

  async getByKey(key: string): Promise<Result<StaffAttendance | null>> {
    try {
      const parsed = parseKey(key);
      if (!parsed) {
        return result.validation('Invalid key format. Expected "{YYYY-MM-DD}#{STAFF_ID}"');
      }
      const store = useStaffAttendanceStore();
      const record = store.get(parsed.date, parsed.staffId);
      return result.ok(record ?? null);
    } catch (e) {
      return result.unknown('Failed to get attendance', e);
    }
  },

  async listByDate(date: string): Promise<Result<StaffAttendance[]>> {
    try {
      const store = useStaffAttendanceStore();
      const records = store.listByDate(date as RecordDate);
      return result.ok(records);
    } catch (e) {
      return result.unknown('Failed to list attendance', e);
    }
  },

  async countByDate(date: string): Promise<Result<AttendanceCounts>> {
    try {
      const store = useStaffAttendanceStore();
      const counts = store.countByDate(date as RecordDate);
      return result.ok(counts);
    } catch (e) {
      return result.unknown('Failed to count attendance', e);
    }
  },
});

/**
 * Singleton instance
 */
export const localStorageStaffAttendanceAdapter = createLocalStorageAdapter();
