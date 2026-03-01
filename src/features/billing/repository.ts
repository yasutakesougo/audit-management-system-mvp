import type { BillingOrder } from './types';

/** 読み取り専用 Repository インターフェース */
export interface BillingOrderRepository {
  list(): Promise<BillingOrder[]>;
}
