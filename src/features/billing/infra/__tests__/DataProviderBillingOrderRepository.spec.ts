import { describe, expect, it, vi } from 'vitest';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import {
  BILLING_ORDERS_PAGE_SIZE,
  DataProviderBillingOrderRepository,
} from '../DataProviderBillingOrderRepository';

const createProvider = (): IDataProvider => ({
  listItems: vi.fn().mockResolvedValue([]),
  getItemById: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  getMetadata: vi.fn(),
  getResourceNames: vi.fn(),
  getFieldInternalNames: vi.fn().mockResolvedValue(new Set(['Id', 'Title', 'OrdererCode'])),
  ensureListExists: vi.fn(),
});

describe('DataProviderBillingOrderRepository', () => {
  it('requests enough BillingOrders rows for monthly aggregation', async () => {
    const provider = createProvider();
    const repository = new DataProviderBillingOrderRepository(provider, 'List3');

    await repository.list();

    expect(provider.listItems).toHaveBeenCalledWith(
      'List3',
      expect.objectContaining({ top: BILLING_ORDERS_PAGE_SIZE })
    );
    expect(BILLING_ORDERS_PAGE_SIZE).toBe(5000);
  });
});
