import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { User } from '@/types';
import { filterActiveUsers } from '@/features/users/domain/userLifecycle';
import { isUserScheduledForDate } from '@/utils/attendanceUtils';

export type StoreUser = User & {
  Id?: number;
  UserID?: string | null;
  FullName?: string | null;
  Furigana?: string | null;
  FullNameKana?: string | null;
  AttendanceDays?: string[] | null;
  UsageStatus?: string | null;
  IsActive?: boolean | null;
  ServiceEndDate?: string | null;
};

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
  filteredUsers: StoreUser[];
  attendanceFilteredUsers: StoreUser[];
  filters: TableDailyRecordFilters;
};

/**
 * Parameters for filtering hook
 */
type UseTableDailyRecordFilteringParams = {
  users: StoreUser[];
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
        : user.attendanceDays;
      
      // Fail-safe: Users without attendance data are always shown
      if (!attendanceDays || !Array.isArray(attendanceDays) || attendanceDays.length === 0) {
        return true;
      }

      return isUserScheduledForDate(
        {
          Id: user.Id ?? (typeof user.id === 'number' ? user.id : 0),
          UserID: user.UserID ?? user.userId ?? '',
          FullName: user.FullName ?? user.name ?? '',
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
      const matchName = (user.FullName ?? user.name ?? '').toLowerCase().includes(query);
      const matchUserId = (user.UserID ?? user.userId ?? '').toLowerCase().includes(query);
      const matchFurigana = (user.Furigana ?? user.furigana ?? '').toLowerCase().includes(query);
      const matchNameKana = (user.FullNameKana ?? user.nameKana ?? '').toLowerCase().includes(query);

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
