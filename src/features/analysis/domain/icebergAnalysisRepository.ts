import type { IcebergAnalysisRecord, IcebergAnalysisStatus } from './icebergAnalysisRecord';

export type IcebergAnalysisListQuery = {
  userId?: string;
};

export type SaveIcebergAnalysisInput = {
  /** SharePoint item ID — undefined for new records */
  id?: string;
  userId: string;
  title: string;
  snapshotJSON: string;
  entryHash: string;
  status?: IcebergAnalysisStatus;
  etag?: string;
};

export interface IcebergAnalysisRepository {
  list(query: IcebergAnalysisListQuery): Promise<IcebergAnalysisRecord[]>;
  save(input: SaveIcebergAnalysisInput): Promise<IcebergAnalysisRecord>;
}
