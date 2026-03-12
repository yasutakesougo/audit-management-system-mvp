import type { IcebergPdcaItem, IcebergPdcaPhase } from './pdca';

export type CreatePdcaInput = {
  userId: string;
  /** 紐づく支援計画シートID（optional: 旧データ互換） */
  planningSheetId?: string;
  title: string;
  summary?: string;
  phase?: IcebergPdcaPhase;
};

export type UpdatePdcaInput = {
  id: string;
  title?: string;
  summary?: string;
  phase?: IcebergPdcaPhase;
  etag?: string;
  userId?: string;
  /** 紐づく支援計画シートID */
  planningSheetId?: string;
};

export type DeletePdcaInput = {
  id: string;
  etag?: string;
};

export type PdcaListQuery = {
  userId?: string;
  /** 支援計画シートでフィルタ */
  planningSheetId?: string;
};

export interface PdcaRepository {
  list(query: PdcaListQuery): Promise<IcebergPdcaItem[]>;
  create(input: CreatePdcaInput): Promise<IcebergPdcaItem>;
  update(input: UpdatePdcaInput): Promise<IcebergPdcaItem>;
  delete(input: DeletePdcaInput): Promise<void>;
}
