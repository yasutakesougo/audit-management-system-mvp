import type { IUserMaster } from '@/features/users';
import { useUsersDemo } from '@/features/users';
import { useMemo } from 'react';

type AttendanceVisitSnapshot = {
  userCode: string;
  status: string;
  providedMinutes?: number;
  isEarlyLeave?: boolean;
  /** 検温値 (℃) — 37.5以上で発熱アラート */
  temperature?: number;
  /** 欠席者の夕方フォロー完了フラグ */
  eveningChecked?: boolean;
};

type AttendanceStoreState = {
  visits: Record<string, AttendanceVisitSnapshot>;
};

/** デモ用の体温値を生成（ほとんど正常、一部発熱） */
const demoTemperature = (index: number): number => {
  if (index % 11 === 0) return 38.2; // 発熱
  if (index % 13 === 0) return 37.8; // 発熱
  return 36.0 + (index % 10) * 0.1;  // 36.0〜36.9 正常
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
    const isAbsent = status === '当日欠席';

    visits[userCode] = {
      userCode,
      status,
      isEarlyLeave,
      temperature: demoTemperature(index),
      // 欠席者: 偶数indexは夕方フォロー完了、奇数は未完了
      eveningChecked: isAbsent ? index % 2 === 0 : undefined,
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
