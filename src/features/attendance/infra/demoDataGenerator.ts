import type { AttendanceDailyItem } from './Legacy/attendanceDailyRepository';
import type { AttendanceUserItem } from './Legacy/attendanceUsersRepository';
import type { TransportMethod } from '../transportMethod';

/**
 * デモ用の体温値を生成（ほとんど正常、一部発熱）
 */
export const generateDemoTemperature = (index: number): number => {
  if (index % 11 === 0) return 38.2; // 発熱
  if (index % 13 === 0) return 37.8; // 発熱
  return 36.0 + (index % 10) * 0.1;  // 36.0〜36.9 正常
};

/**
 * デモ用の送迎手段
 */
export const generateDemoTransport = (index: number): { to?: TransportMethod; from?: TransportMethod } => {
  if (index % 17 === 0) return { to: 'short_stay', from: 'short_stay' };
  if (index % 19 === 0) return { to: 'temporary_care' };
  return {};
};

/**
 * デモ用の出欠記録一覧を生成
 */
export const generateSyntheticDailyItems = (
  users: AttendanceUserItem[],
  date: string
): AttendanceDailyItem[] => {
  return users.map((user, index) => {
    const status = index % 6 === 0
      ? '当日欠席'
      : index % 3 === 0
        ? '退所済'
        : '通所中';
    
    const isAbsent = status === '当日欠席';
    const transport = generateDemoTransport(index);

    return {
      Key: `${date}-${user.UserCode}`,
      UserCode: user.UserCode,
      RecordDate: date,
      Status: status,
      IsEarlyLeave: status !== '当日欠席' && index % 7 === 0,
      TransportToMethod: transport.to,
      TransportFromMethod: transport.from,
      AbsentMorningContacted: isAbsent ? index % 3 !== 0 : undefined,
      EveningChecked: isAbsent ? index % 2 === 0 : undefined,
      ProvidedMinutes: isAbsent ? 0 : 360,
    };
  });
};
