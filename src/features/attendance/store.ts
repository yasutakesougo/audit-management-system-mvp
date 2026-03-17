import type { IUserMaster } from '@/features/users';
import { useUsers } from '@/features/users';
import { useMemo } from 'react';
import type { TransportMethod } from './transportMethod';

type AttendanceVisitSnapshot = {
  userCode: string;
  status: string;
  providedMinutes?: number;
  isEarlyLeave?: boolean;
  /** 検温値 (℃) — 37.5以上で発熱アラート */
  temperature?: number;
  /** 欠席者の朝連絡受け入れ完了フラグ */
  morningContacted?: boolean;
  /** 欠席者の夕方フォロー完了フラグ */
  eveningChecked?: boolean;
  /** 行き送迎手段（SS / 一時ケア / その他） */
  transportToMethod?: TransportMethod;
  /** 帰り送迎手段 */
  transportFromMethod?: TransportMethod;
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

/** デモ用の送迎手段: 一部のユーザーに SS / 一時ケアを設定 */
const demoTransport = (index: number): { to?: TransportMethod; from?: TransportMethod } => {
  if (index % 17 === 0) return { to: 'short_stay', from: 'short_stay' };
  if (index % 19 === 0) return { to: 'temporary_care' };
  return {};
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
    const transport = demoTransport(index);

    visits[userCode] = {
      userCode,
      status,
      isEarlyLeave,
      temperature: demoTemperature(index),
      morningContacted: isAbsent ? index % 3 !== 0 : undefined,
      eveningChecked: isAbsent ? index % 2 === 0 : undefined,
      transportToMethod: transport.to,
      transportFromMethod: transport.from,
    };
  });

  return visits;
};

export const useAttendanceStore = (): AttendanceStoreState => {
  const { data: users } = useUsers();

  const visits = useMemo(() => buildDemoVisits(users), [users]);

  return {
    visits,
  };
};
