/** @deprecated Use the Billing public runtime API instead. Removed in PR 3. */
export {
  getBillingOrderRepository,
  useBillingOrderRepository,
  overrideBillingOrderRepository,
  resetBillingOrderRepository,
  getCurrentBillingOrderRepositoryKind,
  resolveBillingSharePointBaseUrl,
  resolveBillingSharePointSiteRelative,
} from './adapters/runtime/useBillingRuntime';
export type { BillingOrderRepositoryFactoryOptions } from './adapters/runtime/useBillingRuntime';
