import type { IcebergPdcaItem } from './pdca';

export type PdcaListQuery = {
  userId?: string;
};

export interface PdcaRepository {
  list(query: PdcaListQuery): Promise<IcebergPdcaItem[]>;
}
