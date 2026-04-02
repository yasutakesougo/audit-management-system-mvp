/**
 * SharePoint フィールド定義 — Billing Orders (List3 on /sites/2/)
 */
import { readOptionalEnv } from '@/lib/env';

/**
 * BillingOrders リストの GUID
 *
 * ⚠️ 環境変数 VITE_SP_LIST_BILLING_ORDERS に実際の GUID を設定してください。
 * 未設定の場合、プレースホルダー値が使用されます（本番では 404 エラー）。
 */
export const BILLING_ORDERS_LIST_ID: string =
  readOptionalEnv('VITE_SP_LIST_BILLING_ORDERS') ||
  '00000000-0000-0000-0000-000000000003';

export const FIELD_MAP_BILLING_ORDERS = {
  id: 'Id',
  orderDate: 'Title',
  ordererCode: 'OrdererCode',
  ordererName: 'OrdererName',
  orderCount: 'OrderCount',
  served: 'Served',
  item: 'Item',
  sugar: 'Sugar',
  milk: 'Milk',
  drinkPrice: 'DrinkPrice',
} as const;

/**
 * BillingOrders (コーヒー注文) のドリフト耐性定義
 */
export const BILLING_ORDERS_CANDIDATES = {
  id: ['Id', 'ID'],
  orderDate: ['Title', 'OrderDate', 'cr013_orderDate'],
  ordererCode: ['OrdererCode', 'cr013_ordererCode'],
  ordererName: ['OrdererName', 'cr013_ordererName'],
  orderCount: ['OrderCount', 'cr013_orderCount'],
  served: ['Served', 'cr013_served'],
  item: ['Item', 'cr013_item'],
  sugar: ['Sugar', 'cr013_sugar'],
  milk: ['Milk', 'cr013_milk'],
  drinkPrice: ['DrinkPrice', 'cr013_drinkPrice'],
} as const;

export const BILLING_ORDERS_ESSENTIALS: (keyof typeof BILLING_ORDERS_CANDIDATES)[] = [
  'orderDate',
  'ordererCode',
];

/**
 * MonthlyRecord_Summary (月次請求サマリー) のドリフト耐性定義
 */
export const BILLING_SUMMARY_CANDIDATES = {
  userId: ['UserId', 'UserCode', 'User_x0020_Id', 'cr013_userCode'],
  yearMonth: ['YearMonth', 'Year_x0020_Month', 'cr013_yearMonth'],
  displayName: ['DisplayName', 'Display_x0020_Name', 'cr013_displayName'],
  lastUpdated: ['LastUpdated', 'LastAggregatedAt', 'Last_x0020_Aggregated_x0020_At', 'cr013_lastUpdated'],
  totalDays: ['KPI_TotalDays', 'TotalDays', 'Total_x0020_Days', 'cr013_totalDays'],
  plannedRows: ['KPI_PlannedRows', 'PlannedRows', 'cr013_plannedRows'],
  completedRows: ['KPI_CompletedRows', 'CompletedRows', 'cr013_completedRows'],
  inProgressRows: ['KPI_InProgressRows', 'InProgressRows', 'cr013_inProgressRows'],
  emptyRows: ['KPI_EmptyRows', 'EmptyRows', 'cr013_emptyRows'],
  specialNotes: ['KPI_SpecialNotes', 'SpecialNotes', 'cr013_specialNotes'],
  incidents: ['KPI_Incidents', 'Incidents', 'cr013_incidents'],
  completionRate: ['CompletionRate', 'cr013_completionRate'],
  firstEntryDate: ['FirstEntryDate', 'cr013_firstEntryDate'],
  lastEntryDate: ['LastEntryDate', 'cr013_lastEntryDate'],
  idempotencyKey: ['IdempotencyKey', 'cr013_idempotencyKey'],
} as const;

export const BILLING_SUMMARY_ESSENTIALS: (keyof typeof BILLING_SUMMARY_CANDIDATES)[] = [
  'userId',
  'yearMonth',
  'totalDays',
];
