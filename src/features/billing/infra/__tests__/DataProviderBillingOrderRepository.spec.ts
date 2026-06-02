import { describe, expect, it, vi } from 'vitest';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import {
  BILLING_ORDERS_PAGE_SIZE,
  DataProviderBillingOrderRepository,
} from '../DataProviderBillingOrderRepository';
import { BILLING_DEFAULT_DRINK_PRICE } from '../../domain/billingLogic';

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

  it('maps List3 rows with null DRINK_PRICE to the fixed billing price', async () => {
    const provider = createProvider();
    vi.mocked(provider.getFieldInternalNames).mockResolvedValue(new Set([
      'ID',
      'OrderDateTime',
      'RequesterCode',
      'RequesterName',
      'Count',
      'Served',
      'Item',
      'DRINK_PRICE',
      'PaymentStatus',
      'PaidAt',
      'PaidBy',
    ]));
    vi.mocked(provider.listItems).mockResolvedValue([
      {
        Id: 124,
        OrderDateTime: '2025-08-01T03:41:06Z',
        RequesterCode: 'I015',
        RequesterName: '真田　　滋久',
        Count: 1,
        Served: true,
        Item: 'コーヒー',
        DRINK_PRICE: null,
        PaymentStatus: null,
        PaidAt: null,
        PaidBy: null,
      },
    ]);
    const repository = new DataProviderBillingOrderRepository(provider, 'List3');

    const orders = await repository.list();

    expect(orders[0]).toMatchObject({
      id: 124,
      orderDate: '2025-08-01T03:41:06Z',
      ordererCode: 'I015',
      orderCount: 1,
      served: 'true',
      drinkPrice: BILLING_DEFAULT_DRINK_PRICE,
    });
    expect(provider.listItems).toHaveBeenCalledWith(
      'List3',
      expect.objectContaining({
        select: expect.arrayContaining(['OrderDateTime', 'Served', 'DRINK_PRICE', 'PaymentStatus']),
      })
    );
  });

  describe('isPersistenceColumnsResolved', () => {
    it('returns true when PaymentStatus field exists in data provider', async () => {
      const provider = createProvider();
      vi.mocked(provider.getFieldInternalNames).mockResolvedValue(new Set([
        'ID',
        'OrderDateTime',
        'RequesterCode',
        'PaymentStatus',
      ]));
      const repository = new DataProviderBillingOrderRepository(provider, 'List3');

      const isResolved = await repository.isPersistenceColumnsResolved();
      expect(isResolved).toBe(true);
    });

    it('returns false when PaymentStatus field is missing in data provider', async () => {
      const provider = createProvider();
      vi.mocked(provider.getFieldInternalNames).mockResolvedValue(new Set([
        'ID',
        'OrderDateTime',
        'RequesterCode',
      ]));
      const repository = new DataProviderBillingOrderRepository(provider, 'List3');

      const isResolved = await repository.isPersistenceColumnsResolved();
      expect(isResolved).toBe(false);
    });
  });
});
