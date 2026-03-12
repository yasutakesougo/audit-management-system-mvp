export type IcebergPdcaPhase = 'PLAN' | 'DO' | 'CHECK' | 'ACT';

export type IcebergPdcaItem = {
  id: string;
  userId: string;
  /** 紐づく支援計画シートID（optional: 旧データ互換） */
  planningSheetId?: string;
  title: string;
  summary: string;
  phase: IcebergPdcaPhase;
  createdAt: string;
  updatedAt: string;
};
