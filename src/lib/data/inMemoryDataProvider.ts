import type { 
  IDataProvider, 
  DataProviderOptions, 
  UpdateOptions 
} from '@/lib/data/dataProvider.interface';
import type { SpFieldDef } from '@/lib/sp/types';

/**
 * テストやオフライン開発用の InMemory 実装
 */
export class InMemoryDataProvider implements IDataProvider {
  private storage: Map<string, Array<Record<string, unknown>>> = new Map();
  private nextId = 1;

  async listItems<T>(resourceName: string, options?: DataProviderOptions): Promise<T[]> {
    const items = this.storage.get(resourceName) || [];
    let result = [...items];

    // 簡易的なフィルタリング
    if (options?.top) {
      result = result.slice(0, options.top);
    }

    return result as unknown as T[];
  }

  async getItemById<T>(resourceName: string, id: string | number): Promise<T> {
    const items = this.storage.get(resourceName) || [];
    const item = items.find(i => String(i.Id || i.id) === String(id));
    if (!item) throw new Error(`Item ${id} not found in ${resourceName}`);
    return item as unknown as T;
  }

  async createItem<T>(resourceName: string, payload: Record<string, unknown>, _options?: { signal?: AbortSignal }): Promise<T> {
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
    _options?: UpdateOptions
  ): Promise<T> {
    const items = this.storage.get(resourceName) || [];
    const index = items.findIndex(i => String(i.Id || i.id || i.ID) === String(id));
    if (index === -1) throw new Error(`Item ${id} not found in ${resourceName}`);

    const updatedItem = { ...items[index], ...payload, UpdatedAt: new Date().toISOString() };
    const newItems = [...items];
    newItems[index] = updatedItem;
    this.storage.set(resourceName, newItems);
    return updatedItem as unknown as T;
  }

  async deleteItem(resourceName: string, id: string | number, _options?: { signal?: AbortSignal }): Promise<void> {
    const items = this.storage.get(resourceName) || [];
    const filtered = items.filter(i => String(i.Id || i.id || i.ID) !== String(id));
    this.storage.set(resourceName, filtered);
  }

  async getFieldInternalNames(resourceName: string): Promise<Set<string>> {
    const items = this.storage.get(resourceName) || [];
    if (items.length === 0) return new Set();
    const allKeys = new Set<string>();
    items.forEach(item => Object.keys(item).forEach(key => allKeys.add(key)));
    return allKeys;
  }

  async getMetadata(resourceName: string): Promise<Record<string, unknown>> {
    return { Title: resourceName, InMemory: true };
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
