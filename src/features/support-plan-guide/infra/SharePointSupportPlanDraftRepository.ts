import { get as getEnv } from '@/env';
import { toSafeError } from '@/lib/errors';
import { fetchSp } from '@/lib/fetchSp';
import { createSpClient, ensureConfig } from '@/lib/spClient';

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

const buildListPath = (baseUrl: string): string => {
  const listTitle = getListTitle();
  return `${baseUrl}/_api/web/lists/GetByTitle('${encodeURIComponent(listTitle)}')`;
};

/** Read error body from SharePoint response. */
const readSpErrorMessage = async (response: Response): Promise<string> => {
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return (
        json?.error?.message?.value ??
        json?.['odata.error']?.message?.value ??
        json?.error_description ??
        text.slice(0, 500)
      );
    } catch {
      return text.slice(0, 500);
    }
  } catch {
    return `HTTP ${response.status}`;
  }
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

// ────────────────────────────────────────────────────────────────────────────
// SharePoint Repository
// ────────────────────────────────────────────────────────────────────────────

interface SharePointSupportPlanDraftRepositoryOptions {
  acquireToken?: () => Promise<string | null>;
  listTitle?: string;
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
  private readonly acquireToken: () => Promise<string | null>;
  private readonly listTitle: string;
  private client: ReturnType<typeof createSpClient> | null = null;

  constructor(options: SharePointSupportPlanDraftRepositoryOptions = {}) {
    this.acquireToken = options.acquireToken ?? (async () => null);
    this.listTitle = options.listTitle ?? getListTitle();
  }

  private getClient(): ReturnType<typeof createSpClient> {
    if (!this.client) {
      const { baseUrl } = ensureConfig();
      this.client = createSpClient(this.acquireToken, baseUrl);
    }
    return this.client;
  }

  // ── listDrafts ──────────────────────────────────────────────────────────

  async listDrafts(params?: SupportPlanListParams): Promise<SupportPlanDraft[]> {
    if (params?.signal?.aborted) return [];

    try {
      const { baseUrl } = ensureConfig();
      const listPath = buildListPath(baseUrl);

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
      const response = await fetchSp(url);

      if (!response.ok) {
        const message = await readSpErrorMessage(response);
        throw new Error(`Failed to list support plans: ${message}`);
      }

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
      const { baseUrl } = ensureConfig();
      const listPath = buildListPath(baseUrl);

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
        // Update existing
        const updateUrl = `${listPath}/items(${existing.Id})`;
        const response = await fetchSp(updateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=verbose',
            'Accept': 'application/json;odata=verbose',
            'IF-MATCH': '*',
            'X-HTTP-Method': 'MERGE',
          },
          body: JSON.stringify(itemData),
        });

        if (!response.ok) {
          const message = await readSpErrorMessage(response);
          throw new Error(`Failed to update support plan draft: ${message}`);
        }
      } else {
        // Create new
        const createUrl = `${listPath}/items`;
        const response = await fetchSp(createUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=verbose',
            'Accept': 'application/json;odata=verbose',
          },
          body: JSON.stringify(itemData),
        });

        if (!response.ok) {
          const message = await readSpErrorMessage(response);
          throw new Error(`Failed to create support plan draft: ${message}`);
        }
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
      const { baseUrl } = ensureConfig();
      const listPath = buildListPath(baseUrl);

      const existing = await this.findByDraftId(draftId);
      if (!existing) {
        // Already deleted or never existed — idempotent
        return;
      }

      const deleteUrl = `${listPath}/items(${existing.Id})`;
      const response = await fetchSp(deleteUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json;odata=verbose',
          'IF-MATCH': '*',
          'X-HTTP-Method': 'DELETE',
        },
      });

      if (!response.ok && response.status !== 404) {
        const message = await readSpErrorMessage(response);
        throw new Error(`Failed to delete support plan draft: ${message}`);
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
      const { baseUrl } = ensureConfig();
      const listPath = buildListPath(baseUrl);

      const filter = `${SUPPORT_PLANS_FIELDS.draftId} eq '${draftId}'`;
      const queryParams = new URLSearchParams();
      queryParams.set('$filter', filter);
      queryParams.set('$select', 'Id');
      queryParams.set('$top', '1');

      const url = `${listPath}/items?${queryParams.toString()}`;
      const response = await fetchSp(url);

      if (!response.ok) return null;

      const payload = await response.json() as { value?: Array<{ Id: number }> };
      const items = payload.value ?? [];
      return items.length > 0 ? items[0] : null;
    } catch {
      return null;
    }
  }

  /** Check if list exists (for diagnostics). */
  async checkListExists(): Promise<boolean> {
    try {
      const { baseUrl } = ensureConfig();
      const listPath = buildListPath(baseUrl);
      const response = await fetchSp(`${listPath}?$select=Id`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ── Singleton export ──
export const sharePointSupportPlanDraftRepository = new SharePointSupportPlanDraftRepository();
