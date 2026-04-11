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
import {
  RESULTS_LIST_TITLE, RESULTS_FIELDS,
  APPROVAL_LOGS_LIST_TITLE, APPROVAL_LOG_FIELDS,
  USER_FLAGS_LIST_TITLE, USER_FLAG_FIELDS,
} from '@/sharepoint/fields/childListSchemas';

export class SpProvisioningService {
  constructor(private spFetch: SpFetchFn) {}

  /**
   * リストの存在を保証し、必要に応じて作成・フィールド追加を行う。
   *
   * 物理的な列追加が一部失敗した場合、`ensureListExists` は throw せずに
   * `failedFields` を返す。必須列が失敗した場合は `sp:provision_partial` を発火し、
   * 観測性を保ったまま fail-soft を維持する。
   */
  async ensureList(
    listTitle: string,
    fields: SpFieldDef[],
    options: EnsureListOptions = {}
  ): Promise<EnsureListResult> {
    try {
      const result = await _ensureListExists(this.spFetch, listTitle, fields, options);

      const failed = result.failedFields ?? [];
      const requiredFailures = failed.filter(f => f.required);

      if (requiredFailures.length > 0) {
        trackSpEvent('sp:provision_partial', {
          listName: listTitle,
          details: {
            listId: result.listId,
            fieldCount: fields.length,
            failedCount: failed.length,
            requiredFailedCount: requiredFailures.length,
            failedFields: failed,
          },
          error: `${requiredFailures.length} required field(s) failed: ${requiredFailures.map(f => f.internalName).join(', ')}`,
        });
      } else {
        trackSpEvent('sp:provision_success', {
          listName: listTitle,
          details: {
            listId: result.listId,
            fieldCount: fields.length,
            optionalFailedCount: failed.length,
          },
        });
      }

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
   * Phase 1: 子リスト（Results / ApprovalLogs / UserFlags）をまとめて保証する。
   * 並列実行で高速化。各リストが既に存在する場合はフィールド差分のみ追加。
   */
  async ensureChildLists(): Promise<void> {
    await Promise.all([
      this.ensureList(RESULTS_LIST_TITLE, RESULTS_FIELDS),
      this.ensureList(APPROVAL_LOGS_LIST_TITLE, APPROVAL_LOG_FIELDS),
      this.ensureList(USER_FLAGS_LIST_TITLE, USER_FLAG_FIELDS),
    ]);
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
