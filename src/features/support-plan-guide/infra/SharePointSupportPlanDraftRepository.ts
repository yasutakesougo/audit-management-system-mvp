import { get as getEnv } from '@/env';
import { toSafeError } from '@/lib/errors';
import type { SpFetchFn } from '@/lib/sp/spLists';

import {
    SUPPORT_PLANS_FIELDS,
    SUPPORT_PLANS_SELECT_FIELDS,
    joinSelect,
} from '@/sharepoint/fields';
import type {
    SupportPlanDraftRepository,
    SupportPlanListParams,
} from '../domain/SupportPlanDraftRepository';
import { supportPlanSpRowSchema } from '../schema';
import type { SupportPlanDraft, SupportPlanForm } from '../types';
import { sanitizeForm } from '../utils/helpers';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const getListTitle = (): string =>
  getEnv('VITE_SP_LIST_SUPPORT_PLANS', 'SupportPlans');

// readSpErrorMessage 削除: spFetch (throwOnError: true) が自動 throw する

const buildListPath = (): string => {
  const listTitle = getListTitle();
  return `/_api/web/lists/GetByTitle('${encodeURIComponent(listTitle)}')`;
};

/** Map a validated SP row to SupportPlanDraft domain object. */
const mapSpRowToDraft = (
  row: ReturnType<typeof supportPlanSpRowSchema.parse>,
): SupportPlanDraft | null => {
  try {
    const formData: Partial<SupportPlanForm> = JSON.parse(row.FormDataJson);
    return {
      id: row.DraftId,
      name: row.DraftName,
      createdAt: row.Created ?? new Date().toISOString(),
      updatedAt: row.Modified ?? new Date().toISOString(),
      userId: null, // Resolved by hook layer from userCode
      userCode: row.UserCode,
      data: sanitizeForm(formData),
    };
  } catch (error) {
    console.warn('[SharePointSupportPlanDraftRepository] Failed to parse FormDataJson', {
      draftId: row.DraftId,
      error,
    });
    return null;
  }
};

/**
 * HTTP エラーが特定ステータスかどうかを判定する。
 * raiseHttpError が投げる Error には status プロパティが付与されている。
 */
const isHttpStatusError = (error: unknown, status: number): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  return (error as { status?: number }).status === status;
};

// ────────────────────────────────────────────────────────────────────────────
// SharePoint Repository
// ────────────────────────────────────────────────────────────────────────────

interface SharePointSupportPlanDraftRepositoryOptions {
  acquireToken?: () => Promise<string | null>;
  listTitle?: string;
  /** DI: spFetch (createSpClient 経由で生成) */
  spFetch?: SpFetchFn;
}

/**
 * SharePoint implementation of SupportPlanDraftRepository.
 *
 * Storage strategy:
 * - One SharePoint item per draft
 * - Form data (17 fields) stored as JSON in FormDataJson column
 * - Title = `<userCode>:<draftId>` for composite key lookups
 * - Status tracks lifecycle: draft → confirmed → obsolete
 *
 * Required SharePoint columns:
 * - Title (Single line text): composite key
 * - DraftId (Single line text): client-side UUID
 * - UserCode (Single line text): links to Users_Master.UserID
 * - DraftName (Single line text): display name
 * - FormDataJson (Multiple lines text): JSON of SupportPlanForm
 * - Status (Choice): draft | confirmed | obsolete
 * - SchemaVersion (Number): currently 2
 */
export class SharePointSupportPlanDraftRepository implements SupportPlanDraftRepository {
  private readonly spFetch: SpFetchFn;
  private readonly listTitle: string;

  constructor(options: SharePointSupportPlanDraftRepositoryOptions = {}) {
    if (!options.spFetch) {
      throw new Error(
        '[SharePointSupportPlanDraftRepository] spFetch is required. Use factory to create instances.',
      );
    }
    this.spFetch = options.spFetch;
    this.listTitle = options.listTitle ?? getListTitle();
  }

  // ── listDrafts ──────────────────────────────────────────────────────────

  async listDrafts(params?: SupportPlanListParams): Promise<SupportPlanDraft[]> {
    if (params?.signal?.aborted) return [];

    try {
      const listPath = buildListPath();

      const queryParams = new URLSearchParams();
      queryParams.set('$select', joinSelect(SUPPORT_PLANS_SELECT_FIELDS));
      queryParams.set('$orderby', `${SUPPORT_PLANS_FIELDS.created} asc`);
      queryParams.set('$top', '100');

      // Build OData filter
      const filters: string[] = [];
      if (params?.userCode) {
        filters.push(`${SUPPORT_PLANS_FIELDS.userCode} eq '${params.userCode}'`);
      }
      if (params?.status) {
        const statuses = Array.isArray(params.status) ? params.status : [params.status];
        if (statuses.length === 1) {
          filters.push(`${SUPPORT_PLANS_FIELDS.status} eq '${statuses[0]}'`);
        } else {
          const statusFilter = statuses
            .map((s) => `${SUPPORT_PLANS_FIELDS.status} eq '${s}'`)
            .join(' or ');
          filters.push(`(${statusFilter})`);
        }
      }
      if (filters.length > 0) {
        queryParams.set('$filter', filters.join(' and '));
      }

      const url = `${listPath}/items?${queryParams.toString()}`;
      // throwOnError: true — エラーは自動 throw
      const response = await this.spFetch(url);

      const payload = await response.json() as { value?: unknown[] };
      const items = payload.value ?? [];

      const results: SupportPlanDraft[] = [];
      for (const item of items) {
        const parsed = supportPlanSpRowSchema.safeParse(item);
        if (parsed.success) {
          const draft = mapSpRowToDraft(parsed.data);
          if (draft) results.push(draft);
        } else {
          console.warn('[SharePointSupportPlanDraftRepository] Row parse failed', parsed.error);
        }
      }

      return results;
    } catch (error) {
      const safeError = toSafeError(error);
      console.error('[SharePointSupportPlanDraftRepository] listDrafts failed', safeError.message);
      throw safeError;
    }
  }

  // ── saveDraft ───────────────────────────────────────────────────────────

  async saveDraft(draft: SupportPlanDraft): Promise<void> {
    try {
      const listPath = buildListPath();

      const compositeKey = `${draft.userCode ?? '_'}:${draft.id}`;
      const itemData = {
        Title: compositeKey,
        [SUPPORT_PLANS_FIELDS.draftId]: draft.id,
        [SUPPORT_PLANS_FIELDS.userCode]: draft.userCode ?? '',
        [SUPPORT_PLANS_FIELDS.draftName]: draft.name,
        [SUPPORT_PLANS_FIELDS.formDataJson]: JSON.stringify(draft.data),
        [SUPPORT_PLANS_FIELDS.status]: 'draft',
        [SUPPORT_PLANS_FIELDS.schemaVersion]: 2,
      };

      // Try to find existing item by DraftId
      const existing = await this.findByDraftId(draft.id);

      if (existing) {
        // Update existing — throwOnError: true
        const updateUrl = `${listPath}/items(${existing.Id})`;
        await this.spFetch(updateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=verbose',
            'Accept': 'application/json;odata=verbose',
            'IF-MATCH': '*',
            'X-HTTP-Method': 'MERGE',
          },
          body: JSON.stringify(itemData),
        });
      } else {
        // Create new — throwOnError: true
        const createUrl = `${listPath}/items`;
        await this.spFetch(createUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=verbose',
            'Accept': 'application/json;odata=verbose',
          },
          body: JSON.stringify(itemData),
        });
      }
    } catch (error) {
      const safeError = toSafeError(error);
      console.error('[SharePointSupportPlanDraftRepository] saveDraft failed', {
        draftId: draft.id,
        error: safeError.message,
      });
      throw safeError;
    }
  }

  // ── deleteDraft ─────────────────────────────────────────────────────────

  async deleteDraft(draftId: string): Promise<void> {
    try {
      const existing = await this.findByDraftId(draftId);
      if (!existing) {
        // Already deleted or never existed — idempotent
        return;
      }

      const listPath = buildListPath();
      const deleteUrl = `${listPath}/items(${existing.Id})`;

      try {
        await this.spFetch(deleteUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json;odata=verbose',
            'IF-MATCH': '*',
            'X-HTTP-Method': 'DELETE',
          },
        });
      } catch (deleteError) {
        // 404 は冪等削除として無視（既に削除済み）
        if (isHttpStatusError(deleteError, 404)) return;
        throw deleteError;
      }
    } catch (error) {
      const safeError = toSafeError(error);
      console.error('[SharePointSupportPlanDraftRepository] deleteDraft failed', {
        draftId,
        error: safeError.message,
      });
      throw safeError;
    }
  }

  // ── bulkSave ────────────────────────────────────────────────────────────

  async bulkSave(drafts: SupportPlanDraft[]): Promise<void> {
    // Sequential saves (SharePoint batch is overkill for ≤32 items)
    for (const draft of drafts) {
      await this.saveDraft(draft);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async findByDraftId(draftId: string): Promise<{ Id: number } | null> {
    try {
      const listPath = buildListPath();

      const filter = `${SUPPORT_PLANS_FIELDS.draftId} eq '${draftId}'`;
      const queryParams = new URLSearchParams();
      queryParams.set('$filter', filter);
      queryParams.set('$select', 'Id');
      queryParams.set('$top', '1');

      const url = `${listPath}/items?${queryParams.toString()}`;

      try {
        const response = await this.spFetch(url);
        const payload = await response.json() as { value?: Array<{ Id: number }> };
        const items = payload.value ?? [];
        return items.length > 0 ? items[0] : null;
      } catch (fetchError) {
        // findByDraftId はルックアップ用途 — HTTP エラーは null に変換
        if (isHttpStatusError(fetchError, 404)) return null;
        // その他のエラーも null（既存動作維持: try/catch で null 返却）
        return null;
      }
    } catch {
      return null;
    }
  }

  /** Check if list exists (for diagnostics). */
  async checkListExists(): Promise<boolean> {
    try {
      const listPath = buildListPath();
      await this.spFetch(`${listPath}?$select=Id`);
      return true;
    } catch {
      return false;
    }
  }
}
