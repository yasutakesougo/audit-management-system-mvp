import { toSafeError } from '@/lib/errors';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { auditLog } from '@/lib/debugLogger';
import {
    SUPPORT_PLANS_LIST_TITLE,
    SUPPORT_PLANS_CANDIDATES,
    SUPPORT_PLANS_ESSENTIALS,
} from '@/sharepoint/fields/supportPlanFields';
import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved 
} from '@/lib/sp/helpers';
import { reportResourceResolution } from '@/lib/data/dataProviderObservabilityStore';
import { buildEq } from '@/sharepoint/query/builders';
import type {
    SupportPlanDraftRepository,
    SupportPlanListParams,
} from '../domain/SupportPlanDraftRepository';
import type { SupportPlanDraft, SupportPlanForm } from '../types';
import { sanitizeForm } from '../utils/helpers';

type SupportPlanCandidateKeys = keyof typeof SUPPORT_PLANS_CANDIDATES;

interface SupportPlanResolvedFields extends Record<SupportPlanCandidateKeys, string | undefined> {
  draftId: string;
  userCode: string;
  formDataJson: string;
  select: string[];
  created?: string;
  modified?: string;
}

/**
 * DataProvider implementation of SupportPlanDraftRepository.
 */
export class DataProviderSupportPlanDraftRepository implements SupportPlanDraftRepository {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;
  private resolvedFields: SupportPlanResolvedFields | null = null;

  constructor(options: {
    provider: IDataProvider;
    listTitle?: string;
  }) {
    this.provider = options.provider;
    this.listTitle = options.listTitle ?? SUPPORT_PLANS_LIST_TITLE;
  }

  /**
   * List drafts, optionally filtered by user code and/or status.
   */
  async listDrafts(params?: SupportPlanListParams): Promise<SupportPlanDraft[]> {
    try {
      const fields = await this.resolveFields();
      if (!fields) return [];

      const filters: string[] = [];
      if (params?.userCode) {
        filters.push(buildEq(fields.userCode, params.userCode));
      }
      if (params?.status && fields.status) {
        const statuses = Array.isArray(params.status) ? params.status : [params.status];
        if (statuses.length === 1) {
          filters.push(buildEq(fields.status, statuses[0]));
        } else {
          const statusFilter = statuses
            .map((s) => buildEq(fields.status!, s))
            .join(' or ');
          filters.push(`(${statusFilter})`);
        }
      }

      const rows = await this.provider.listItems<Record<string, unknown>>(this.listTitle, {
        select: fields.select,
        filter: filters.length > 0 ? filters.join(' and ') : undefined,
        orderby: `${fields.created || 'Created'} asc`,
        signal: params?.signal
      });

      return rows.map(r => this.mapRowToDraft(r, fields)).filter((d): d is SupportPlanDraft => !!d);
    } catch (err) {
      auditLog.error('support-plan:repo', 'Failed to list drafts', err);
      throw toSafeError(err);
    }
  }

  /**
   * Save (create or update) a single draft.
   */
  async saveDraft(draft: SupportPlanDraft): Promise<void> {
    try {
      const fields = await this.resolveFields();
      if (!fields) throw new Error('Cannot resolve fields for SupportPlans');

      const compositeKey = `${draft.userCode ?? '_'}:${draft.id}`;
      const payload: Record<string, unknown> = {
        Title: compositeKey,
        [fields.draftId]: draft.id,
        [fields.userCode]: draft.userCode ?? '',
        [fields.draftName || 'DraftName']: draft.name,
        [fields.formDataJson]: JSON.stringify(draft.data),
        [fields.status || 'Status']: 'draft',
        [fields.schemaVersion || 'SchemaVersion']: 2,
      };

      // Find existing
      const existing = await this.provider.listItems<Record<string, unknown>>(this.listTitle, {
        select: ['Id'],
        filter: buildEq(fields.draftId, draft.id),
        top: 1
      });

      if (existing.length > 0) {
        const id = String(existing[0].Id);
        await this.provider.updateItem(this.listTitle, id, payload, { etag: '*' });
      } else {
        await this.provider.createItem(this.listTitle, payload);
      }
    } catch (err) {
      auditLog.error('support-plan:repo', 'Failed to save draft', err);
      throw toSafeError(err);
    }
  }

  /**
   * Delete a draft by its client-side draftId.
   */
  async deleteDraft(draftId: string): Promise<void> {
    try {
      const fields = await this.resolveFields();
      if (!fields) return;

      const existing = await this.provider.listItems<Record<string, unknown>>(this.listTitle, {
        select: ['Id'],
        filter: buildEq(fields.draftId, draftId),
        top: 1
      });

      if (existing.length > 0) {
        await this.provider.deleteItem(this.listTitle, String(existing[0].Id));
      }
    } catch (err) {
      auditLog.error('support-plan:repo', 'Failed to delete draft', err);
      throw toSafeError(err);
    }
  }

  /**
   * Bulk-save multiple drafts.
   */
  async bulkSave(drafts: SupportPlanDraft[]): Promise<void> {
    for (const draft of drafts) {
      await this.saveDraft(draft);
    }
  }

  private async resolveFields(): Promise<SupportPlanResolvedFields | null> {
    if (this.resolvedFields) return this.resolvedFields;

    try {
      const available = await this.provider.getFieldInternalNames(this.listTitle);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(
        available,
        SUPPORT_PLANS_CANDIDATES as unknown as Record<SupportPlanCandidateKeys, string[]>
      );

      const isHealthy = areEssentialFieldsResolved(resolved, [...SUPPORT_PLANS_ESSENTIALS] as SupportPlanCandidateKeys[]);
      
      reportResourceResolution({
        resourceName: 'SupportPlans',
        resolvedTitle: this.listTitle,
        fieldStatus: fieldStatus as Record<string, { resolvedName?: string; candidates: string[] }>,
        essentials: [...SUPPORT_PLANS_ESSENTIALS] as string[],
      });

      if (isHealthy) {
        const select = [
          'Id', 'Created', 'Modified',
          ...Object.values(resolved).filter((v): v is string => typeof v === 'string')
        ].filter((v, i, a) => a.indexOf(v) === i);

        this.resolvedFields = { 
          ...resolved, 
          select,
          draftId: resolved.draftId!,
          userCode: resolved.userCode!,
          formDataJson: resolved.formDataJson!,
        } as SupportPlanResolvedFields;
        return this.resolvedFields;
      }

      auditLog.warn('support-plan:repo', 'Essential fields missing for SupportPlans.', { 
        list: this.listTitle, 
        resolved 
      });
      return null;
    } catch (err) {
      reportResourceResolution({
        resourceName: 'SupportPlans',
        resolvedTitle: this.listTitle,
        fieldStatus: {},
        essentials: [...SUPPORT_PLANS_ESSENTIALS],
        error: String(err)
      });
      auditLog.error('support-plan:repo', 'Field resolution failed:', err);
      return null;
    }
  }

  private mapRowToDraft(row: Record<string, unknown>, fields: SupportPlanResolvedFields): SupportPlanDraft | null {

    try {
      const formDataJson = String(fields.formDataJson ? row[fields.formDataJson] : '{}');
      const formData: Partial<SupportPlanForm> = JSON.parse(formDataJson);
      
      return {
        id: String(fields.draftId ? row[fields.draftId] : ''),
        name: String(fields.draftName ? row[fields.draftName] : ''),
        createdAt: String(row.Created || (fields.created ? row[fields.created] : '') || new Date().toISOString()),
        updatedAt: String(row.Modified || (fields.modified ? row[fields.modified] : '') || new Date().toISOString()),
        userId: null,
        userCode: String(fields.userCode ? row[fields.userCode] : ''),
        data: sanitizeForm(formData),
      };
    } catch (err) {
      auditLog.warn('support-plan:repo', 'Failed to parse row', err);
      return null;
    }
  }
}

