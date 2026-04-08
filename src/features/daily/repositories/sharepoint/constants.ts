import { get as getEnv } from '@/env';

/**
 * SharePoint field names for daily records (Parent)
 */
export const DAILY_RECORD_FIELDS = {
  title: 'Title',              // YYYY-MM-DD
  recordDate: 'RecordDate',    // Date type
  reporterName: 'ReporterName', // Text
  reporterRole: 'ReporterRole', // Text
  userRowsJSON: 'User_x0020_Rows_x0020_JSON', // Multi-line text (DEPRECATED fallback)
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
  parentId: 'Parent_x0020_ID',
  userId: 'User_x0020_ID',
  version: 'Version',           // Matches Parent's LatestVersion
  status: 'Status',
  payload: 'Payload',
  recordedAt: 'Recorded_x0020_At',
} as const;

/**
 * SharePoint field names for granular execution records (19 rows)
 */
export const EXECUTION_RECORD_FIELDS = {
  title: 'Title',                 // Composite Key: date-userId-slotId
  rowKey: 'RowKey',               // Indexed Search Key: DailyKey-RowNo
  parentId: 'Parent_x0020_ID',    // Lookup to SupportRecord_Daily
  userId: 'User_x0020_ID',
  rowNo: 'RowNo',                 // Slot ID / Sequence
  status: 'Status',
  memo: 'Memo',
  recordedAt: 'Recorded_x0020_At',
  staffName: 'StaffName',
  bipsJSON: 'BipsJSON',           // JSON string for BIP IDs
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

/**
 * Raw item as it comes directly from SharePoint response.
 * Uses physical internal names.
 */
export interface RawSharePointItem {
  Id: number;
  Title?: string;
  RecordDate?: string;
  ReporterName?: string;
  ReporterRole?: string;
  User_x0020_Rows_x0020_JSON?: string; // Physical name
  UserCount?: number;
  LatestVersion?: number;
  IsDeleted?: boolean;
  Created?: string;
  Modified?: string;
  __metadata?: {
    etag?: string;
  };
}

/**
 * Normalized item used within the repository layer.
 * Uses human-readable logical names.
 */
export interface SharePointItem {
  Id: number;
  Title?: string;
  RecordDate?: string;
  ReporterName?: string;
  ReporterRole?: string;
  UserRowsJSON?: string; // Logical name
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

export const getRowsListTitle = (): string => {
  return (
    readNonEmptyEnv('VITE_SP_LIST_DAILY_ROWS') ??
    'SupportRecord_DailyRows'
  );
};

