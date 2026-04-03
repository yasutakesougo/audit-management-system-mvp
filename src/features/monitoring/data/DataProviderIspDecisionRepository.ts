import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { toSafeError } from '@/lib/errors';
import type { IspRecommendationDecision } from '../domain/ispRecommendationDecisionTypes';
import type {
  DecisionListFilter,
  IspDecisionRepository,
  SaveDecisionInput,
} from './IspDecisionRepository';
import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';
import { buildEq } from '@/sharepoint/query/builders';
import { 
  ISP_DECISION_LIST_TITLE, 
  ISP_DECISION_CANDIDATES, 
  ISP_DECISION_ESSENTIALS 
} from '@/sharepoint/fields/ispThreeLayerFields';
import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved,
  washRows
} from '@/lib/sp/helpers';
import { reportResourceResolution } from '@/lib/data/dataProviderObservabilityStore';

const DEFAULT_LIST_TITLE = ISP_DECISION_LIST_TITLE;

// SELECT_FIELDS is now dynamic during resolveFields

/**
 * DataProviderIspDecisionRepository
 * 
 * IDataProvider ベースの IspDecisionRepository 実装。
 */
export class DataProviderIspDecisionRepository implements IspDecisionRepository {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;

  private resolvedFields: Record<string, string | undefined> | null = null;

  constructor(provider: IDataProvider, listTitle: string = DEFAULT_LIST_TITLE) {
    this.provider = provider;
    this.listTitle = listTitle;
  }

  /**
   * フィールド解決 (Dynamic Schema Resolution)
   */
  private async resolveFields(): Promise<Record<string, string | undefined>> {
    if (this.resolvedFields) return this.resolvedFields;

    try {
      const available = await this.provider.getFieldInternalNames(this.listTitle);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(
        new Set(available),
        (ISP_DECISION_CANDIDATES as unknown) as Record<string, string[]>
      );

      const isHealthy = areEssentialFieldsResolved(resolved, ISP_DECISION_ESSENTIALS as unknown as string[]);

      // Observability への報告
      reportResourceResolution({
        resourceName: `IspDecisions:${this.listTitle}`,
        resolvedTitle: this.listTitle,
        fieldStatus: fieldStatus as Record<string, { resolvedName?: string; candidates: string[] }>,
        essentials: ISP_DECISION_ESSENTIALS as unknown as string[],
      });

      if (!isHealthy) {
        console.warn(`[IspDecisionRepository] Essential fields missing in list ${this.listTitle}.`);
      }

      this.resolvedFields = resolved as Record<string, string | undefined>;
      return this.resolvedFields;
    } catch (err) {
      console.error('[IspDecisionRepository] Field resolution failed:', err);
      // フォールバック
      const fallback: Record<string, string> = {};
      for (const [key, cands] of Object.entries((ISP_DECISION_CANDIDATES as unknown) as Record<string, string[]>)) {
        fallback[key] = (cands as string[])[0];
      }
      return fallback;
    }
  }

  async save(input: SaveDecisionInput): Promise<IspRecommendationDecision> {
    const id = this.generateId();
    try {
      const mapping = await this.resolveFields();
      
      const itemData: Record<string, unknown> = {
        [mapping.title || 'Title']: id,
        [mapping.goalId || 'GoalId']: input.goalId,
        [mapping.userId || 'UserId']: input.userId,
        [mapping.status || 'Status']: input.status,
        [mapping.decidedBy || 'DecidedBy']: input.decidedBy,
        [mapping.decidedAt || 'DecidedAt']: input.decidedAt,
        [mapping.note || 'Note']: input.note,
        [mapping.monitoringFrom || 'MonitoringFrom']: input.monitoringPeriodFrom,
        [mapping.monitoringTo || 'MonitoringTo']: input.monitoringPeriodTo,
        [mapping.snapshotJson || 'SnapshotJson']: JSON.stringify(input.snapshot),
      };

      await this.provider.createItem(this.listTitle, itemData);
      return { ...input, id };
    } catch (error) {
      const safeError = toSafeError(error);
      console.error('[DataProviderIspDecisionRepository] Save failed', {
        goalId: input.goalId,
        error: safeError.message,
      });
      throw safeError;
    }
  }

  async list(filter: DecisionListFilter & { limit?: number }): Promise<IspRecommendationDecision[]> {
    if (filter.signal?.aborted) return [];

    try {
      const mapping = await this.resolveFields();
      const filters: string[] = [buildEq(mapping.userId || 'UserId', filter.userId)];

      if (filter.goalId) {
        filters.push(buildEq(mapping.goalId || 'GoalId', filter.goalId));
      }

      if (filter.monitoringPeriod) {
        filters.push(buildEq(mapping.monitoringFrom || 'MonitoringFrom', filter.monitoringPeriod.from));
        filters.push(buildEq(mapping.monitoringTo || 'MonitoringTo', filter.monitoringPeriod.to));
      }

      const limit = filter.limit ?? SP_QUERY_LIMITS.default;
      const safeLimit = Math.min(Math.max(1, limit), SP_QUERY_LIMITS.hardMax);

      const selectFields = Object.values(mapping).filter((v): v is string => !!v);

      const items = await this.provider.listItems<Record<string, unknown>>(this.listTitle, {
        filter: filters.join(' and '),
        orderby: `${mapping.decidedAt || 'DecidedAt'} desc`,
        top: safeLimit,
        select: selectFields.length > 0 ? ['Id', ...selectFields] : undefined,
      });

      const washed = washRows(items, (ISP_DECISION_CANDIDATES as unknown) as Record<string, string[]>, mapping);
      return washed.map(item => this.toDecision(item)).filter((d): d is IspRecommendationDecision => d !== null);
    } catch (error) {
      const safeError = toSafeError(error);
      console.error('[DataProviderIspDecisionRepository] List failed', {
        userId: filter.userId,
        error: safeError.message,
      });
      throw safeError;
    }
  }

  private toDecision(item: Record<string, unknown>): IspRecommendationDecision | null {
    try {
      // washRow により、item[candidates[key][0]] に値が入っていることが保証される
      const primary = (ISP_DECISION_CANDIDATES as unknown) as Record<string, string[]>;
      
      const snapshotRaw = item[primary.snapshotJson[0]];
      const snapshot = typeof snapshotRaw === 'string' ? JSON.parse(snapshotRaw) : null;
      if (!snapshot) return null;

      return {
        id: String(item[primary.title[0]] ?? ''),
        goalId: String(item[primary.goalId[0]] ?? ''),
        userId: String(item[primary.userId[0]] ?? ''),
        status: String(item[primary.status[0]] ?? 'pending') as IspRecommendationDecision['status'],
        decidedBy: String(item[primary.decidedBy[0]] ?? ''),
        decidedAt: String(item[primary.decidedAt[0]] ?? ''),
        note: String(item[primary.note[0]] ?? ''),
        monitoringPeriodFrom: String(item[primary.monitoringFrom[0]] ?? ''),
        monitoringPeriodTo: String(item[primary.monitoringTo[0]] ?? ''),
        snapshot,
      };
    } catch {
      return null;
    }
  }

  private generateId(): string {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
