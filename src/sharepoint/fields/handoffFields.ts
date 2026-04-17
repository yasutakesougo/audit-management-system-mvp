/**
 * SharePoint フィールド定義 — Handoff
 *
 * Phase 2a pilot: FIELD_MAP_HANDOFF を defineFieldMap で branded 化。
 * 動的解決ゼロの安全な pilot として選定（project_sp_query_next_steps 参照）。
 */
import { buildSelectFieldsFromMap, defineFieldMap } from './fieldUtils';

/**
 * Handoff リスト用の FIELD_MAP（HANDOFF_TIMELINE_COLUMNS から抽出）
 *
 * Phase 2a: defineFieldMap により各値が `SpFieldName` 型を帯びる。
 * 呼出し側は無変更（`FIELD_MAP_HANDOFF.userCode` の利用方法は従来通り）。
 */
export const FIELD_MAP_HANDOFF = defineFieldMap({
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
});

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
