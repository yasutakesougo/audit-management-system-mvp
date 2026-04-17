import type { IUserMaster } from '@/features/users/types';
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

/**
 * スケジュールレーンを返す。
 *
 * 以前はハードコードの demo データを生成していたが、本番移行に伴い
 * 空レーンを返すように変更。実データは useTodayScheduleLanes (Today) や
 * 将来の Dashboard 実データ hook から取得する。
 *
 * @param _users - 後方互換のため引数は維持（将来の実データ化時に利用予定）
 */
export function useScheduleLanes(_users: IUserMaster[]) {
  const emptyLanes = useMemo(() => ({
    userLane: [] as ScheduleItem[],
    staffLane: [] as ScheduleItem[],
    organizationLane: [] as ScheduleItem[],
  }), []);

  return {
    scheduleLanesToday: emptyLanes,
    scheduleLanesTomorrow: emptyLanes,
  };
}
