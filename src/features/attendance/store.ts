import { useUsersDemo } from '@/features/users/usersStoreDemo';
import type { IUserMaster } from '@/features/users/types';
import { useMemo } from 'react';

type AttendanceVisitSnapshot = {
  userCode: string;
  status: string;
  providedMinutes?: number;
  isEarlyLeave?: boolean;
};

type AttendanceStoreState = {
  visits: Record<string, AttendanceVisitSnapshot>;
};

const buildDemoVisits = (users: IUserMaster[]): Record<string, AttendanceVisitSnapshot> => {
  const visits: Record<string, AttendanceVisitSnapshot> = {};

  users.forEach((user, index) => {
    const userCode = (user.UserID ?? '').trim() || `U${String(user.Id ?? index + 1).padStart(3, '0')}`;
    const status = index % 6 === 0
      ? '当日欠席'
      : index % 3 === 0
        ? '退所済'
        : '通所中';
    const isEarlyLeave = status !== '当日欠席' && index % 7 === 0;

    visits[userCode] = {
      userCode,
      status,
      isEarlyLeave,
    };
  });

  return visits;
};

export const useAttendanceStore = (): AttendanceStoreState => {
  const { data: users } = useUsersDemo();

  const visits = useMemo(() => buildDemoVisits(users), [users]);

  return {
    visits,
  };
};
