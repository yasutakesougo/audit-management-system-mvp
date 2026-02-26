import type { IUserMaster } from '@/sharepoint/fields';
import { useMemo } from 'react';

export type ScheduleItem = {
  id: string;
  time: string;
  title: string;
  location?: string;
  owner?: string;
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
    const baseStaffLane = [
      { id: 'staff-1', time: '08:45', title: '職員朝会 / 申し送り確認', owner: '生活支援課' },
      { id: 'staff-2', time: '11:30', title: '通所記録レビュー', owner: '管理責任者' },
      { id: 'staff-3', time: '15:30', title: '支援手順フィードバック会議', owner: '専門職チーム' },
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
