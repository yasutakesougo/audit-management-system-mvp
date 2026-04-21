import type {
  IDataProvider,
  DataProviderOptions,
  UpdateOptions
} from '@/lib/data/dataProvider.interface';
import type { createSpClient } from '@/lib/spClient';
import type { SpFieldDef } from '@/lib/sp/types';
import {
  DataProviderItemNotFoundError,
  SharePointItemNotFoundError
} from '@/lib/errors';
import { SP_LIST_REGISTRY, findListEntry } from '@/sharepoint/spListRegistry';
import { getFlag } from '@/env';

const ensuredPromises = new Map<string, Promise<void>>();

/**
 * SharePoint 実装の DataProvider
 * 
 * 既存の SpClient (Orchestrator) をラップし、標準的な IDataProvider 
 * インターフェースを提供します。
 */
export class SharePointDataProvider implements IDataProvider {
  private client: ReturnType<typeof createSpClient>;

  constructor(client: ReturnType<typeof createSpClient>) {
    this.client = client;
  }

  /**
   * リソース名から実際の SharePoint リスト名を解決する。
   * (Users_Master など、プログラム上のキーを実環境名に変換)
   */
  private resolveResource(name: string): string {
    const entry = findListEntry(name) || SP_LIST_REGISTRY.find(e => e.key.toLowerCase() === name.toLowerCase());
    return entry ? entry.resolve() : name;
  }

  /**
   * 必要に応じてリストのプロビジョニングを実行する (Self-healing)。
   */
  private async ensureResource(name: string): Promise<void> {
    const existing = ensuredPromises.get(name);
    if (existing) return existing;

    const promise = (async () => {
      // MASTER SWITCH: Skip provisioning if requested via env
      const skipProvisioning = getFlag('VITE_SKIP_PROVISIONING', false);
      if (skipProvisioning) {
        return;
      }

      const entry = findListEntry(name) || SP_LIST_REGISTRY.find(e => e.key.toLowerCase() === name.toLowerCase());
      if (entry?.provisioningFields && entry.provisioningFields.length > 0) {
        if (entry.lifecycle === 'required') {
          const listName = entry.resolve();
          try {
            await this.client.ensureListExists(listName, [...entry.provisioningFields]);
          } catch (e) {
            console.warn(`[DataProvider] Self-healing failed for ${name}:`, e);
          }
        }
      }
    })();

    ensuredPromises.set(name, promise);
    return promise;
  }

  /**
   * クライアントを更新する（再認証や設定変更時に呼び出し）
   */
  setClient(client: ReturnType<typeof createSpClient>): void {
    this.client = client;
  }

  async listItems<T>(resourceName: string, options?: DataProviderOptions): Promise<T[]> {
    await this.ensureResource(resourceName);
    const actualName = this.resolveResource(resourceName);

    return this.client.listItems<T>(actualName, {
      select: options?.select,
      filter: options?.filter,
      orderby: options?.orderby,
      top: options?.top,
      expand: options?.expand?.join(','),
      pageCap: options?.pageCap,
      signal: options?.signal,
      onFieldRemoved: options?.onFieldRemoved,
      onCriticalFallback: options?.onCriticalFallback,
    });
  }

  async getItemById<T>(resourceName: string, id: string | number, options?: DataProviderOptions): Promise<T> {
    await this.ensureResource(resourceName);
    const actualName = this.resolveResource(resourceName);
    
    // SharePoint は数値 ID が基本
    const numericId = typeof id === 'number' ? id : parseInt(id, 10);
    
    try {
      return await this.client.getItemById<T>(
        actualName, 
        numericId, 
        {
          select: options?.select || [],
          signal: options?.signal,
          onFieldRemoved: options?.onFieldRemoved,
          onCriticalFallback: options?.onCriticalFallback,
        }
      );
    } catch (err) {
      if (err instanceof SharePointItemNotFoundError) throw err;
      
      const errorStr = String(err);
      const statusCode = (err as Record<string, unknown>)?.status ?? (err as Record<string, unknown>)?.statusCode;
      const is404 = statusCode === 404 || errorStr.includes('404');
      
      if (is404) {
        throw new DataProviderItemNotFoundError(resourceName, id);
      }
      throw err;
    }
  }

  async createItem<T>(resourceName: string, payload: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<T> {
    await this.ensureResource(resourceName);
    const actualName = this.resolveResource(resourceName);

    // SharePoint の addListItemByTitle は Promise<any> を返す
    return this.client.addListItemByTitle(actualName, payload, { signal: options?.signal }) as Promise<T>;
  }

  async updateItem<T>(
    resourceName: string, 
    id: string | number, 
    payload: Record<string, unknown>, 
    options?: UpdateOptions
  ): Promise<T> {
    await this.ensureResource(resourceName);
    const actualName = this.resolveResource(resourceName);

    const numericId = typeof id === 'number' ? id : parseInt(id, 10);
    
    return this.client.updateItem(actualName, numericId, payload, { 
      ifMatch: options?.etag,
      signal: options?.signal
    }) as Promise<T>;
  }

  async deleteItem(resourceName: string, id: string | number, options?: { signal?: AbortSignal }): Promise<void> {
    await this.ensureResource(resourceName);
    const actualName = this.resolveResource(resourceName);

    const numericId = typeof id === 'number' ? id : parseInt(id, 10);
    return this.client.deleteItem(actualName, numericId, { signal: options?.signal });
  }

  async getMetadata(resourceName: string): Promise<Record<string, unknown>> {
    const actualName = this.resolveResource(resourceName);
    const meta = await this.client.tryGetListMetadata(actualName);
    return (meta as unknown as Record<string, unknown>) || {};
  }

  async getFieldInternalNames(resourceName: string): Promise<Set<string>> {
    const actualName = this.resolveResource(resourceName);
    return this.client.getListFieldInternalNames(actualName);
  }

  async getResourceNames(): Promise<string[]> {
    const identifiers = await this.client.getExistingListTitlesAndIds();
    return Array.from(identifiers);
  }

  async ensureListExists(resourceName: string, fields: SpFieldDef[]): Promise<void> {
    const actualName = this.resolveResource(resourceName);
    await this.client.ensureListExists(actualName, fields);
  }

  /**
   * シード同期（SharePoint 実装では意図的な No-op）
   */
  async seed(_resourceName: string, _items: Array<Record<string, unknown>>): Promise<void> {
    // SharePoint 実装では何もしない
    return;
  }
}
