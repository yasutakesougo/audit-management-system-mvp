/**
 * SharePoint Provisioning Service
 * 
 * 責務: リストの作成、フィールドの追加、スキーマの強制（Ensure）。
 * 実行結果を Telemetry に記録する。
 */
import { trackSpEvent } from '@/lib/telemetry/spTelemetry';
import type { SpFetchFn } from './spLists';
import { addFieldToList as _addFieldToList, ensureListExists as _ensureListExists } from './spListSchema';
import type { EnsureListOptions, EnsureListResult, SpFieldDef } from './types';

export class SpProvisioningService {
  constructor(private spFetch: SpFetchFn) {}

  /**
   * リストの存在を保証し、必要に応じて作成・フィールド追加を行う。
   */
  async ensureList(
    listTitle: string,
    fields: SpFieldDef[],
    options: EnsureListOptions = {}
  ): Promise<EnsureListResult> {
    try {
      const result = await _ensureListExists(this.spFetch, listTitle, fields, options);
      
      trackSpEvent('sp:provision_success', {
        listName: listTitle,
        details: { listId: result.listId, fieldCount: fields.length }
      });
      
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      
      trackSpEvent('sp:provision_failed', {
        listName: listTitle,
        error: message
      });
      
      throw error;
    }
  }

  /**
   * 単一フィールドの追加
   */
  async addField(listTitle: string, field: SpFieldDef): Promise<void> {
    try {
      await _addFieldToList(this.spFetch, listTitle, field);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      trackSpEvent('sp:provision_failed', {
        listName: listTitle,
        details: { field: field.internalName },
        error: message
      });
      throw error;
    }
  }
}

/**
 * Factory function for Provisioning Service
 */
export function createProvisioningService(spFetch: SpFetchFn) {
  return new SpProvisioningService(spFetch);
}
