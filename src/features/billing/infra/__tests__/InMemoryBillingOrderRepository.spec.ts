import { describe, expect, it } from 'vitest';
import { InMemoryBillingOrderRepository } from '../InMemoryBillingOrderRepository';

const baseOrders = [
  {
    id: 1,
    orderDate: '2026-06-01T10:00:00Z',
    ordererCode: 'U-001',
    ordererName: '利用者 A',
    orderCount: 1,
    served: 'true',
    item: 'コーヒー',
    sugar: 'なし',
    milk: 'なし',
    drinkPrice: 150,
    paymentStatus: '',
    paidAt: '',
    paidBy: '',
  },
  {
    id: 2,
    orderDate: '2026-06-02T10:00:00Z',
    ordererCode: 'G-001',
    ordererName: 'ゲスト B',
    orderCount: 2,
    served: '提供済み',
    item: '抹茶ラテ',
    sugar: 'あり',
    milk: 'なし',
    drinkPrice: 220,
    paymentStatus: '',
    paidAt: '',
    paidBy: '',
  },
];

const createBaseOrders = (): typeof baseOrders => baseOrders.map((row) => ({ ...row }));

describe('InMemoryBillingOrderRepository', () => {
  it('uses default mock data when no initial data is passed', async () => {
    const repo = new InMemoryBillingOrderRepository();
    const rows = await repo.list();
    const ids = rows.map((row) => row.id);
    const idSet = new Set(ids);

    expect(rows.length).toBeGreaterThan(0);
    expect(idSet.size).toBe(ids.length);
    expect(ids).toContain(1);
    expect(rows.every((row) => typeof row.id === 'number')).toBe(true);
    expect(rows.every((row) => !!row.ordererCode)).toBe(true);
    expect(rows.every((row) => !!row.orderDate)).toBe(true);
  });

  it('falls back to default mock data when an explicit empty array is passed', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const rows = await new InMemoryBillingOrderRepository([]).list();
      const defaultRows = await new InMemoryBillingOrderRepository().list();

      expect(rows.length).toBeGreaterThan(0);
      expect(rows).toEqual(defaultRows);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('isPersistenceColumnsResolved は常に true を返す', async () => {
    const repo = new InMemoryBillingOrderRepository(createBaseOrders());

    await expect(repo.isPersistenceColumnsResolved()).resolves.toBe(true);
  });

  it('returns a fresh array copy from list() and does not expose internal mutable state', async () => {
    const repo = new InMemoryBillingOrderRepository(createBaseOrders());

    const first = await repo.list();
    const second = await repo.list();

    expect(first).toHaveLength(2);
    expect(first).not.toBe(second);

    const beforeLength = repo.list().then((rows) => rows.length);
    first.push({
      id: 99,
      orderDate: '2026-06-03T10:00:00Z',
      ordererCode: 'X-000',
      ordererName: '追加',
      orderCount: 1,
      served: 'true',
      item: 'モカ',
      sugar: 'なし',
      milk: 'なし',
      drinkPrice: 150,
      paymentStatus: '',
      paidAt: '',
      paidBy: '',
    });

    expect(await beforeLength).toBe(2);
    const reloaded = await repo.list();
    expect(reloaded).toHaveLength(2);
  });

  it('updates only the targeted order for updatePaymentStatus', async () => {
    const repo = new InMemoryBillingOrderRepository(createBaseOrders());
    await repo.updatePaymentStatus(1, '精算済み', '2026-06-10T00:00:00Z', 'billing-user');

    const orders = await repo.list();
    expect(orders.find((o) => o.id === 1)).toMatchObject({
      paymentStatus: '精算済み',
      paidAt: '2026-06-10T00:00:00Z',
      paidBy: 'billing-user',
    });
    expect(orders.find((o) => o.id === 2)).toMatchObject({
      paymentStatus: '',
      paidAt: '',
      paidBy: '',
    });
  });

  it('ignores nonexistent ids in bulkUpdatePaymentStatus without throwing', async () => {
    const repo = new InMemoryBillingOrderRepository(createBaseOrders());

    await expect(repo.bulkUpdatePaymentStatus([999, 2], '精算済み', '2026-06-10T00:00:00Z', 'billing-user')).resolves.toBeUndefined();

    const orders = await repo.list();
    const targets = orders.find((o) => o.id === 2);
    const untouched = orders.find((o) => o.id === 1);

    expect(targets).toMatchObject({
      paymentStatus: '精算済み',
      paidBy: 'billing-user',
    });
    expect(untouched).toMatchObject({
      paymentStatus: '',
      paidAt: '',
      paidBy: '',
    });
  });

  it('resolves without side effects when bulkUpdatePaymentStatus is called with an empty list', async () => {
    const repo = new InMemoryBillingOrderRepository(createBaseOrders());

    await expect(repo.bulkUpdatePaymentStatus([], '未精算')).resolves.toBeUndefined();
    const orders = await repo.list();
    orders.forEach((order) => {
      expect(order).toMatchObject({
        paymentStatus: '',
        paidAt: '',
        paidBy: '',
      });
    });
  });
});
