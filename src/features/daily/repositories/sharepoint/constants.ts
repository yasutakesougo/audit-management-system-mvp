import { get as getEnv } from '@/env';

/**
 * SharePoint field names for daily records (Parent)
 */
export const DAILY_RECORD_FIELDS = {
  title: 'Title',              // YYYY-MM-DD
  recordDate: 'RecordDate',    // Date type
  reporterName: 'ReporterName', // Text
  reporterRole: 'ReporterRole', // Text
  userRowsJSON: 'UserRowsJSON', // Multi-line text (DEPRECATED fallback)
  userCount: 'UserCount',       // Number
  latestVersion: 'LatestVersion', // Atomic version control
  isDeleted: 'IsDeleted',       // Logical delete support
  created: 'Created',
  modified: 'Modified',
} as const;

/**
 * SharePoint field names for daily records (Child Rows)
 */
export const DAILY_RECORD_ROWS_FIELDS = {
  parentId: 'ParentID',
  userId: 'UserID',
  version: 'Version',           // Matches Parent's LatestVersion
  status: 'Status',
  payload: 'Payload',
  recordedAt: 'RecordedAt',
} as const;

export type SharePointResponse<T> = {
  value?: T[];
};

export type SharePointFieldItem = {
  InternalName?: string;
};

export type RowAggregateSource = {
  listPath: string;
  listTitle: string;
  dateField: string;
  selectFields: string[];
};

export interface SharePointItem {
  Id: number;
  Title?: string;
  RecordDate?: string;
  ReporterName?: string;
  ReporterRole?: string;
  UserRowsJSON?: string;
  UserCount?: number;
  LatestVersion?: number;
  IsDeleted?: boolean;
  Created?: string;
  Modified?: string;
  __metadata?: {
    etag?: string;
  };
}

export const readNonEmptyEnv = (key: string): string | undefined => {
  const value = getEnv(key, '').trim();
  return value.length > 0 ? value : undefined;
};

export const getListTitle = (): string => {
  return (
    readNonEmptyEnv('VITE_SP_DAILY_RECORDS_LIST') ??
    readNonEmptyEnv('VITE_SP_LIST_DAILY') ??
    'SupportRecord_Daily'
  );
};
