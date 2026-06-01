import { afterEach, describe, expect, it, vi } from 'vitest';

describe('BILLING_ORDERS_LIST_ID', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('defaults to the production coffee order history list title', async () => {
    vi.doMock('@/lib/env', () => ({
      readOptionalEnv: vi.fn(() => undefined),
    }));

    const { BILLING_ORDERS_LIST_ID } = await import('../billingFields');

    expect(BILLING_ORDERS_LIST_ID).toBe('List3');
  });

  it('allows an explicit BillingOrders list identifier override', async () => {
    vi.doMock('@/lib/env', () => ({
      readOptionalEnv: vi.fn((key: string) =>
        key === 'VITE_SP_LIST_BILLING_ORDERS' ? 'c4be5492-9803-4fc6-ac7e-82d10e95ff6d' : undefined
      ),
    }));

    const { BILLING_ORDERS_LIST_ID } = await import('../billingFields');

    expect(BILLING_ORDERS_LIST_ID).toBe('c4be5492-9803-4fc6-ac7e-82d10e95ff6d');
  });
});
