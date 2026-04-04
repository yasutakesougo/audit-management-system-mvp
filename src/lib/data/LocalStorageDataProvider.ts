import type { 
  IDataProvider, 
  DataProviderOptions, 
  UpdateOptions 
} from '@/lib/data/dataProvider.interface';
import { auditLog } from '@/lib/debugLogger';
import { DataProviderItemNotFoundError } from '@/lib/errors';
import type { SpFieldDef, ExistingFieldShape } from '@/lib/sp/types';

/**
 * LocalStorageDataProvider
 * 
 * ブラウザの localStorage を永続化層として使用する IDataProvider 実装。
 * オフライン動作、デモ、研修、安全検証環境用に設計されている。
 */
export class LocalStorageDataProvider implements IDataProvider {
  private readonly prefix = 'dp:v1:';
  private readonly dataKey = (name: string) => `${this.prefix}data:${name}`;
  private readonly fieldsKey = (name: string) => `${this.prefix}fields:${name}`;

  // In-Memory Cache to avoid redundant JSON.parse/localStorage.getItem calls
  private dataCache: Map<string, Array<Record<string, unknown>>> = new Map();
  private fieldsCache: Map<string, Set<string>> = new Map();

  constructor() {
    auditLog.info('data:local', 'LocalStorageDataProvider initialized with caching');
    this.setupStorageListener();
  }

  private setupStorageListener(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('storage', (event) => {
      // If our keys changed in another tab, clear the cache to force reload
      if (event.key?.startsWith(this.prefix)) {
        auditLog.info('data:local', 'External storage change detected. Invalidating cache.');
        this.dataCache.clear();
        this.fieldsCache.clear();
      }
    });
  }

  /**
   * Internal helper to load resource data ensuring cache usage.
   * This is the "Lazy Load" point.
   */
  private async ensureLoaded(resourceName: string): Promise<Array<Record<string, unknown>>> {
    if (this.dataCache.has(resourceName)) {
      return this.dataCache.get(resourceName)!;
    }

    const raw = localStorage.getItem(this.dataKey(resourceName));
    const items = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    this.dataCache.set(resourceName, items);
    return items;
  }

  /**
   * Internal helper to persist data to localStorage and update cache.
   */
  private saveToDisk(resourceName: string, items: Array<Record<string, unknown>>): void {
    this.dataCache.set(resourceName, items);
    localStorage.setItem(this.dataKey(resourceName), JSON.stringify(items));
    
    // Invalidate fields cache as the data shape might have changed
    this.fieldsCache.delete(resourceName);
  }

  /**
   * すべてのデータをクリアする。
   */
  clearAllData(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
    this.dataCache.clear();
    this.fieldsCache.clear();
    auditLog.warn('data:local', 'All local data cleared');
  }

  async listItems<T>(resourceName: string, options?: DataProviderOptions): Promise<T[]> {
    options?.signal?.throwIfAborted();
    try {
      let items = await this.ensureLoaded(resourceName);

      // 簡易的な OData フィルタリングの実装 (eq のみ対応)
      if (options?.filter) {
        items = this.applyFilter(items, options.filter);
      }

      // 並べ替え (OrderBy)
      if (options?.orderby) {
        items = this.applyOrderBy(items, options.orderby);
      }

      // 取得件数制限 (Top)
      if (options?.top) {
        items = items.slice(0, options.top);
      }

      return items as unknown as T[];
    } catch (err) {
      auditLog.error('data:local', `Failed to list items for ${resourceName}`, err);
      return [];
    }
  }

  async getItemById<T>(resourceName: string, id: string | number, options?: DataProviderOptions): Promise<T> {
    options?.signal?.throwIfAborted();
    const items = await this.ensureLoaded(resourceName);
    const item = items.find(i => String(i.Id || i.id || i.ID) === String(id));
    if (!item) throw new DataProviderItemNotFoundError(resourceName, id);
    return item as unknown as T;
  }

  async createItem<T>(resourceName: string, payload: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<T> {
    options?.signal?.throwIfAborted();
    const items = await this.ensureLoaded(resourceName);
    
    // ID 生成
    const maxId = items.reduce((max, i) => Math.max(max, Number(i.Id || i.id || i.ID || 0)), 0);
    const newItem = {
      Id: maxId + 1,
      Created: new Date().toISOString(),
      Modified: new Date().toISOString(),
      ...payload,
    };

    const newItems = [...items, newItem];
    this.saveToDisk(resourceName, newItems);
    
    return newItem as unknown as T;
  }

  async updateItem<T>(
    resourceName: string, 
    id: string | number, 
    payload: Record<string, unknown>,
    options?: UpdateOptions
  ): Promise<T> {
    options?.signal?.throwIfAborted();
    const items = await this.ensureLoaded(resourceName);
    const index = items.findIndex(i => String(i.Id || i.id || i.ID) === String(id));
    if (index === -1) throw new DataProviderItemNotFoundError(resourceName, id);

    const updatedItem = {
      ...items[index],
      ...payload,
      Modified: new Date().toISOString()
    };
    
    const newItems = [...items];
    newItems[index] = updatedItem;
    this.saveToDisk(resourceName, newItems);
    
    return updatedItem as unknown as T;
  }

  async deleteItem(resourceName: string, id: string | number, options?: { signal?: AbortSignal }): Promise<void> {
    options?.signal?.throwIfAborted();
    const items = await this.ensureLoaded(resourceName);
    const newItems = items.filter(i => String(i.Id || i.id || i.ID) !== String(id));
    this.saveToDisk(resourceName, newItems);
  }

  async getMetadata(resourceName: string): Promise<Record<string, unknown>> {
    const data = await this.ensureLoaded(resourceName);
    return {
      Title: resourceName,
      ItemCount: data.length,
      Id: `local:${resourceName}`,
    };
  }

  async getResourceNames(): Promise<string[]> {
    const names = new Set<string>(this.dataCache.keys());
    const dataPrefix = this.dataKey('');

    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(dataPrefix)) continue;
        const resourceName = key.slice(dataPrefix.length);
        if (resourceName) names.add(resourceName);
      }
    }

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }

  async getFieldInternalNames(resourceName: string): Promise<Set<string>> {
    if (this.fieldsCache.has(resourceName)) {
      return this.fieldsCache.get(resourceName)!;
    }

    const rawFields = localStorage.getItem(this.fieldsKey(resourceName));
    if (rawFields) {
      const fields = new Set<string>(JSON.parse(rawFields));
      this.fieldsCache.set(resourceName, fields);
      return fields;
    }

    // 未設定の場合はデータから推論
    const items = await this.ensureLoaded(resourceName);
    const names = new Set<string>(['Id', 'Created', 'Modified']);
    items.forEach(item => Object.keys(item).forEach(k => names.add(k)));
    
    this.fieldsCache.set(resourceName, names);
    return names;
  }

  async getFieldDetails(resourceName: string): Promise<Map<string, ExistingFieldShape>> {
    const names = await this.getFieldInternalNames(resourceName);
    const map = new Map<string, ExistingFieldShape>();
    names.forEach(name => {
      map.set(name, { InternalName: name, TypeAsString: 'Text' });
    });
    return map;
  }

  async ensureListExists(resourceName: string, fields: SpFieldDef[]): Promise<void> {
    const internalNames = fields.map(f => f.internalName);
    const existing = await this.getFieldInternalNames(resourceName);
    internalNames.forEach(name => existing.add(name));
    
    localStorage.setItem(this.fieldsKey(resourceName), JSON.stringify(Array.from(existing)));
    this.fieldsCache.set(resourceName, existing);
    
    if (localStorage.getItem(this.dataKey(resourceName)) === null) {
      this.saveToDisk(resourceName, []);
    }
  }

  async seed(resourceName: string, items: Array<Record<string, unknown>>): Promise<void> {
    this.saveToDisk(resourceName, items);
    
    // スキーマも更新
    const names = new Set<string>(['Id', 'Created', 'Modified']);
    items.forEach(item => Object.keys(item).forEach(k => names.add(k)));
    localStorage.setItem(this.fieldsKey(resourceName), JSON.stringify(Array.from(names)));
    this.fieldsCache.set(resourceName, names);
    
    auditLog.info('data:local', `Seeded ${items.length} items into ${resourceName}`);
  }

  // ─── Private Helpers ───────────────────────────────────────────

  /**
   * 簡易的な OData フィルタリングの実装
   * 現在は "field eq 'value'" および "field eq true/false" 形式のみサポート。
   */
  private applyFilter(items: Array<Record<string, unknown>>, filter: string): Array<Record<string, unknown>> {
    // 簡易的な AND 分割
    const conditions = filter.split(/\s+and\s+/i);
    let filtered = [...items];

    for (const cond of conditions) {
      const match = cond.match(/(\w+)\s+(eq|ne|gt|ge|lt|le)\s+([^']+)/) 
                 || cond.match(/(\w+)\s+(eq|ne|gt|ge|lt|le)\s+'([^']+)'/);
      
      if (match) {
        const [, field, op, value] = match;
        filtered = filtered.filter(item => {
          const raw = item[field];
          if (raw === undefined || raw === null) return false;
          
          const val = String(raw);
          const target = String(value);

          switch (op.toLowerCase()) {
            case 'eq': return val === target;
            case 'ne': return val !== target;
            case 'ge': return val >= target;
            case 'le': return val <= target;
            case 'gt': return val > target;
            case 'lt': return val < target;
            default: return true;
          }
        });
      }
    }

    return filtered;
  }

  private applyOrderBy(items: Array<Record<string, unknown>>, orderby: string): Array<Record<string, unknown>> {
    const [field, direction] = orderby.trim().split(/\s+/);
    const isDesc = direction?.toLowerCase() === 'desc';

    return [...items].sort((a, b) => {
      const valA = a[field] ?? '';
      const valB = b[field] ?? '';
      if (valA < valB) return isDesc ? 1 : -1;
      if (valA > valB) return isDesc ? -1 : 1;
      return 0;
    });
  }
}
