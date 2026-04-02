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
 * 0. Handoff リストのフィールド候補
 */
export const HANDOFF_CANDIDATES = {
  message:    ['Message', 'message', 'cr013_message', 'Body'],
  userCode:   ['UserCode', 'userCode', 'cr013_userCode', 'UserID', 'cr013_usercode'],
  category:   ['Category', 'category', 'cr013_category', 'HandoffCategory'],
  severity:   ['Severity', 'severity', 'cr013_severity'],
  status:     ['Status', 'status', 'cr013_status'],
  timeBand:   ['TimeBand', 'timeBand', 'cr013_timeBand'],
  sourceType: ['SourceType', 'sourceType', 'cr013_sourceType'],
  sourceKey:  ['SourceKey', 'sourceKey', 'cr013_sourceKey'],
} as const;

export const HANDOFF_ESSENTIALS: (keyof typeof HANDOFF_CANDIDATES)[] = [
  'message', 'userCode', 'category'
];

/**
 * Handoff リスト用の動的 $select ビルダー
 */
export function buildHandoffSelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(FIELD_MAP_HANDOFF, existingInternalNames, {
    alwaysInclude: ['Id', 'Title', 'Created', 'Modified'],
    fallback: ['Id', 'Title', 'Message', 'UserCode', 'Created'],
  });
}
