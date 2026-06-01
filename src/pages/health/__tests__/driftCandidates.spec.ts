import { describe, expect, it } from 'vitest';
import { buildListSpecs } from '../driftCandidates';

describe('health driftCandidates', () => {
  it('excludes cross-site BillingOrders from default-site health drift checks', () => {
    const specs = buildListSpecs({
      VITE_SP_SITE_RELATIVE: '/sites/welfare',
      VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE: '/sites/2',
    });

    expect(specs.some(spec => spec.key === 'billing_orders')).toBe(false);
  });

  it('keeps BillingOrders when no cross-site override is configured', () => {
    const specs = buildListSpecs({
      VITE_SP_SITE_RELATIVE: '/sites/welfare',
    });

    expect(specs.some(spec => spec.key === 'billing_orders')).toBe(true);
  });

  it('keeps BillingOrders when the override points to the default site', () => {
    const specs = buildListSpecs({
      VITE_SP_SITE_RELATIVE: '/sites/welfare',
      VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE: '/sites/welfare/',
    });

    expect(specs.some(spec => spec.key === 'billing_orders')).toBe(true);
  });
});
