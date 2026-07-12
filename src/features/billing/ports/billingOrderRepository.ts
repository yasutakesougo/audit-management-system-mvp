import type { BillingOrder } from '../types';

export type BillingPersistenceDiagnosticStatus =
  | 'resolved'
  | 'missing_payment_status'
  | 'missing_audit_fields'
  | 'field_resolution_error'
  | 'env_fallback_list3'
  | 'unknown';

export interface BillingPersistenceDiagnostics {
  status: BillingPersistenceDiagnosticStatus;
  listId: string;
  siteRelative?: string;
  missingFields: string[];
  resolvedFields: Record<string, string | undefined>;
  errorMessage?: string;
  usesList3Fallback: boolean;
}

/** Billing order persistence contract. */
export interface BillingOrderRepository {
  list(): Promise<BillingOrder[]>;
  isPersistenceColumnsResolved(): Promise<boolean>;
  getPersistenceDiagnostics?(): Promise<BillingPersistenceDiagnostics>;
  updatePaymentStatus(
    id: number,
    status: '未精算' | '精算済み',
    paidAt?: string,
    paidBy?: string,
  ): Promise<void>;
  bulkUpdatePaymentStatus(
    ids: number[],
    status: '未精算' | '精算済み',
    paidAt?: string,
    paidBy?: string,
  ): Promise<void>;
}
