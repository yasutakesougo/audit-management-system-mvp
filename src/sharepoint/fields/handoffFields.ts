/**
 * SharePoint フィールド定義 — Handoff
 */
import { buildSelectFieldsFromMap } from './fieldUtils';

/**
 * Handoff リスト用の FIELD_MAP（HANDOFF_TIMELINE_COLUMNS から抽出）
 */
export const FIELD_MAP_HANDOFF = {
  id: 'Id',
  title: 'Title',
  message: 'Message',
  userCode: 'UserCode',
  userDisplayName: 'UserDisplayName',
  category: 'Category',
  severity: 'Severity',
  status: 'Status',
  timeBand: 'TimeBand',
  meetingSessionKey: 'MeetingSessionKey',
  sourceType: 'SourceType',
  sourceId: 'SourceId',
  sourceUrl: 'SourceUrl',
  sourceKey: 'SourceKey',
  sourceLabel: 'SourceLabel',
  createdBy: 'CreatedBy',
  createdAt: 'CreatedAt',
  modifiedBy: 'ModifiedBy',
  modifiedAt: 'ModifiedAt',
  created: 'Created',
  modified: 'Modified',
} as const;

/**
 * Handoff リスト用の動的 $select ビルダー
 */
export function buildHandoffSelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(FIELD_MAP_HANDOFF, existingInternalNames, {
    alwaysInclude: ['Id', 'Title', 'Created', 'Modified'],
    fallback: ['Id', 'Title', 'Message', 'UserCode', 'Created'],
  });
}
