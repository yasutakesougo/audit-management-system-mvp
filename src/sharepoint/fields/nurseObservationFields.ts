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
