import { useMemo } from 'react';
import { StoreUser } from '../view-models/tableDailyRecordFormTypes';
import { filterActiveUsers } from '@/features/users/domain/userLifecycle';
import { isUserScheduledForDate } from '@/utils/attendanceUtils';
import { compareUsersByJapaneseOrder, userMatchesQuery } from '@/lib/i18n/japaneseCollator';

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
 * Custom hook for filtering daily record users (Orchestrator version)
 * 
 * Responsibilities:
 * - Filter users by attendance (showTodayOnly)
 * - Filter users by search query (name, userId, furigana)
 * - Provide memoized filtered user lists
 * 
 * @param params - Users list and target date
 * @returns Filtered users lists
 */
export const useTableDailyRecordFiltering = ({
  users,
  targetDate,
  searchQuery = '',
  showTodayOnly = true,
}: UseTableDailyRecordFilteringParams): TableDailyRecordFilteringResult => {
  const candidateUsers = useMemo(
    () => [...filterActiveUsers(users)].sort(compareUsersByJapaneseOrder),
    [users],
  );

  // Step 1: Filter by attendance (scheduled for target date)
  const attendanceFilteredUsers = useMemo(() => {
    if (!showTodayOnly) {
      return candidateUsers;
    }

    return candidateUsers.filter((user) => {
      const attendanceDays = user.AttendanceDays;
      
      // Fail-safe: Users without attendance data are always shown
      if (!attendanceDays || !Array.isArray(attendanceDays) || attendanceDays.length === 0) {
        return true;
      }

      return isUserScheduledForDate(
        {
          Id: user.Id ?? 0,
          UserID: user.UserID ?? '',
          FullName: user.FullName ?? '',
          AttendanceDays: attendanceDays,
        },
        targetDate,
      );
    });
  }, [candidateUsers, showTodayOnly, targetDate]);

  // Step 2: Filter by search query
  const filteredUsers = useMemo(() => {
    return attendanceFilteredUsers.filter((user) => userMatchesQuery(user, searchQuery));
  }, [attendanceFilteredUsers, searchQuery]);

  return {
    filteredUsers,
    attendanceFilteredUsers,
  };
};
