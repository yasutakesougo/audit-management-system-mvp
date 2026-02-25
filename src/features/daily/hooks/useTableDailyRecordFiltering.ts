import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { User } from '@/types';
import { isUserScheduledForDate } from '@/utils/attendanceUtils';

/**
 * Filtering configuration
 */
export type TableDailyRecordFilters = {
  showTodayOnly: boolean;
  setShowTodayOnly: Dispatch<SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
};

/**
 * Filtering result
 */
export type TableDailyRecordFilteringResult = {
  filteredUsers: User[];
  attendanceFilteredUsers: User[];
  filters: TableDailyRecordFilters;
};

/**
 * Parameters for filtering hook
 */
type UseTableDailyRecordFilteringParams = {
  users: User[];
  targetDate: Date;
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
}: UseTableDailyRecordFilteringParams): TableDailyRecordFilteringResult => {
  const [showTodayOnly, setShowTodayOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Step 1: Filter by attendance (scheduled for target date)
  const attendanceFilteredUsers = useMemo(() => {
    if (!showTodayOnly) {
      return users;
    }

    return users.filter((user) => {
      const attendanceDays = user.attendanceDays;
      
      // Fail-safe: Users without attendance data are always shown
      if (!attendanceDays || !Array.isArray(attendanceDays) || attendanceDays.length === 0) {
        return true;
      }

      return isUserScheduledForDate(
        {
          Id: user.id,
          UserID: user.userId,
          FullName: user.name || '',
          AttendanceDays: attendanceDays,
        },
        targetDate,
      );
    });
  }, [users, showTodayOnly, targetDate]);

  // Step 2: Filter by search query
  const filteredUsers = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    
    if (!trimmedQuery) {
      return attendanceFilteredUsers;
    }

    const query = trimmedQuery.toLowerCase();
    
    return attendanceFilteredUsers.filter((user) => {
      // Match against multiple fields for better UX
      const matchName = user.name?.toLowerCase().includes(query);
      const matchUserId = user.userId?.toLowerCase().includes(query);
      const matchFurigana = user.furigana?.toLowerCase().includes(query);
      const matchNameKana = user.nameKana?.toLowerCase().includes(query);

      return matchName || matchUserId || matchFurigana || matchNameKana;
    });
  }, [attendanceFilteredUsers, searchQuery]);

  return {
    filteredUsers,
    attendanceFilteredUsers,
    filters: {
      showTodayOnly,
      setShowTodayOnly,
      searchQuery,
      setSearchQuery,
    },
  };
};
