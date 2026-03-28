import { useMemo } from 'react';
import type { StoreUser } from '@/stores/useUsers';
import { filterActiveUsers } from '@/features/users/domain/userLifecycle';
import { isUserScheduledForDate } from '@/utils/attendanceUtils';

/**
 * Filtering result
 */
export type TableDailyRecordFilteringResult = {
  filteredUsers: StoreUser[];
  attendanceFilteredUsers: StoreUser[];
};

/**
 * Parameters for filtering hook
 */
type UseTableDailyRecordFilteringParams = {
  users: StoreUser[];
  targetDate: Date;
  searchQuery?: string;
  showTodayOnly?: boolean;
};

/**
 * Custom hook for filtering daily record users
 * 
 * Responsibilities:
 * - Filter users by attendance (showTodayOnly)
 * - Filter users by search query (name, userId, furigana)
 * - Provide memoized filtered user lists
 * 
 * Business Logic:
 * - When showTodayOnly is true, only show users scheduled for target date
 * - Users without attendance data are always shown (fail-safe)
 * - Search matches against name, userId, furigana, nameKana
 * 
 * @param params - Users list and target date
 * @returns Filtered users and filter controls
 */
export const useTableDailyRecordFiltering = ({
  users,
  targetDate,
  searchQuery = '',
  showTodayOnly = true,
}: UseTableDailyRecordFilteringParams): TableDailyRecordFilteringResult => {
  const candidateUsers = useMemo(
    () => filterActiveUsers(users),
    [users],
  );

  // Step 1: Filter by attendance (scheduled for target date)
  const attendanceFilteredUsers = useMemo(() => {
    if (!showTodayOnly) {
      return candidateUsers;
    }

    return candidateUsers.filter((user) => {
      const attendanceDays = Array.isArray(user.AttendanceDays)
        ? user.AttendanceDays
        : Array.isArray((user as any).attendanceDays)
        ? (user as any).attendanceDays
        : [];
      
      // Fail-safe: Users without attendance data are always shown
      if (!attendanceDays || !Array.isArray(attendanceDays) || attendanceDays.length === 0) {
        return true;
      }

      return isUserScheduledForDate(
        {
          Id: Math.max(0, user.Id ?? (user as any).id ?? 0),
          UserID: user.UserID ?? (user as any).userId ?? '',
          FullName: user.FullName ?? (user as any).name ?? '',
          AttendanceDays: attendanceDays,
        },
        targetDate,
      );
    });
  }, [candidateUsers, showTodayOnly, targetDate]);

  // Step 2: Filter by search query
  const filteredUsers = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    
    if (!trimmedQuery) {
      return attendanceFilteredUsers;
    }

    const query = trimmedQuery.toLowerCase();
    
    return attendanceFilteredUsers.filter((user) => {
      // Match against multiple fields for better UX
      const matchName = (user.FullName ?? (user as any).name ?? '').toLowerCase().includes(query);
      const matchUserId = (user.UserID ?? (user as any).userId ?? '').toLowerCase().includes(query);
      const matchFurigana = (user.Furigana ?? (user as any).furigana ?? '').toLowerCase().includes(query);
      const matchNameKana = (user.FullNameKana ?? (user as any).nameKana ?? '').toLowerCase().includes(query);

      return matchName || matchUserId || matchFurigana || matchNameKana;
    });
  }, [attendanceFilteredUsers, searchQuery]);

  return {
    filteredUsers,
    attendanceFilteredUsers,
  };
};
