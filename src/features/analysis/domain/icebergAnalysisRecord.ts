/**
 * SharePoint 行に対応する永続化ドメイン型
 * List: Iceberg_Analysis
 */
export type IcebergAnalysisStatus = 'Draft' | 'Final';

export type IcebergAnalysisRecord = {
  id: string;
  userId: string;
  title: string;
  snapshotJSON: string;
  version: number;
  entryHash: string;
  status: IcebergAnalysisStatus;
  createdAt: string;
  updatedAt: string;
};
