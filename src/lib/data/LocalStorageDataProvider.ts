import type { 
  IDataProvider, 
  DataProviderOptions, 
  UpdateOptions 
} from '@/lib/data/dataProvider.interface';
import { auditLog } from '@/lib/debugLogger';
import type { SpFieldDef } from '@/lib/sp/types';

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

  constructor() {
    // 初期化時に現在のシリアル化に異常がないか等のセルフチェックを行うことも可能
    auditLog.info('data:local', 'LocalStorageDataProvider initialized');
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
    auditLog.warn('data:local', 'All local data cleared');
  }

  async listItems<T>(resourceName: string, options?: DataProviderOptions): Promise<T[]> {
    try {
      const raw = localStorage.getItem(this.dataKey(resourceName));
      if (!raw) return [];

      let items = JSON.parse(raw) as Array<Record<string, unknown>>;

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

  async getItemById<T>(resourceName: string, id: string | number): Promise<T> {
    const items = await this.listItems<Record<string, unknown>>(resourceName);
    const item = items.find(i => String(i.Id || i.id || i.ID) === String(id));
    if (!item) throw new Error(`Item ${id} not found in ${resourceName} (Local)`);
    return item as unknown as T;
  }

  async createItem<T>(resourceName: string, payload: Record<string, unknown>): Promise<T> {
    const items = await this.listItems<Record<string, unknown>>(resourceName);
    
    // ID 生成
    const maxId = items.reduce((max, i) => Math.max(max, Number(i.Id || i.id || i.ID || 0)), 0);
    const newItem = {
      Id: maxId + 1,
      Created: new Date().toISOString(),
      Modified: new Date().toISOString(),
      ...payload,
    };

    const newItems = [...items, newItem];
    localStorage.setItem(this.dataKey(resourceName), JSON.stringify(newItems));
    
    // スキーマの動的拡張
    const fields = await this.getFieldInternalNames(resourceName);
    let extended = false;
    Object.keys(payload).forEach(key => {
      if (!fields.has(key)) {
        fields.add(key);
        extended = true;
      }
    });
    if (extended) {
      localStorage.setItem(this.fieldsKey(resourceName), JSON.stringify(Array.from(fields)));
    }

    return newItem as unknown as T;
  }

  async updateItem<T>(
    resourceName: string, 
    id: string | number, 
    payload: Record<string, unknown>,
    _options?: UpdateOptions
  ): Promise<T> {
    const items = await this.listItems<Record<string, unknown>>(resourceName);
    const index = items.findIndex(i => String(i.Id || i.id || i.ID) === String(id));
    if (index === -1) throw new Error(`Item ${id} not found in ${resourceName} (Local)`);

    const updatedItem = {
      ...items[index],
      ...payload,
      Modified: new Date().toISOString()
    };
    
    const newItems = [...items];
    newItems[index] = updatedItem;
    localStorage.setItem(this.dataKey(resourceName), JSON.stringify(newItems));
    
    return updatedItem as unknown as T;
  }

  async deleteItem(resourceName: string, id: string | number): Promise<void> {
    const items = await this.listItems<Record<string, unknown>>(resourceName);
    const newItems = items.filter(i => String(i.Id || i.id || i.ID) !== String(id));
    localStorage.setItem(this.dataKey(resourceName), JSON.stringify(newItems));
  }

  async getMetadata(resourceName: string): Promise<Record<string, unknown>> {
    const data = await this.listItems<Record<string, unknown>>(resourceName);
    return {
      Title: resourceName,
      ItemCount: data.length,
      Id: `local:${resourceName}`,
    };
  }

  async getFieldInternalNames(resourceName: string): Promise<Set<string>> {
    const rawFields = localStorage.getItem(this.fieldsKey(resourceName));
    if (rawFields) {
      return new Set(JSON.parse(rawFields));
    }
    // 未設定の場合はデータから推論
    const items = await this.listItems<Record<string, unknown>>(resourceName);
    const names = new Set<string>(['Id', 'Created', 'Modified']);
    items.forEach(item => Object.keys(item).forEach(k => names.add(k)));
    return names;
  }

  async ensureListExists(resourceName: string, fields: SpFieldDef[]): Promise<void> {
    const internalNames = fields.map(f => f.internalName);
    const existing = await this.getFieldInternalNames(resourceName);
    internalNames.forEach(name => existing.add(name));
    
    localStorage.setItem(this.fieldsKey(resourceName), JSON.stringify(Array.from(existing)));
    
    if (localStorage.getItem(this.dataKey(resourceName)) === null) {
      localStorage.setItem(this.dataKey(resourceName), JSON.stringify([]));
    }
  }

  async seed(resourceName: string, items: Array<Record<string, unknown>>): Promise<void> {
    localStorage.setItem(this.dataKey(resourceName), JSON.stringify(items));
    
    // スキーマも更新
    const names = new Set<string>(['Id', 'Created', 'Modified']);
    items.forEach(item => Object.keys(item).forEach(k => names.add(k)));
    localStorage.setItem(this.fieldsKey(resourceName), JSON.stringify(Array.from(names)));
    
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
