/** 個人請求明細（SharePoint List3）の行データ */
export interface BillingOrder {
  id: number;
  orderDate: string;
  ordererCode: string;
  ordererName: string;
  orderCount: number;
  served: string;
  item: string;
  sugar: string;
  milk: string;
  drinkPrice: number;
}
