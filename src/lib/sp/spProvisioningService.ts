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

export class SpProvisioningError extends Error {
  constructor(
    message: string,
    public listTitle: string,
    public failedFields: import('./types').FailedFieldInfo[]
  ) {
    super(message);
    this.name = 'SpProvisioningError';
  }
}

export class SpProvisioningService {
  constructor(private spFetch: SpFetchFn) {}

  /**
   * リストの存在を保証し、必要に応じて作成・フィールド追加を行う。
   *
   * 物理的な列追加が一部失敗した場合、`ensureListExists` は throw せずに
   * `failedFields` を返す。
   * 
   * [Hardening Phase C] REQUIRED 列が失敗した場合は Error を返し、
   * 上位の Coordinator が回復 Signal を発火できるようにする。
   */
  async ensureList(
    listTitle: string,
    fields: SpFieldDef[],
    options: EnsureListOptions & { phase?: 'bootstrap' | 'runtime' } = {}
  ): Promise<EnsureListResult> {
    const phase = options.phase ?? 'runtime';
    try {
      const result = await _ensureListExists(this.spFetch, listTitle, fields, options);

      const failed = result.failedFields ?? [];
      const requiredFailures = failed.filter(f => f.required);

      if (requiredFailures.length > 0) {
        const errorMsg = `${requiredFailures.length} required field(s) failed in ${listTitle}: ${requiredFailures.map(f => f.internalName).join(', ')}`;
        
        trackSpEvent('sp:provision_partial', {
          listName: listTitle,
          details: {
            listId: result.listId,
            fieldCount: fields.length,
            failedCount: failed.length,
            requiredFailedCount: requiredFailures.length,
            failedFields: failed,
          },
          error: errorMsg,
        });

        // ⚠️ HARD FAIL: 必須列が追加できなかった場合、bootstrap フェーズなら throw する
        // 運用中（runtime）は「一部機能制限（degraded）」として動作を継続しつつ、Signal で異常を知らせる
        if (phase === 'bootstrap') {
          throw new SpProvisioningError(errorMsg, listTitle, requiredFailures);
        }
      } else if (failed.length > 0) {
        trackSpEvent('sp:provision_success', {
          listName: listTitle,
          details: {
            listId: result.listId,
            fieldCount: fields.length,
            optionalFailedCount: failed.length,
            skippedOptionalFields: failed,
          },
        });
      } else {
        trackSpEvent('sp:provision_success', {
          listName: listTitle,
          details: {
            listId: result.listId,
            fieldCount: fields.length,
          },
        });
      }

      return result;
    } catch (error) {
      if (error instanceof SpProvisioningError) throw error;

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
  async ensureChildLists(phase: 'bootstrap' | 'runtime' = 'bootstrap'): Promise<void> {
    await Promise.all([
      this.ensureList(RESULTS_LIST_TITLE, RESULTS_FIELDS, { phase }),
      this.ensureList(APPROVAL_LOGS_LIST_TITLE, APPROVAL_LOG_FIELDS, { phase }),
      this.ensureList(USER_FLAGS_LIST_TITLE, USER_FLAG_FIELDS, { phase }),
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
