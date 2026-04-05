import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { StoreUser } from '@/stores/useUsers';
import { filterActiveUsers } from '@/features/users/domain/userLifecycle';
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

const userSortCollator = new Intl.Collator('ja-JP');

const toUserSortKey = (user: StoreUser): string => (
  user.Furigana
  ?? user.FullNameKana
  ?? user.FullName
  ?? user.UserID
  ?? ''
).trim().normalize('NFKC');

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
    () => [...filterActiveUsers(users)].sort((a, b) => {
      const kanaDiff = userSortCollator.compare(toUserSortKey(a), toUserSortKey(b));
      if (kanaDiff !== 0) return kanaDiff;
      const nameDiff = userSortCollator.compare((a.FullName ?? '').trim(), (b.FullName ?? '').trim());
      if (nameDiff !== 0) return nameDiff;
      return userSortCollator.compare((a.UserID ?? '').trim(), (b.UserID ?? '').trim());
    }),
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
          Id: user.Id,
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
    const trimmedQuery = searchQuery.trim();
    
    if (!trimmedQuery) {
      return attendanceFilteredUsers;
    }

    const query = trimmedQuery.toLowerCase();
    
    return attendanceFilteredUsers.filter((user) => {
      // Match against multiple fields for better UX
      const matchName = (user.FullName ?? '').toLowerCase().includes(query);
      const matchUserId = (user.UserID ?? '').toLowerCase().includes(query);
      const matchFurigana = (user.Furigana ?? '').toLowerCase().includes(query);
      const matchNameKana = (user.FullNameKana ?? '').toLowerCase().includes(query);

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
