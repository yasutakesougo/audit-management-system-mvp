import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { BILLING_ORDERS_LIST_ID } from '@/sharepoint/fields';
import type { BillingOrderRepository } from '../repository';
import type { BillingOrder } from '../types';
import { mapToBillingOrder } from '../domain/billingLogic';

/**
 * DataProviderBillingOrderRepository
 * 
 * IDataProvider ベースの BillingOrderRepository 実装。
 * List3 (BillingOrders) は他とは異なるサイトにある場合があるが、
 * 注入される Provider 側でそのベースURLが解決されていることを前提とする。
 */
export class DataProviderBillingOrderRepository implements BillingOrderRepository {
  private readonly provider: IDataProvider;
  private readonly listId: string;

  constructor(provider: IDataProvider, listId: string = BILLING_ORDERS_LIST_ID) {
    this.provider = provider;
    this.listId = listId;
  }

  async list(): Promise<BillingOrder[]> {
    try {
      // SharePoint では GetById(...) を使いたいが、Provider.listItems は GetByTitle の想定が多い。
      // ただし BillingOrderRepository 的には listId (GUID) が Title の代わりとして渡される。
      const items = await this.provider.listItems<Record<string, unknown>>(this.listId, {
        top: 500,
      });

      return items.map(mapToBillingOrder);
    } catch (err: unknown) {
      console.error('[BillingOrderRepository] Fetch error:', err);
      throw err;
    }
  }
}
