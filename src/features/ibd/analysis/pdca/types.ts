export type IcebergPdcaPhase = 'PLAN' | 'DO' | 'CHECK' | 'ACT';

export type IcebergPdcaItem = {
  id: string;
  userId: string;
  title: string;
  summary: string;
  phase: IcebergPdcaPhase;
  createdAt: string;
  updatedAt: string;
};
