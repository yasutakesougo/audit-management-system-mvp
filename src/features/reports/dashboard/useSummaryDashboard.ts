import { useDailyRecordRepository } from '@/features/daily/repositoryFactory';
import { useUserRepository } from '@/features/users/repositoryFactory';
import type { IUserMaster } from '@/features/users/types';
import {
    eachDayOfInterval,
    endOfMonth,
    format,
    parseISO,
    startOfMonth
} from 'date-fns';
import { useCallback, useMemo, useState } from 'react';

export interface User {
  id: number;
  userId: string;
  name: string;
  furigana: string;
  attendanceDays: string[];
}

export type DashboardStatus = 'completed' | 'inprogress' | 'missing';

export interface UserStatusRow {
  userId: string;
  userName: string;
  statuses: Record<string, DashboardStatus>; // day (1-31) -> status
}

/**
 * Hook to manage data for the Summary Dashboard
 */
export function useSummaryDashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetMonth, setTargetMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [users, setUsers] = useState<User[]>([]);
  const [statusMatrix, setStatusMatrix] = useState<UserStatusRow[]>([]);

  const userRepository = useUserRepository();
  const dailyRepository = useDailyRecordRepository();

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(parseISO(`${targetMonth}-01`));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end });
  }, [targetMonth]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Users
      const allUsers: IUserMaster[] = await userRepository.getAll();
      const activeUsers = allUsers.filter((u: IUserMaster) => u.IsActive !== false);
      setUsers(activeUsers.map(u => ({
        id: Number(u.Id),
        userId: u.UserID || String(u.Id),
        name: u.FullName || '',
        furigana: u.Furigana || '',
        attendanceDays: u.AttendanceDays || [],
      })) as User[]);

      // 2. Fetch Daily Records for the month
      const start = startOfMonth(parseISO(`${targetMonth}-01`));
      const end = endOfMonth(start);

      const records = await dailyRepository.list({
        range: {
          startDate: format(start, 'yyyy-MM-dd'),
          endDate: format(end, 'yyyy-MM-dd'),
        }
      });

      // 3. Build Matrix
      const matrix: UserStatusRow[] = activeUsers.map((user: IUserMaster) => {
        const userId = user.UserID || String(user.Id);
        const statuses: Record<string, DashboardStatus> = {};

        daysInMonth.forEach(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const day = format(date, 'd');

          const record = records.find(r => r.date === dateStr);
          const userRow = record?.userRows.find(ur => ur.userId === userId);

          if (!userRow) {
            statuses[day] = 'missing';
          } else {
            const hasContent = userRow.amActivity.trim() ||
                             userRow.pmActivity.trim() ||
                             userRow.specialNotes.trim();

            // For now, if it's in the repo, we consider it 'completed'
            // if it has content, or 'inprogress' if it's there but empty.
            // In a real system, we'd check a 'status' field if available.
            statuses[day] = hasContent ? 'completed' : 'inprogress';
          }
        });

        return {
          userId,
          userName: user.FullName || '',
          statuses,
        };
      });

      setStatusMatrix(matrix);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('データの読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [userRepository, dailyRepository, targetMonth, daysInMonth]);

  return {
    targetMonth,
    setTargetMonth,
    loading,
    error,
    users,
    daysInMonth,
    statusMatrix,
    loadData,
  };
}
