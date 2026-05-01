import type { 
  IDataProvider, 
  DataProviderOptions, 
  UpdateOptions 
} from '@/lib/data/dataProvider.interface';
import type { SpFieldDef } from '@/lib/sp/types';
import { DataProviderItemNotFoundError } from '@/lib/errors';

/**
 * テストやオフライン開発用の InMemory 実装
 */
export class InMemoryDataProvider implements IDataProvider {
  private storage: Map<string, Array<Record<string, unknown>>> = new Map();
  private schemaStorage: Map<string, Set<string>> = new Map();
  private nextId = 1;

  constructor() {
    // 統合テスト・スモークテスト用の最小限のシードデータ
    this.storage.set('Staff_Master', [
      { Id: 1, StaffID: 'STF001', FullName: 'Staff One', Role: 'reception', IsActive: true },
      { Id: 2, StaffID: 'STF002', FullName: 'Staff Two', Role: 'admin', IsActive: true },
    ]);
    this.storage.set('Users_Master', [
      { 
        Id: 1, 
        UserID: 'USR001', 
        FullName: 'User One', 
        Furigana: 'ユーザー ワン',
        Status: 'active', 
        IsActive: true,
        IsSupportProcedureTarget: true,
        RecipientCertNumber: '1234567890',
        LastAssessmentDate: '2026-02-15' // 約3ヶ月前
      },
    ]);
    // 支援手順の実施状況
    this.storage.set('SupportRecord_Daily', [
      { Id: 1, UserID: 'USR001', SupportProcedureExecution_Target: '{}', RecordDate: new Date().toISOString().split('T')[0] }
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

    // ISP 三層 schema を最低限登録 (essential field 解決を memory backend でも通すため)
    this.schemaStorage.set('ISP_Master', new Set([
      'Id', 'Title', 'UserCode', 'PlanStartDate', 'PlanEndDate',
      'Status', 'VersionNo', 'IsCurrent', 'FormDataJson',
      'Created', 'Modified',
    ]));
    this.schemaStorage.set('SupportPlanningSheet_Master', new Set([
      'Id', 'Title', 'UserCode', 'ISPId', 'ISPLookupId',
      'Status', 'VersionNo', 'IsCurrent', 'FormDataJson',
      'Created', 'Modified',
    ]));
    this.schemaStorage.set('SupportProcedureRecord_Daily', new Set([
      'Id', 'Title', 'UserCode', 'ISPId', 'ISPLookupId',
      'PlanningSheetLookupId', 'RecordDate', 'Status',
      'Created', 'Modified',
    ]));

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
    const allKeys = new Set<string>(['Id', 'Created', 'Modified']);
    
    const schemaFields = this.schemaStorage.get(resourceName);
    if (schemaFields) {
      schemaFields.forEach(f => allKeys.add(f));
    }
    
    items.forEach(item => Object.keys(item).forEach(key => allKeys.add(key)));
    return allKeys;
  }

  async getMetadata(resourceName: string): Promise<Record<string, unknown>> {
    const items = this.storage.get(resourceName) || [];
    return { 
      Title: resourceName, 
      ItemCount: items.length,
      InMemory: true 
    };
  }

  async getResourceNames(): Promise<string[]> {
    return Array.from(this.storage.keys()).sort((a, b) => a.localeCompare(b));
  }

  /**
   * 自己修復（メモリ内実装ではリスト構造を強制しないため、メタデータのみ記録）
   */
  async ensureListExists(resourceName: string, fields: SpFieldDef[]): Promise<void> {
    if (!this.storage.has(resourceName)) {
      this.storage.set(resourceName, []);
    }
    const schemaFields = this.schemaStorage.get(resourceName) || new Set<string>();
    fields.forEach(f => schemaFields.add(f.internalName));
    this.schemaStorage.set(resourceName, schemaFields);
  }

  /**
   * シードデータの注入（テスト・デモ用）
   */
  async seed(resourceName: string, items: Array<Record<string, unknown>>): Promise<void> {
    const normalized = items.map((item) => {
      const explicitId = item.Id ?? item.id ?? item.ID;
      if (explicitId !== undefined && explicitId !== null && Number.isFinite(Number(explicitId))) {
        return { ...item, Id: Number(explicitId) };
      }
      return { Id: this.nextId++, ...item };
    });

    const maxId = normalized.length > 0
      ? Math.max(...normalized.map((item) => Number(item.Id ?? 0)))
      : 0;
    this.nextId = Math.max(this.nextId, maxId + 1);
    this.storage.set(resourceName, normalized);
  }
}
