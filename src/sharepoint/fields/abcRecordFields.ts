/**
 * SharePoint フィールド定義 — ABC記録（AbcBehaviorRecords）
 */
import { buildSelectFieldsFromMap, defineFieldMap } from './fieldUtils';

/**
 * AbcBehaviorRecords リスト用の FIELD_MAP
 * ドメインモデルの属性（キャメルケース）と、SharePointリストの物理列名（パスカルケースなど）の対応を定義。
 */
export const FIELD_MAP_ABC_RECORD = defineFieldMap({
  id: 'Id',
  abcRecordId: 'AbcRecordId',
  userId: 'UserId',
  recordDate: 'RecordDate',
  occurredAt: 'OccurredAt',
  setting: 'Setting',
  antecedent: 'Antecedent',
  behavior: 'Behavior',
  consequence: 'Consequence',
  intensity: 'Intensity',
  durationMinutes: 'DurationMinutes',
  riskFlag: 'RiskFlag',
  tagsJson: 'TagsJson',
  notes: 'Notes',
  sourcePage: 'SourcePage',
  sourceDate: 'SourceDate',
  sourceSlotId: 'SourceSlotId',
  sourceSlotLabel: 'SourceSlotLabel',
  returnUrl: 'ReturnUrl',
  recorderName: 'RecorderName',
  createdByCode: 'CreatedByCode',
  updatedByCode: 'UpdatedByCode',
  createdAt: 'CreatedAt',
  updatedAt: 'UpdatedAt',
  isDeleted: 'IsDeleted',
  deletedAt: 'DeletedAt',
  deletedByCode: 'DeletedByCode',
  created: 'Created',     // SharePointシステム標準
  modified: 'Modified',   // SharePointシステム標準
});

/**
 * AbcBehaviorRecords リストの Schema Drift 候補（揺れ吸収）
 */
export const ABC_RECORD_CANDIDATES = {
  abcRecordId: ['AbcRecordId', 'abcRecordId', 'cr013_abcRecordId'],
  userId:      ['UserId', 'userId', 'cr013_userId', 'UserID'],
  recordDate:  ['RecordDate', 'recordDate', 'cr013_recordDate'],
} as const;

export const ABC_RECORD_ESSENTIALS: (keyof typeof ABC_RECORD_CANDIDATES)[] = [
  'abcRecordId', 'userId', 'recordDate'
];

/**
 * AbcBehaviorRecords リスト用の動的 $select ビルダー
 */
export function buildAbcRecordSelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(FIELD_MAP_ABC_RECORD, existingInternalNames, {
    alwaysInclude: ['Id', 'CreatedAt', 'Created', 'Modified'],
    fallback: [
      'Id',
      'AbcRecordId',
      'UserId',
      'RecordDate',
      'OccurredAt',
      'Antecedent',
      'Behavior',
      'Consequence',
      'Intensity',
      'IsDeleted',
      'CreatedAt',
    ],
  });
}
