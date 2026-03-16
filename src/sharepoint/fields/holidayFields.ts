/**
 * SharePoint フィールド定義 — Holiday_Master
 *
 * 福祉事業所の祝日・休業日管理。
 * 年度ごとに管理し、営業日計算・請求計算で参照する。
 *
 * 監査 P0-5 追加
 */

export const HOLIDAY_MASTER_LIST_TITLE = 'Holiday_Master' as const;

export const HOLIDAY_MASTER_FIELDS = {
  id: 'Id',
  title: 'Title',           // 表示名 (例: 元日)
  date: 'Date',             // ISO 日付 (YYYY-MM-DD)
  label: 'Label',           // 祝日名
  type: 'Type',             // Choice: national | company | special
  fiscalYear: 'FiscalYear', // 年度 (e.g. '2026')
  isActive: 'IsActive',     // 有効フラグ
  created: 'Created',
  modified: 'Modified',
} as const;

export const HOLIDAY_MASTER_SELECT_FIELDS = [
  HOLIDAY_MASTER_FIELDS.id,
  HOLIDAY_MASTER_FIELDS.title,
  HOLIDAY_MASTER_FIELDS.date,
  HOLIDAY_MASTER_FIELDS.label,
  HOLIDAY_MASTER_FIELDS.type,
  HOLIDAY_MASTER_FIELDS.fiscalYear,
  HOLIDAY_MASTER_FIELDS.isActive,
] as const;
