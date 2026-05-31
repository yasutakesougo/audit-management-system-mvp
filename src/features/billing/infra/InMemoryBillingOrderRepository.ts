import type { BillingOrderRepository } from '../repository';
import type { BillingOrder } from '../types';

export class InMemoryBillingOrderRepository implements BillingOrderRepository {
  private orders: BillingOrder[] = [];

  constructor(initialData: BillingOrder[] = []) {
    if (initialData.length > 0) {
      this.orders = [...initialData];
    } else {
      this.orders = this.generateDefaultMockOrders();
    }
  }

  async list(): Promise<BillingOrder[]> {
    // 擬似的な遅延を入れて本物の通信っぽく見せる
    await new Promise((resolve) => setTimeout(resolve, 300));
    return [...this.orders];
  }

  private generateDefaultMockOrders(): BillingOrder[] {
    const items = [
      { name: 'ホットコーヒー', price: 150 },
      { name: 'アイスコーヒー', price: 150 },
      { name: 'カフェラテ', price: 200 },
      { name: '抹茶ラテ', price: 220 },
    ];

    const people = [
      // 利用者 (U-*** / I***)
      { code: 'U-001', name: '桂川 進太朗' },
      { code: 'U-005', name: '田中 太郎' },
      { code: 'U-012', name: '塩田 裕貴' },
      { code: 'I005', name: '石渡 由喜子' },
      { code: 'U-003', name: '高橋 次郎' },
      // 職員 (STF***)
      { code: 'STF001', name: '佐藤 花子' },
      { code: 'STF002', name: '鈴木 次郎' },
      { code: 'STF003', name: '高橋 三郎' },
      // ゲスト (G-*** またはその他)
      { code: 'G-001', name: '山田 太郎（ゲスト）' },
      { code: 'G-002', name: '外部監査員（ゲスト）' },
    ];

    const mockOrders: BillingOrder[] = [];
    let idCounter = 1;

    // 2026年4月、5月、6月のデータを生成
    const dates = [
      // 4月
      '2026-04-03T10:15:00Z', '2026-04-05T14:30:00Z', '2026-04-10T11:00:00Z',
      '2026-04-15T15:20:00Z', '2026-04-20T09:45:00Z', '2026-04-25T13:10:00Z',
      // 5月
      '2026-05-02T10:05:00Z', '2026-05-08T11:45:00Z', '2026-05-12T14:15:00Z',
      '2026-05-15T09:30:00Z', '2026-05-18T15:00:00Z', '2026-05-22T11:10:00Z',
      '2026-05-25T13:40:00Z', '2026-05-28T10:20:00Z', '2026-05-29T14:50:00Z',
      // 6月
      '2026-06-01T10:00:00Z', '2026-06-02T14:00:00Z',
    ];

    dates.forEach((dateStr) => {
      // 1つの日付につき、2〜4件の注文をランダムに作成
      const count = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < count; i++) {
        const person = people[Math.floor(Math.random() * people.length)];
        const item = items[Math.floor(Math.random() * items.length)];
        const served = Math.random() > 0.15 ? 'true' : 'false'; // 85% は提供済み
        const orderCount = Math.floor(Math.random() * 2) + 1; // 1回につき1〜2杯

        mockOrders.push({
          id: idCounter++,
          orderDate: dateStr,
          ordererCode: person.code,
          ordererName: person.name,
          orderCount,
          served,
          item: item.name,
          sugar: Math.random() > 0.5 ? 'あり' : 'なし',
          milk: Math.random() > 0.5 ? 'あり' : 'なし',
          drinkPrice: item.price,
          paymentStatus: '',
          paidAt: '',
          paidBy: '',
        });
      }
    });
    return mockOrders;
  }

  async isPersistenceColumnsResolved(): Promise<boolean> {
    return true;
  }

  async updatePaymentStatus(
    id: number,
    status: '未精算' | '精算済み',
    paidAt?: string,
    paidBy?: string
  ): Promise<void> {
    const order = this.orders.find(o => o.id === id);
    if (order) {
      order.paymentStatus = status;
      order.paidAt = paidAt ?? '';
      order.paidBy = paidBy ?? '';
    }
  }

  async bulkUpdatePaymentStatus(
    ids: number[],
    status: '未精算' | '精算済み',
    paidAt?: string,
    paidBy?: string
  ): Promise<void> {
    ids.forEach(id => {
      const order = this.orders.find(o => o.id === id);
      if (order) {
        order.paymentStatus = status;
        order.paidAt = paidAt ?? '';
        order.paidBy = paidBy ?? '';
      }
    });
  }
}

export const inMemoryBillingOrderRepository = new InMemoryBillingOrderRepository();
