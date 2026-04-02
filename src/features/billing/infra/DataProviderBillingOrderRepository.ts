import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { 
  BILLING_ORDERS_LIST_ID,
  BILLING_ORDERS_CANDIDATES,
  BILLING_ORDERS_ESSENTIALS,
} from '@/sharepoint/fields';
import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved,
  washRows
} from '@/lib/sp/helpers';
import { reportResourceResolution } from '@/lib/data/dataProviderObservabilityStore';
import type { BillingOrderRepository } from '../repository';
import type { BillingOrder } from '../types';
import { mapToBillingOrder } from '../domain/billingLogic';

/**
 * DataProviderBillingOrderRepository
 * 
 * IDataProvider ベースの BillingOrderRepository 実装。
 * 動的フィールド解決（Drift Resilience）に対応。
 */
export class DataProviderBillingOrderRepository implements BillingOrderRepository {
  private readonly provider: IDataProvider;
  private readonly listId: string;
  private resolvedFields: Record<string, string | undefined> | null = null;

  constructor(provider: IDataProvider, listId: string = BILLING_ORDERS_LIST_ID) {
    this.provider = provider;
    this.listId = listId;
  }

  /**
   * フィールド解決（Dynamic Schema Resolution）
   */
  private async resolveFields(): Promise<Record<string, string | undefined>> {
    if (this.resolvedFields) return this.resolvedFields;

    try {
      const available = await this.provider.getFieldInternalNames(this.listId);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(
        available,
        BILLING_ORDERS_CANDIDATES as unknown as Record<string, string[]>
      );

      const isHealthy = areEssentialFieldsResolved(resolved, BILLING_ORDERS_ESSENTIALS as unknown as string[]);

      // Observability への報告
      reportResourceResolution({
        resourceName: `BillingOrders:${this.listId}`,
        resolvedTitle: this.listId,
        fieldStatus: fieldStatus as Record<string, { resolvedName?: string; candidates: string[] }>,
        essentials: BILLING_ORDERS_ESSENTIALS as unknown as string[],
      });

      if (!isHealthy) {
        console.warn(`[BillingOrderRepository] Essential fields missing in list ${this.listId}.`);
      }

      this.resolvedFields = resolved as Record<string, string | undefined>;
      return this.resolvedFields;
    } catch (err) {
      console.error('[BillingOrderRepository] Field resolution failed:', err);
      // フォールバック（空オブジェクトで hardcoded keys へのフォールバックを mapToBillingOrder に委ねる）
      return {};
    }
  }

  async list(): Promise<BillingOrder[]> {
    try {
      const mapping = await this.resolveFields();

      // 動的 $select 生成 (オプション)
      const selectFields = Object.values(mapping).filter((v): v is string => !!v);

      const items = await this.provider.listItems<Record<string, unknown>>(this.listId, {
        top: 500,
        select: selectFields.length > 0 ? ['Id', 'Title', ...selectFields] : undefined,
      });

      const candidates = BILLING_ORDERS_CANDIDATES as unknown as Record<string, string[]>;
      const washed = washRows(items, candidates, mapping);

      return washed.map(item => mapToBillingOrder(item));
    } catch (err: unknown) {
      console.error('[BillingOrderRepository] Fetch error:', err);
      throw err;
    }
  }
}
