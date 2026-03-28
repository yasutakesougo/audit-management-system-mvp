<<<<<<< HEAD:src/features/daily/hooks/orchestrators/useTableDailyRecordFiltering.ts
import { useMemo } from 'react';
import type { User } from '@/types';
=======
import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { StoreUser } from '@/stores/useUsers';
>>>>>>> origin/main:src/features/daily/hooks/useTableDailyRecordFiltering.ts
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
 * Filtering result
 */
export type TableDailyRecordFilteringResult = {
  filteredUsers: StoreUser[];
  attendanceFilteredUsers: StoreUser[];
<<<<<<< HEAD:src/features/daily/hooks/orchestrators/useTableDailyRecordFiltering.ts
=======
  filters: TableDailyRecordFilters;
>>>>>>> origin/main:src/features/daily/hooks/useTableDailyRecordFiltering.ts
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
<<<<<<< HEAD:src/features/daily/hooks/orchestrators/useTableDailyRecordFiltering.ts
=======
  const [showTodayOnly, setShowTodayOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
>>>>>>> origin/main:src/features/daily/hooks/useTableDailyRecordFiltering.ts
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
<<<<<<< HEAD:src/features/daily/hooks/orchestrators/useTableDailyRecordFiltering.ts
      const attendanceDays = Array.isArray(user.AttendanceDays)
        ? user.AttendanceDays
        : user.attendanceDays;
=======
      const attendanceDays = user.AttendanceDays;
>>>>>>> origin/main:src/features/daily/hooks/useTableDailyRecordFiltering.ts
      
      // Fail-safe: Users without attendance data are always shown
      if (!attendanceDays || !Array.isArray(attendanceDays) || attendanceDays.length === 0) {
        return true;
      }

      return isUserScheduledForDate(
        {
<<<<<<< HEAD:src/features/daily/hooks/orchestrators/useTableDailyRecordFiltering.ts
          Id: user.Id ?? (typeof user.id === 'number' ? user.id : 0),
          UserID: user.UserID ?? user.userId ?? '',
          FullName: user.FullName ?? user.name ?? '',
=======
          Id: user.Id,
          UserID: user.UserID ?? '',
          FullName: user.FullName ?? '',
>>>>>>> origin/main:src/features/daily/hooks/useTableDailyRecordFiltering.ts
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
<<<<<<< HEAD:src/features/daily/hooks/orchestrators/useTableDailyRecordFiltering.ts
      const matchName = (user.FullName ?? user.name ?? '').toLowerCase().includes(query);
      const matchUserId = (user.UserID ?? user.userId ?? '').toLowerCase().includes(query);
      const matchFurigana = (user.Furigana ?? user.furigana ?? '').toLowerCase().includes(query);
      const matchNameKana = (user.FullNameKana ?? user.nameKana ?? '').toLowerCase().includes(query);
=======
      const matchName = (user.FullName ?? '').toLowerCase().includes(query);
      const matchUserId = (user.UserID ?? '').toLowerCase().includes(query);
      const matchFurigana = (user.Furigana ?? '').toLowerCase().includes(query);
      const matchNameKana = (user.FullNameKana ?? '').toLowerCase().includes(query);
>>>>>>> origin/main:src/features/daily/hooks/useTableDailyRecordFiltering.ts

      return matchName || matchUserId || matchFurigana || matchNameKana;
    });
  }, [attendanceFilteredUsers, searchQuery]);

  return {
    filteredUsers,
    attendanceFilteredUsers,
  };
};
