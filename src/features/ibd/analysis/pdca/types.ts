export type IcebergPdcaPhase = 'PLAN' | 'DO' | 'CHECK' | 'ACT';

/**
 * 直近のフェーズ変更トレース（フロントメモリ上のみ）
 * SharePointには保存しない軽量監査情報
 */
export type PhaseChangeTrace = {
  from: IcebergPdcaPhase;
  to: IcebergPdcaPhase;
  at: string;   // ISO timestamp
  by: string;   // 変更者名
};

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
  /** フロントメモリ上のみ — 直近のフェーズ変更トレース */
  lastPhaseChange?: PhaseChangeTrace;
};
