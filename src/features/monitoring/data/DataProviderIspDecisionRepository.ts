import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { toSafeError } from '@/lib/errors';
import type { IspRecommendationDecision } from '../domain/ispRecommendationDecisionTypes';
import type {
  DecisionListFilter,
  IspDecisionRepository,
  SaveDecisionInput,
} from './IspDecisionRepository';
import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';

const DEFAULT_LIST_TITLE = 'IspRecommendationDecisions';

const SP_FIELDS = {
  title: 'Title',
  goalId: 'GoalId',
  userId: 'UserId',
  status: 'Status',
  decidedBy: 'DecidedBy',
  decidedAt: 'DecidedAt',
  note: 'Note',
  monitoringFrom: 'MonitoringFrom',
  monitoringTo: 'MonitoringTo',
  snapshotJson: 'SnapshotJson',
  created: 'Created',
  modified: 'Modified',
} as const;

const SELECT_FIELDS = [
  'Id',
  SP_FIELDS.title,
  SP_FIELDS.goalId,
  SP_FIELDS.userId,
  SP_FIELDS.status,
  SP_FIELDS.decidedBy,
  SP_FIELDS.decidedAt,
  SP_FIELDS.note,
  SP_FIELDS.monitoringFrom,
  SP_FIELDS.monitoringTo,
  SP_FIELDS.snapshotJson,
  SP_FIELDS.created,
  SP_FIELDS.modified,
];

/**
 * DataProviderIspDecisionRepository
 * 
 * IDataProvider ベースの IspDecisionRepository 実装。
 */
export class DataProviderIspDecisionRepository implements IspDecisionRepository {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;

  constructor(provider: IDataProvider, listTitle: string = DEFAULT_LIST_TITLE) {
    this.provider = provider;
    this.listTitle = listTitle;
  }

  async save(input: SaveDecisionInput): Promise<IspRecommendationDecision> {
    const id = this.generateId();
    try {
      const itemData: Record<string, unknown> = {
        [SP_FIELDS.title]: id,
        [SP_FIELDS.goalId]: input.goalId,
        [SP_FIELDS.userId]: input.userId,
        [SP_FIELDS.status]: input.status,
        [SP_FIELDS.decidedBy]: input.decidedBy,
        [SP_FIELDS.decidedAt]: input.decidedAt,
        [SP_FIELDS.note]: input.note,
        [SP_FIELDS.monitoringFrom]: input.monitoringPeriodFrom,
        [SP_FIELDS.monitoringTo]: input.monitoringPeriodTo,
        [SP_FIELDS.snapshotJson]: JSON.stringify(input.snapshot),
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
      const filters: string[] = [`${SP_FIELDS.userId} eq '${filter.userId}'`];

      if (filter.goalId) {
        filters.push(`${SP_FIELDS.goalId} eq '${filter.goalId}'`);
      }

      if (filter.monitoringPeriod) {
        filters.push(`${SP_FIELDS.monitoringFrom} eq '${filter.monitoringPeriod.from}'`);
        filters.push(`${SP_FIELDS.monitoringTo} eq '${filter.monitoringPeriod.to}'`);
      }

      const limit = filter.limit ?? SP_QUERY_LIMITS.default;
      const safeLimit = Math.min(Math.max(1, limit), SP_QUERY_LIMITS.hardMax);

      const items = await this.provider.listItems<Record<string, unknown>>(this.listTitle, {
        filter: filters.join(' and '),
        orderby: `${SP_FIELDS.decidedAt} desc`,
        top: safeLimit,
        select: SELECT_FIELDS,
      });

      return items.map(item => this.toDecision(item)).filter((d): d is IspRecommendationDecision => d !== null);
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
      const snapshotRaw = item[SP_FIELDS.snapshotJson];
      const snapshot = typeof snapshotRaw === 'string' ? JSON.parse(snapshotRaw) : null;
      if (!snapshot) return null;

      return {
        id: String(item[SP_FIELDS.title] ?? ''),
        goalId: String(item[SP_FIELDS.goalId] ?? ''),
        userId: String(item[SP_FIELDS.userId] ?? ''),
        status: String(item[SP_FIELDS.status] ?? 'pending') as IspRecommendationDecision['status'],
        decidedBy: String(item[SP_FIELDS.decidedBy] ?? ''),
        decidedAt: String(item[SP_FIELDS.decidedAt] ?? ''),
        note: String(item[SP_FIELDS.note] ?? ''),
        monitoringPeriodFrom: String(item[SP_FIELDS.monitoringFrom] ?? ''),
        monitoringPeriodTo: String(item[SP_FIELDS.monitoringTo] ?? ''),
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
