/**
 * SharePoint フィールド定義 — Billing Orders (List3 on /sites/2/)
 */

/** List3 の GUID（要: SP 管理画面で確認後に差し替え） */
export const BILLING_ORDERS_LIST_ID = '00000000-0000-0000-0000-000000000003' as const;

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
