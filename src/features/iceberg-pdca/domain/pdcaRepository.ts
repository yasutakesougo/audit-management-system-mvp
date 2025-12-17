import type { IcebergPdcaItem, IcebergPdcaPhase } from './pdca';

export type CreatePdcaInput = {
  userId: string;
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
};

export type PdcaListQuery = {
  userId?: string;
};

export interface PdcaRepository {
  list(query: PdcaListQuery): Promise<IcebergPdcaItem[]>;
  create(input: CreatePdcaInput): Promise<IcebergPdcaItem>;
  update(input: UpdatePdcaInput): Promise<IcebergPdcaItem>;
}
