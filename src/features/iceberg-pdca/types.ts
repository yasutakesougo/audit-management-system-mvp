export type IcebergPdcaPhase = 'PLAN' | 'DO' | 'CHECK' | 'ACT';

export interface IcebergPdcaItem {
  id: string;
  userId: string;
  title: string;
  phase: IcebergPdcaPhase;
  summary: string;
  createdAt: string;
  updatedAt: string;
}
