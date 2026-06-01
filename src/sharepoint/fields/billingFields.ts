/**
 * SharePoint フィールド定義 — Billing Orders (List3 on /sites/2/)
 */
import { readOptionalEnv } from '@/lib/env';

/**
 * BillingOrders リストの識別子
 *
 * 環境変数 VITE_SP_LIST_BILLING_ORDERS に実際の GUID または Title を設定できます。
 * 未設定の場合はコーヒー注文履歴の本番リスト Title である List3 を使用します。
 */
export const BILLING_ORDERS_LIST_ID: string =
  readOptionalEnv('VITE_SP_LIST_BILLING_ORDERS') ||
  'List3';

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
  paymentStatus: 'PaymentStatus',
  paidAt: 'PaidAt',
  paidBy: 'PaidBy',
} as const;

/**
 * BillingOrders (コーヒー注文) のドリフト耐性定義
 */
export const BILLING_ORDERS_CANDIDATES = {
  id: ['ID', 'Id'],
  orderDate: ['OrderDateTime', 'Title', 'OrderDate', 'cr013_orderDate'],
  ordererCode: ['RequesterCode', 'Orderer_x0020_Code', 'OrdererCode', 'cr013_ordererCode'],
  ordererName: ['RequesterName', 'Orderer_x0020_Name', 'OrdererName', 'cr013_ordererName'],
  orderCount: ['Count', 'Order_x0020_Count', 'OrderCount', 'cr013_orderCount'],
  served: ['Served', 'cr013_served'],
  item: ['Item', 'cr013_item'],
  sugar: ['SugarOption', 'Sugar', 'cr013_sugar'],
  milk: ['MilkOption', 'Milk', 'cr013_milk'],
  drinkPrice: ['DRINK_PRICE', 'DrinkPrice', 'cr013_drinkPrice'],
  paymentStatus: ['PaymentStatus', 'Payment_x0020_Status', 'cr013_paymentStatus'],
  paidAt: ['PaidAt', 'Paid_x0020_At', 'cr013_paidAt', 'PaymentDate'],
  paidBy: ['PaidBy', 'Paid_x0020_By', 'cr013_paidBy', 'PaymentHandler'],
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
  displayName: ['Display_x0020_Name', 'DisplayName', 'cr013_displayName'],
  lastUpdated: ['LastAggregatedAt', 'LastUpdated', 'Last_x0020_Aggregated_x0020_At', 'cr013_lastUpdated'],
  totalDays: [
    'KPI_TotalDays', 
    'TotalDays', // LEGACY: Decommission pending (#1713)
    'Total_x0020_Days', // LEGACY: Decommission pending (#1713)
    'cr013_totalDays'
  ],
  plannedRows: ['Planned_x0020_Rows', 'KPI_PlannedRows', 'PlannedRows', 'cr013_plannedRows'],
  completedRows: ['Completed_x0020_Rows', 'KPI_CompletedRows', 'CompletedRows', 'cr013_completedRows'],
  inProgressRows: ['In_x0020_Progress_x0020_Rows', 'KPI_InProgressRows', 'InProgressRows', 'cr013_inProgressRows'],
  emptyRows: ['Empty_x0020_Rows', 'KPI_EmptyRows', 'EmptyRows', 'cr013_emptyRows'],
  specialNotes: ['Special_x0020_Notes', 'KPI_SpecialNotes', 'SpecialNotes', 'cr013_specialNotes'],
  incidents: ['Incidents', 'KPI_Incidents', 'cr013_incidents'],
  completionRate: ['CompletionRate', 'cr013_completionRate'],
  firstEntryDate: ['First_x0020_Entry_x0020_Date', 'FirstEntryDate', 'cr013_firstEntryDate'],
  lastEntryDate: ['Last_x0020_Entry_x0020_Date', 'LastEntryDate', 'cr013_lastEntryDate'],
  // `IsLocked` is used for workflow locking in the actual SharePoint list.
  isLocked: ['IsLocked', 'Locked'],
  // `Key` is a legacy, data-bearing idempotency field. Keep it as an intentional
  // fallback until #1722 migration copies historical values into the canonical field.
  idempotencyKey: [
    'Idempotency_x0020_Key', 
    'IdempotencyKey', 
    'Key', // LEGACY: Decommission pending (#1713)
    'cr013_idempotencyKey'
  ],
} as const;

export const BILLING_SUMMARY_ESSENTIALS: (keyof typeof BILLING_SUMMARY_CANDIDATES)[] = [
  'userId',
  'yearMonth',
  'totalDays',
];
