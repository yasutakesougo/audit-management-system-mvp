import pLimit from 'p-limit';
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
import { readOptionalEnv } from '@/lib/env';
import type { BillingOrderRepository, BillingPersistenceDiagnostics } from '../ports/billingOrderRepository';
import type { BillingOrder } from '../types';
import { mapToBillingOrder } from '../domain/billingLogic';

export const BILLING_ORDERS_PAGE_SIZE = 5000;
const BILLING_PAYMENT_FIELDS = ['PaymentStatus', 'PaidAt', 'PaidBy'] as const;

const sanitizeDiagnosticError = (err: unknown): string => {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]').slice(0, 300);
};

/**
 * DataProviderBillingOrderRepository
 * 
 * IDataProvider ベースの BillingOrderRepository 実装。
 * 動的フィールド解決（Drift Resilience）に対応。
 */
export class DataProviderBillingOrderRepository implements BillingOrderRepository {
  private readonly provider: IDataProvider;
  private readonly listId: string;
  private readonly siteRelative?: string;
  private resolvedFields: Record<string, string | undefined> | null = null;
  private persistenceDiagnostics: BillingPersistenceDiagnostics;

  constructor(
    provider: IDataProvider,
    listId: string = BILLING_ORDERS_LIST_ID,
    siteRelative: string | undefined = readOptionalEnv('VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE')
  ) {
    this.provider = provider;
    this.listId = listId;
    this.siteRelative = siteRelative;
    this.persistenceDiagnostics = this.createDiagnostics('unknown', {});
  }

  private createDiagnostics(
    status: BillingPersistenceDiagnostics['status'],
    resolvedFields: Record<string, string | undefined>,
    errorMessage?: string
  ): BillingPersistenceDiagnostics {
    const missingFields = BILLING_PAYMENT_FIELDS.filter((field) => {
      if (field === 'PaymentStatus') return !resolvedFields.paymentStatus;
      if (field === 'PaidAt') return !resolvedFields.paidAt;
      return !resolvedFields.paidBy;
    });

    return {
      status,
      listId: this.listId,
      siteRelative: this.siteRelative,
      missingFields,
      resolvedFields,
      errorMessage,
      usesList3Fallback: this.listId === 'List3',
    };
  }

  private updatePersistenceDiagnostics(
    resolvedFields: Record<string, string | undefined>,
    errorMessage?: string
  ): void {
    let status: BillingPersistenceDiagnostics['status'] = 'resolved';
    if (errorMessage) {
      status = 'field_resolution_error';
    } else if (!resolvedFields.paymentStatus) {
      status = 'missing_payment_status';
    } else if (!resolvedFields.paidAt || !resolvedFields.paidBy) {
      status = 'missing_audit_fields';
    } else if (this.listId === 'List3') {
      status = 'env_fallback_list3';
    }
    this.persistenceDiagnostics = this.createDiagnostics(status, resolvedFields, errorMessage);
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
      this.updatePersistenceDiagnostics(this.resolvedFields);
      return this.resolvedFields;
    } catch (err) {
      const errorMessage = sanitizeDiagnosticError(err);
      console.error('[BillingOrderRepository] Field resolution failed:', err);
      this.updatePersistenceDiagnostics({}, errorMessage);
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
        top: BILLING_ORDERS_PAGE_SIZE,
        select: selectFields.length > 0 ? ['Id', 'Title', ...selectFields] : undefined,
      });

      const candidates = BILLING_ORDERS_CANDIDATES as unknown as Record<string, string[]>;
      const washed = washRows(items, candidates, mapping);

      return washed.map(item => mapToBillingOrder(item, mapping));
    } catch (err: unknown) {
      console.error('[BillingOrderRepository] Fetch error:', err);
      throw err;
    }
  }

  async isPersistenceColumnsResolved(): Promise<boolean> {
    const mapping = await this.resolveFields();
    return !!mapping.paymentStatus;
  }

  async getPersistenceDiagnostics(): Promise<BillingPersistenceDiagnostics> {
    await this.resolveFields();
    return this.persistenceDiagnostics;
  }

  async updatePaymentStatus(
    id: number,
    status: '未精算' | '精算済み',
    paidAt?: string,
    paidBy?: string
  ): Promise<void> {
    const mapping = await this.resolveFields();
    const payload: Record<string, unknown> = {};

    if (mapping.paymentStatus) {
      payload[mapping.paymentStatus] = status;
    } else {
      throw new Error('精算状態の永続化列が未設定です。SharePoint リストに列を作成してください。');
    }

    if (mapping.paidAt && paidAt !== undefined) {
      payload[mapping.paidAt] = paidAt;
    }
    if (mapping.paidBy && paidBy !== undefined) {
      payload[mapping.paidBy] = paidBy;
    }

    try {
      await this.provider.updateItem(this.listId, id, payload);
    } catch (err) {
      console.error(`[BillingOrderRepository] updatePaymentStatus failed for item ${id}:`, err);
      throw err;
    }
  }

  async bulkUpdatePaymentStatus(
    ids: number[],
    status: '未精算' | '精算済み',
    paidAt?: string,
    paidBy?: string
  ): Promise<void> {
    const limit = pLimit(5);
    const tasks = ids.map(id => limit(() => this.updatePaymentStatus(id, status, paidAt, paidBy)));
    await Promise.all(tasks);
  }
}
