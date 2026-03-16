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
