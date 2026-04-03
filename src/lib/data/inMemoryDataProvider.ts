import type { 
  IDataProvider, 
  DataProviderOptions, 
  UpdateOptions 
} from '@/lib/data/dataProvider.interface';
import type { SpFieldDef, ExistingFieldShape } from '@/lib/sp/types';
import { DataProviderItemNotFoundError } from '@/lib/errors';

/**
 * テストやオフライン開発用の InMemory 実装
 */
export class InMemoryDataProvider implements IDataProvider {
  private storage: Map<string, Array<Record<string, unknown>>> = new Map();
  private nextId = 1;

  constructor() {
    // 統合テスト・スモークテスト用の最小限のシードデータ
    this.storage.set('Staff_Master', [
      { Id: 1, StaffID: 'STF001', FullName: 'Staff One', Role: 'reception', IsActive: true },
      { Id: 2, StaffID: 'STF002', FullName: 'Staff Two', Role: 'admin', IsActive: true },
    ]);
    this.storage.set('Users_Master', [
      { Id: 1, UserID: 'USR001', FullName: 'User One', Status: 'active', IsActive: true },
    ]);
    // スケジュール解決用のダミー (resolveFields が失敗しないため)
    this.storage.set('Schedules', [
      { 
        Id: 1, 
        Title: 'Dummy Event', 
        EventDate: new Date().toISOString(), 
        EndDate: new Date().toISOString(),
        Status: 'Planned'
      }
    ]);
    // 職員出勤解決用
    this.storage.set('Staff_Attendance', [
      {
        Id: 1,
        StaffId: 'STF001',
        RecordDate: new Date().toISOString().split('T')[0],
        Status: 'attended'
      }
    ]);
    this.nextId = 100; // IDの重複防止
  }

  async listItems<T>(resourceName: string, options?: DataProviderOptions): Promise<T[]> {
    options?.signal?.throwIfAborted();
    const items = this.storage.get(resourceName) || [];
    let result = [...items];

    // 簡易的なフィルタリング ($filter: UserID eq '...' のみ対応)
    if (options?.filter && options.filter.includes('UserID eq')) {
      const match = options.filter.match(/UserID eq '([^']+)'/);
      const targetId = match?.[1];
      if (targetId) {
        result = result.filter(i => String(i.UserID) === targetId);
      }
    }

    if (options?.top) {
      result = result.slice(0, options.top);
    }

    return result as unknown as T[];
  }

  async getItemById<T>(resourceName: string, id: string | number, options?: DataProviderOptions): Promise<T> {
    options?.signal?.throwIfAborted();
    const items = this.storage.get(resourceName) || [];
    const item = items.find(i => String(i.Id || i.id || i.ID) === String(id));
    if (!item) throw new DataProviderItemNotFoundError(resourceName, id);
    return item as unknown as T;
  }

  async createItem<T>(resourceName: string, payload: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<T> {
    options?.signal?.throwIfAborted();
    const items = this.storage.get(resourceName) || [];
    const newItem = {
      Id: this.nextId++,
      CreatedAt: new Date().toISOString(),
      ...payload,
    } as unknown as Record<string, unknown>;
    const newItems = [...items, newItem];
    this.storage.set(resourceName, newItems);
    return newItem as unknown as T;
  }

  async updateItem<T>(
    resourceName: string, 
    id: string | number, 
    payload: Record<string, unknown>,
    options?: UpdateOptions
  ): Promise<T> {
    options?.signal?.throwIfAborted();
    const items = this.storage.get(resourceName) || [];
    const index = items.findIndex(i => String(i.Id || i.id || i.ID) === String(id));
    if (index === -1) throw new DataProviderItemNotFoundError(resourceName, id);

    const updatedItem = { ...items[index], ...payload, UpdatedAt: new Date().toISOString() };
    const newItems = [...items];
    newItems[index] = updatedItem;
    this.storage.set(resourceName, newItems);
    return updatedItem as unknown as T;
  }

  async deleteItem(resourceName: string, id: string | number, options?: { signal?: AbortSignal }): Promise<void> {
    options?.signal?.throwIfAborted();
    const items = this.storage.get(resourceName) || [];
    const filtered = items.filter(i => String(i.Id || i.id || i.ID) !== String(id));
    this.storage.set(resourceName, filtered);
  }

  async getFieldInternalNames(resourceName: string): Promise<Set<string>> {
    const items = this.storage.get(resourceName) || [];
    if (items.length === 0) return new Set(['Id', 'Created', 'Modified']);
    const allKeys = new Set<string>();
    items.forEach(item => Object.keys(item).forEach(key => allKeys.add(key)));
    return allKeys;
  }

  async getFieldDetails(resourceName: string): Promise<Map<string, ExistingFieldShape>> {
    const names = await this.getFieldInternalNames(resourceName);
    const map = new Map<string, ExistingFieldShape>();
    names.forEach(name => {
      map.set(name, { InternalName: name, TypeAsString: 'Text' });
    });
    return map;
  }

  async getMetadata(resourceName: string): Promise<Record<string, unknown>> {
    const items = this.storage.get(resourceName) || [];
    return { 
      Title: resourceName, 
      ItemCount: items.length,
      InMemory: true 
    };
  }

  /**
   * 自己修復（メモリ内実装ではリスト構造を強制しないため、メタデータのみ記録）
   */
  async ensureListExists(resourceName: string, _fields: SpFieldDef[]): Promise<void> {
    if (!this.storage.has(resourceName)) {
      this.storage.set(resourceName, []);
    }
  }

  /**
   * シードデータの注入（テスト・デモ用）
   */
  async seed(resourceName: string, items: Array<Record<string, unknown>>): Promise<void> {
    const nextId = items.length > 0 ? Math.max(...items.map(i => Number(i.Id || i.id || i.ID || 0))) + 1 : this.nextId;
    this.nextId = Math.max(this.nextId, nextId);
    this.storage.set(resourceName, items);
  }
}
