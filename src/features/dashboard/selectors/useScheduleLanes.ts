import type { IUserMaster } from '@/sharepoint/fields';
import { useMemo } from 'react';

export type OpsFlowStep =
  | 'intake'
  | 'temperature'
  | 'amRecord'
  | 'lunchCheck'
  | 'pmRecord'
  | 'discharge';

/**
 * 業務フローの順序定数
 * 同時刻時のソート第二キーとして使用
 */
export const OPS_FLOW_ORDER: Record<OpsFlowStep, number> = {
  intake: 0,
  temperature: 1,
  amRecord: 2,
  lunchCheck: 3,
  pmRecord: 4,
  discharge: 5,
};

export type ScheduleItem = {
  id: string;
  time: string;
  title: string;
  location?: string;
  owner?: string;
  opsStep?: OpsFlowStep;
};

export function useScheduleLanes(users: IUserMaster[]) {
  const [scheduleLanesToday, scheduleLanesTomorrow] = useMemo<[
    { userLane: ScheduleItem[]; staffLane: ScheduleItem[]; organizationLane: ScheduleItem[] },
    { userLane: ScheduleItem[]; staffLane: ScheduleItem[]; organizationLane: ScheduleItem[] },
  ]>(() => {
    const baseUserLane = users.slice(0, 3).map((user, index) => ({
      id: `user-${index}`,
      time: `${(9 + index).toString().padStart(2, '0')}:00`,
      title: `${user.FullName ?? `利用者${index + 1}`} ${['作業プログラム', '個別支援', 'リハビリ'][index % 3]}`,
      location: ['作業室A', '相談室1', '療育室'][index % 3],
    }));

    // 利用者オペレーション業務フロー（6ステップ）
    const baseStaffLane: ScheduleItem[] = [
      { id: 'ops-1', time: '09:15', title: '通所受け入れ',       owner: '受付',   opsStep: 'intake' as OpsFlowStep },
      { id: 'ops-2', time: '09:30', title: '検温・バイタル確認', owner: '看護',   opsStep: 'temperature' as OpsFlowStep },
      { id: 'ops-3', time: '10:00', title: '午前の過ごし記録',   owner: '支援員', opsStep: 'amRecord' as OpsFlowStep },
      { id: 'ops-4', time: '12:00', title: '昼食量確認',         owner: '栄養士', opsStep: 'lunchCheck' as OpsFlowStep },
      { id: 'ops-5', time: '13:30', title: '午後の過ごし記録',   owner: '支援員', opsStep: 'pmRecord' as OpsFlowStep },
      { id: 'ops-6', time: '16:00', title: '退所対応',           owner: '受付',   opsStep: 'discharge' as OpsFlowStep },
    ];

    const baseOrganizationLane: ScheduleItem[] = [
      { id: 'org-1', time: '10:00', title: '自治体監査ヒアリング', owner: '法人本部' },
      { id: 'org-2', time: '13:30', title: '家族向け連絡会資料確認', owner: '連携推進室' },
      { id: 'org-3', time: '16:00', title: '設備点検結果共有', owner: '施設管理' },
    ];

    const todayLanes = {
      userLane: baseUserLane,
      staffLane: baseStaffLane,
      organizationLane: baseOrganizationLane,
    };

    const tomorrowLanes = {
      userLane: baseUserLane,
      staffLane: baseStaffLane,
      organizationLane: baseOrganizationLane,
    };

    return [todayLanes, tomorrowLanes];
  }, [users]);

  return {
    scheduleLanesToday,
    scheduleLanesTomorrow,
  };
}
