/**
 * SharePoint フィールド定義 — トイレ記録（ToiletRecords）
 */
import { buildSelectFieldsFromMap, defineFieldMap } from './fieldUtils';

/**
 * ToiletRecords リスト用の FIELD_MAP
 * ドメインモデルの属性（キャメルケース）と、SharePointリストの物理列名（パスカルケースなど）の対応を定義。
 */
export const FIELD_MAP_TOILET_RECORD = defineFieldMap({
  id: 'Title',
  userId: 'UserId',
  recordDate: 'RecordDate',
  occurredAt: 'OccurredAt',
  toiletType: 'ToiletType',
  amount: 'Amount',
  memo: 'Memo',
  recorderName: 'RecorderName',
  source: 'Source',
  isDeleted: 'IsDeleted',
  created: 'Created',     // SharePointシステム標準
  modified: 'Modified',   // SharePointシステム標準
});

/**
 * ToiletRecords リストの Schema Drift 候補（揺れ吸収）
 */
export const TOILET_RECORD_CANDIDATES = {
  userId: ['UserId', 'UserID'],
  recordDate: ['RecordDate'],
} as const;

export const TOILET_RECORD_ESSENTIALS: (keyof typeof TOILET_RECORD_CANDIDATES)[] = [
  'userId', 'recordDate'
];

/**
 * ToiletRecords リスト用の動的 $select ビルダー
 */
export function buildToiletRecordSelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(FIELD_MAP_TOILET_RECORD, existingInternalNames, {
    alwaysInclude: ['Id', 'Title', 'Created', 'Modified'],
    fallback: [
      'Id',
      'Title',
      'UserId',
      'RecordDate',
      'OccurredAt',
      'ToiletType',
      'Amount',
      'Memo',
      'RecorderName',
      'Source',
      'IsDeleted',
      'Created',
    ],
  });
}
