/**
 * ServiceProvisionRecords ドメイン型
 *
 * 利用者×日付のサービス提供実績を表す。
 * EntryKey（UserCode|RecordDate）で同日1件 upsert を制御。
 */

export type ServiceProvisionStatus = '提供' | '欠席' | 'その他';

export type ProvisionSource = 'Unified' | 'Daily' | 'Attendance' | 'Import';

/**
 * EntryKey 生成関数（全層で共有）
 * @example makeEntryKey('I022', '2026-02-27') → 'I022|2026-02-27'
 */
export const makeEntryKey = (userCode: string, recordDateISO: string): string =>
  `${userCode}|${recordDateISO}`;

export interface ServiceProvisionRecord {
  id: number;
  etag?: string;

  entryKey: string;       // `${userCode}|${recordDateISO}`
  userCode: string;       // 例: I022
  recordDateISO: string;  // YYYY-MM-DD（B層で統一）
  status: ServiceProvisionStatus;

  startHHMM?: number | null;
  endHHMM?: number | null;

  hasTransport?: boolean;
  hasTransportPickup?: boolean;   // 往（迎え）
  hasTransportDropoff?: boolean;  // 復（送り）
  hasMeal?: boolean;
  hasBath?: boolean;
  hasExtended?: boolean;
  hasAbsentSupport?: boolean;

  note?: string;
  source?: ProvisionSource;

  updatedByUPN?: string;
}

export interface UpsertProvisionInput {
  userCode: string;
  recordDateISO: string; // YYYY-MM-DD
  status: ServiceProvisionStatus;

  startHHMM?: number | null;
  endHHMM?: number | null;

  hasTransport?: boolean;
  hasTransportPickup?: boolean;   // 往（迎え）
  hasTransportDropoff?: boolean;  // 復（送り）
  hasMeal?: boolean;
  hasBath?: boolean;
  hasExtended?: boolean;
  hasAbsentSupport?: boolean;

  note?: string;
  source?: ProvisionSource;
  updatedByUPN?: string;
}
