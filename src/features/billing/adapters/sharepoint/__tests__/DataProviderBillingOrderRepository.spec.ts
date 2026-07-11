import { describe, expect, it, vi } from 'vitest';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import {
  BILLING_ORDERS_PAGE_SIZE,
  DataProviderBillingOrderRepository,
} from '../DataProviderBillingOrderRepository';
import { BILLING_DEFAULT_DRINK_PRICE } from '../../../domain/billingLogic';

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

    it('reports resolved diagnostics when PaymentStatus and audit fields exist', async () => {
      const provider = createProvider();
      vi.mocked(provider.getFieldInternalNames).mockResolvedValue(new Set([
        'ID',
        'OrderDateTime',
        'RequesterCode',
        'PaymentStatus',
        'PaidAt',
        'PaidBy',
      ]));
      const repository = new DataProviderBillingOrderRepository(
        provider,
        'c4be5492-9803-4fc6-ac7e-82d10e95ff6d',
        '/sites/2'
      );

      await expect(repository.isPersistenceColumnsResolved()).resolves.toBe(true);
      await expect(repository.getPersistenceDiagnostics()).resolves.toMatchObject({
        status: 'resolved',
        listId: 'c4be5492-9803-4fc6-ac7e-82d10e95ff6d',
        siteRelative: '/sites/2',
        missingFields: [],
        usesList3Fallback: false,
        resolvedFields: expect.objectContaining({
          paymentStatus: 'PaymentStatus',
          paidAt: 'PaidAt',
          paidBy: 'PaidBy',
        }),
      });
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

    it('reports missing_payment_status when PaymentStatus is missing', async () => {
      const provider = createProvider();
      vi.mocked(provider.getFieldInternalNames).mockResolvedValue(new Set([
        'ID',
        'OrderDateTime',
        'RequesterCode',
        'PaidAt',
        'PaidBy',
      ]));
      const repository = new DataProviderBillingOrderRepository(provider, 'List3');

      await expect(repository.isPersistenceColumnsResolved()).resolves.toBe(false);
      await expect(repository.getPersistenceDiagnostics()).resolves.toMatchObject({
        status: 'missing_payment_status',
        missingFields: expect.arrayContaining(['PaymentStatus']),
        usesList3Fallback: true,
      });
    });

    it('reports missing_audit_fields when PaymentStatus exists but PaidAt or PaidBy is missing', async () => {
      const provider = createProvider();
      vi.mocked(provider.getFieldInternalNames).mockResolvedValue(new Set([
        'ID',
        'OrderDateTime',
        'RequesterCode',
        'PaymentStatus',
      ]));
      const repository = new DataProviderBillingOrderRepository(provider, 'List3');

      await expect(repository.isPersistenceColumnsResolved()).resolves.toBe(true);
      await expect(repository.getPersistenceDiagnostics()).resolves.toMatchObject({
        status: 'missing_audit_fields',
        missingFields: expect.arrayContaining(['PaidAt', 'PaidBy']),
        usesList3Fallback: true,
      });
    });

    it('reports field_resolution_error when field resolution rejects', async () => {
      const provider = createProvider();
      vi.mocked(provider.getFieldInternalNames).mockRejectedValue(new Error('HTTP 404 list not found'));
      const repository = new DataProviderBillingOrderRepository(provider, 'List3');
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(repository.isPersistenceColumnsResolved()).resolves.toBe(false);
      await expect(repository.getPersistenceDiagnostics()).resolves.toMatchObject({
        status: 'field_resolution_error',
        errorMessage: 'HTTP 404 list not found',
        missingFields: expect.arrayContaining(['PaymentStatus', 'PaidAt', 'PaidBy']),
        usesList3Fallback: true,
      });

      consoleError.mockRestore();
    });

    it('reports env_fallback_list3 when List3 fallback is used even if fields resolve', async () => {
      const provider = createProvider();
      vi.mocked(provider.getFieldInternalNames).mockResolvedValue(new Set([
        'ID',
        'OrderDateTime',
        'RequesterCode',
        'PaymentStatus',
        'PaidAt',
        'PaidBy',
      ]));
      const repository = new DataProviderBillingOrderRepository(provider, 'List3');

      await expect(repository.isPersistenceColumnsResolved()).resolves.toBe(true);
      await expect(repository.getPersistenceDiagnostics()).resolves.toMatchObject({
        status: 'env_fallback_list3',
        missingFields: [],
        usesList3Fallback: true,
      });
    });
  });
});
