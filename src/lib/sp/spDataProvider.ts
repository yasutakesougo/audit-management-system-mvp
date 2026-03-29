import type { 
  IDataProvider, 
  DataProviderOptions, 
  UpdateOptions 
} from '@/lib/data/dataProvider.interface';
import type { createSpClient } from '@/lib/spClient';
import type { SpFieldDef } from '@/lib/sp/types';

/**
 * SharePoint 実装の DataProvider
 * 
 * 既存の SpClient (Orchestrator) をラップし、標準的な IDataProvider 
 * インターフェースを提供します。
 */
export class SharePointDataProvider implements IDataProvider {
  constructor(private client: ReturnType<typeof createSpClient>) {}

  async listItems<T>(resourceName: string, options?: DataProviderOptions): Promise<T[]> {
    return this.client.listItems<T>(resourceName, {
      select: options?.select,
      filter: options?.filter,
      orderby: options?.orderby,
      top: options?.top,
      expand: options?.expand?.join(','),
      pageCap: options?.pageCap,
      signal: options?.signal,
    });
  }

  async getItemById<T>(resourceName: string, id: string | number, options?: DataProviderOptions): Promise<T> {
    // SharePoint は数値 ID が基本
    const numericId = typeof id === 'number' ? id : parseInt(id, 10);
    
    return this.client.getItemById<T>(
      resourceName, 
      numericId, 
      options?.select || [], 
      options?.signal
    );
  }

  async createItem<T>(resourceName: string, payload: Record<string, unknown>): Promise<T> {
    // SharePoint の addListItemByTitle は Promise<any> を返す
    return this.client.addListItemByTitle(resourceName, payload) as Promise<T>;
  }

  async updateItem<T>(
    resourceName: string, 
    id: string | number, 
    payload: Record<string, unknown>, 
    options?: UpdateOptions
  ): Promise<T> {
    const numericId = typeof id === 'number' ? id : parseInt(id, 10);
    
    return this.client.updateItem(resourceName, numericId, payload, { 
      ifMatch: options?.etag 
    }) as Promise<T>;
  }

  async deleteItem(resourceName: string, id: string | number): Promise<void> {
    const numericId = typeof id === 'number' ? id : parseInt(id, 10);
    return this.client.deleteItem(resourceName, numericId);
  }

  async getMetadata(resourceName: string): Promise<Record<string, unknown>> {
    const meta = await this.client.tryGetListMetadata(resourceName);
    return (meta as unknown as Record<string, unknown>) || {};
  }

  async getFieldInternalNames(resourceName: string): Promise<Set<string>> {
    return this.client.getListFieldInternalNames(resourceName);
  }

  async ensureListExists(resourceName: string, fields: SpFieldDef[]): Promise<void> {
    await this.client.ensureListExists(resourceName, fields);
  }

  /**
   * シード同期（SharePoint 実装では意図的な No-op）
   */
  async seed(_resourceName: string, _items: Array<Record<string, unknown>>): Promise<void> {
    // SharePoint 実装では何もしない
    return;
  }
}
