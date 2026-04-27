/**
 * SharePoint フィールド定義 — NurseObservations
 *
 * 看護観察記録リスト。バイタルサイン・食事量・排泄・特記事項を記録。
 * オフラインキュー + IdempotencyKey による冪等性 upsert 対応。
 *
 * 監査 P1-3 追加
 *
 * @see src/features/nurse/sp/map.ts — ObservationListItem 型
 */

export const NURSE_OBSERVATIONS_LIST_TITLE = 'NurseObservations' as const;

export const NURSE_OBSERVATIONS_FIELDS = {
  id: 'Id',
  title: 'Title',
  userLookupId: 'UserLookupId',    // Lookup ID → Users_Master
  observedAt: 'ObservedAt',         // ISO datetime
  temperature: 'Temperature',       // number (℃)
  pulse: 'Pulse',                   // number (bpm)
  systolic: 'Systolic',             // number (mmHg) 収縮期血圧
  diastolic: 'Diastolic',           // number (mmHg) 拡張期血圧
  spo2: 'SpO2',                     // number (%)
  weight: 'Weight',                 // number (kg)
  memo: 'Memo',                     // text
  tags: 'Tags',                     // text (comma-separated)
  idempotencyKey: 'IdempotencyKey', // text (upsert 冪等キー)
  source: 'Source',                 // text (app | offline-sync)
  localTimeZone: 'LocalTimeZone',   // text (e.g. 'Asia/Tokyo')
  createdBy: 'CreatedBy',           // text (UPN)
  deviceId: 'DeviceId',             // text
  vitalsJson: 'VitalsJson',         // text (JSON payload)
  created: 'Created',
  modified: 'Modified',
} as const;

export const NURSE_OBSERVATIONS_SELECT_FIELDS = [
  NURSE_OBSERVATIONS_FIELDS.id,
  NURSE_OBSERVATIONS_FIELDS.title,
  NURSE_OBSERVATIONS_FIELDS.userLookupId,
  NURSE_OBSERVATIONS_FIELDS.observedAt,
  NURSE_OBSERVATIONS_FIELDS.temperature,
  NURSE_OBSERVATIONS_FIELDS.pulse,
  NURSE_OBSERVATIONS_FIELDS.systolic,
  NURSE_OBSERVATIONS_FIELDS.diastolic,
  NURSE_OBSERVATIONS_FIELDS.spo2,
  NURSE_OBSERVATIONS_FIELDS.weight,
  NURSE_OBSERVATIONS_FIELDS.memo,
  NURSE_OBSERVATIONS_FIELDS.tags,
  NURSE_OBSERVATIONS_FIELDS.idempotencyKey,
  NURSE_OBSERVATIONS_FIELDS.source,
  NURSE_OBSERVATIONS_FIELDS.vitalsJson,
  NURSE_OBSERVATIONS_FIELDS.created,
  NURSE_OBSERVATIONS_FIELDS.modified,
] as const;

import type { SpFieldDef } from '@/lib/sp/types';

/**
 * NurseObservations フィールド候補 (環境差異吸収用)
 */
export const NURSE_OBS_CANDIDATES = {
  temperature: ['Temperature', 'Temp', 'BodyTemperature', 'BodyTemp'],
  observedAt: ['ObservedAt', 'ObsDate', 'RecordDate', 'Created'],
  userLookupId: ['UserLookupId', 'UserLookup', 'User_LookupId', 'UserId', 'cr013_usercode'],
  pulse: ['Pulse'],
  spo2: ['SpO2', 'SPO2', 'SpO20', '_x0053_pO2'],
  systolic: ['Systolic', 'Systolic0', 'Systolic_x0020_BP'],
  diastolic: ['Diastolic', 'Distolic', 'Diastolic0', 'Diastolic_x0020_BP'],
  weight: ['Weight'],
  memo: ['Memo', 'Notes', 'Note'],
  tags: ['Tags'],
  idempotencyKey: ['IdempotencyKey'],
} as const;

export const NURSE_OBS_ESSENTIALS: (keyof typeof NURSE_OBS_CANDIDATES)[] = [
  'observedAt', 'userLookupId', 'temperature'
];

/**
 * 自動プロビジョニング用フィールド定義 (ensureListExists 用)
 */
export const NURSE_OBSERVATIONS_ENSURE_FIELDS: SpFieldDef[] = [
  { internalName: 'UserLookupId', type: 'Number', displayName: 'User Lookup ID', required: true },
  { internalName: 'ObservedAt', type: 'DateTime', displayName: 'Observed At', required: true, dateTimeFormat: 'DateTime' },
  { internalName: 'Temperature', type: 'Number', displayName: 'Temperature', required: true },
  { internalName: 'Pulse', type: 'Number', displayName: 'Pulse' },
  { internalName: 'Systolic', type: 'Number', displayName: 'Systolic BP' },
  { internalName: 'Diastolic', type: 'Number', displayName: 'Diastolic BP' },
  { internalName: 'SpO2', type: 'Number', displayName: 'SpO2' },
  { internalName: 'Weight', type: 'Number', displayName: 'Weight' },
  { internalName: 'Memo', type: 'Note', displayName: 'Memo' },
  { internalName: 'Tags', type: 'Text', displayName: 'Tags' },
  { internalName: 'IdempotencyKey', type: 'Text', displayName: 'Idempotency Key' },
  { internalName: 'Source', type: 'Text', displayName: 'Source' },
  { internalName: 'LocalTimeZone', type: 'Text', displayName: 'Local Time Zone' },
  { internalName: 'CreatedBy', type: 'Text', displayName: 'Created By' },
  { internalName: 'DeviceId', type: 'Text', displayName: 'Device ID' },
  { internalName: 'VitalsJson', type: 'Note', displayName: 'Vitals JSON' },
];
