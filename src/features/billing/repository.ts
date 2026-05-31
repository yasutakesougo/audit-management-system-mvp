import type { BillingOrder } from './types';

/** Repository インターフェース */
export interface BillingOrderRepository {
  list(): Promise<BillingOrder[]>;
  isPersistenceColumnsResolved(): Promise<boolean>;
  updatePaymentStatus(
    id: number,
    status: '未精算' | '精算済み',
    paidAt?: string,
    paidBy?: string
  ): Promise<void>;
  bulkUpdatePaymentStatus(
    ids: number[],
    status: '未精算' | '精算済み',
    paidAt?: string,
    paidBy?: string
  ): Promise<void>;
}
