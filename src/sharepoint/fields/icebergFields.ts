/**
 * SharePoint フィールド定義 — Iceberg_Analysis / Iceberg_PDCA
 */
import { buildSelectFieldsFromMap } from './fieldUtils';

/**
 * Iceberg_Analysis リスト用フィールド定義（内部名）
 * JSON ペイロードに IcebergSnapshot 全体を格納するリスト
 */
export const FIELD_MAP_ICEBERG_ANALYSIS = {
  id: 'Id',
  title: 'Title',
  entryHash: 'EntryHash',
  sessionId: 'SessionId',
  userId: 'UserId',
  payloadJson: 'PayloadJson',
  schemaVersion: 'SchemaVersion',
  updatedAt: 'UpdatedAt',
} as const;

export const FIELD_MAP_ICEBERG_PDCA = {
  id: 'Id',
  userId: 'UserID0',
  planningSheetId: 'PlanningSheetId',
  title: 'Title',
  summary: 'Summary0',
  phase: 'Phase0',
  createdAt: 'Created',
  updatedAt: 'Modified',
} as const;

/**
 * planningSheetId の Schema Drift 吸収候補。
 * 既存テナント差分（suffix / 表記揺れ）を許容する。
 */
export const ICEBERG_PDCA_PLANNING_SHEET_FIELD_CANDIDATES = [
  FIELD_MAP_ICEBERG_PDCA.planningSheetId,
  'PlanningSheetID',
  'PlanningSheetId0',
  'PlanningSheetID0',
  'PlanningSheetLookupId',
  'SupportPlanningSheetId',
  'SupportPlanningSheetID',
] as const;

export const ICEBERG_PDCA_SELECT_FIELDS = [
  FIELD_MAP_ICEBERG_PDCA.id,
  FIELD_MAP_ICEBERG_PDCA.userId,
  FIELD_MAP_ICEBERG_PDCA.planningSheetId,
  FIELD_MAP_ICEBERG_PDCA.title,
  FIELD_MAP_ICEBERG_PDCA.summary,
  FIELD_MAP_ICEBERG_PDCA.phase,
  FIELD_MAP_ICEBERG_PDCA.createdAt,
  FIELD_MAP_ICEBERG_PDCA.updatedAt,
] as const;

/**
 * Iceberg PDCA リスト用の動的 $select ビルダー
 */
export function buildIcebergPdcaSelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(FIELD_MAP_ICEBERG_PDCA, existingInternalNames, {
    alwaysInclude: ['Id', 'Created', 'Modified'],
    fallback: ['Id', 'Created'],
  });
}
