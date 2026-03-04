/**
 * SharePoint フィールド定義 — SupportTemplates
 */
import { buildSelectFieldsFromMap } from './fieldUtils';

export const SUPPORT_TEMPLATES_LIST_TITLE = 'SupportTemplates' as const;

/**
 * SupportTemplates リスト用フィールド定義（内部名マップ）
 *
 * 重要: SharePoint で Fields API 取得時、実際の内部名には "0" サフィックスが付与されています
 * - userCode → UserCode0
 * - rowNo → RowNo0
 * - timeSlot → TimeSlot0
 * - activity → Activity0
 * - personManual → PersonManual0
 * - supporterManual → SupporterManual0
 *
 * 使用方法：
 * - コード内では logicalName（左側）を使用
 * - SharePoint API呼び出し時は value（右側）の内部名を使用
 *
 * @example
 * // ✅ 使用パターン
 * const orderby = FIELD_MAP_SUPPORT_TEMPLATES.userCode;
 * // orderby = 'UserCode0' (内部名)
 *
 * // ❌ 非推奨（内部名をハードコード）
 * const orderby = 'userCode'; // これは 500 エラーになる
 */
export const FIELD_MAP_SUPPORT_TEMPLATES = {
  id: 'Id',
  title: 'Title',
  userCode: 'UserCode0',
  rowNo: 'RowNo0',
  timeSlot: 'TimeSlot0',
  activity: 'Activity0',
  personManual: 'PersonManual0',
  supporterManual: 'SupporterManual0',
  created: 'Created',
  modified: 'Modified',
} as const;

export const SUPPORT_TEMPLATES_SELECT_FIELDS = [
  FIELD_MAP_SUPPORT_TEMPLATES.id,
  FIELD_MAP_SUPPORT_TEMPLATES.title,
  FIELD_MAP_SUPPORT_TEMPLATES.userCode,
  FIELD_MAP_SUPPORT_TEMPLATES.rowNo,
  FIELD_MAP_SUPPORT_TEMPLATES.timeSlot,
  FIELD_MAP_SUPPORT_TEMPLATES.activity,
  FIELD_MAP_SUPPORT_TEMPLATES.personManual,
  FIELD_MAP_SUPPORT_TEMPLATES.supporterManual,
  FIELD_MAP_SUPPORT_TEMPLATES.created,
  FIELD_MAP_SUPPORT_TEMPLATES.modified,
] as const;

/**
 * SupportTemplates リスト用の動的 $select ビルダー
 *
 * 重要：このリストの内部名には "0" サフィックスが付与されている
 * (UserCode0, RowNo0, TimeSlot0, Activity0, PersonManual0, SupporterManual0)
 */
export function buildSupportTemplatesSelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(FIELD_MAP_SUPPORT_TEMPLATES, existingInternalNames, {
    alwaysInclude: ['Id', 'Created', 'Modified'],
    fallback: ['Id', 'Created'],
  });
}
