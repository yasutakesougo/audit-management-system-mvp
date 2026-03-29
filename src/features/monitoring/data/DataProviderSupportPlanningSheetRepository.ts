import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { toSafeError } from '@/lib/errors';
import type {
  SupportPlanningSheetRecord,
  SaveSupportPlanningSheetInput,
  SupportPlanningSheetFilter,
} from '../domain/supportPlanningSheetTypes';
import type { SupportPlanningSheetRepository } from './SupportPlanningSheetRepository';
import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';

const DEFAULT_LIST_TITLE = 'SupportPlanningSheet_Master';

const SP_FIELDS = {
  id: 'Title',
  userId: 'UserId',
  goalId: 'GoalId',
  goalLabel: 'GoalLabel',
  decisionStatus: 'DecisionStatus',
  decisionNote: 'DecisionNote',
  decisionBy: 'DecisionBy',
  decisionAt: 'DecisionAt',
  recommendationLevel: 'RecommendationLevel',
  snapshot: 'SnapshotJson',
} as const;

const SELECT_FIELDS = [
  'Id',
  ...Object.values(SP_FIELDS),
];

export class DataProviderSupportPlanningSheetRepository implements SupportPlanningSheetRepository {
  private readonly provider: IDataProvider;
  private readonly listTitle: string;

  constructor(provider: IDataProvider, listTitle: string = DEFAULT_LIST_TITLE) {
    this.provider = provider;
    this.listTitle = listTitle;
  }

  async save(input: SaveSupportPlanningSheetInput): Promise<SupportPlanningSheetRecord> {
    const id = this.generateId();
    try {
      const itemData: Record<string, unknown> = {
        [SP_FIELDS.id]: id,
        [SP_FIELDS.userId]: input.userId,
        [SP_FIELDS.goalId]: input.goalId,
        [SP_FIELDS.goalLabel]: input.goalLabel,
        [SP_FIELDS.decisionStatus]: input.decisionStatus,
        [SP_FIELDS.decisionNote]: input.decisionNote,
        [SP_FIELDS.decisionBy]: input.decisionBy,
        [SP_FIELDS.decisionAt]: input.decisionAt,
        [SP_FIELDS.recommendationLevel]: input.recommendationLevel,
        [SP_FIELDS.snapshot]: JSON.stringify(input.snapshot),
      };
      await this.provider.createItem(this.listTitle, itemData);
      return { ...input, id };
    } catch (error) {
      const safeError = toSafeError(error);
      console.error('[DataProviderSupportPlanningSheetRepository] Save failed', {
        userId: input.userId,
        error: safeError.message,
      });
      throw safeError;
    }
  }

  async list(filter: SupportPlanningSheetFilter): Promise<SupportPlanningSheetRecord[]> {
    if (filter.signal?.aborted) return [];
    try {
      const filters: string[] = [`${SP_FIELDS.userId} eq '${filter.userId}'`];
      if (filter.goalId) {
        filters.push(`${SP_FIELDS.goalId} eq '${filter.goalId}'`);
      }

      const items = await this.provider.listItems<Record<string, unknown>>(this.listTitle, {
        filter: filters.join(' and '),
        orderby: `${SP_FIELDS.decisionAt} desc`,
        top: SP_QUERY_LIMITS.default,
        select: SELECT_FIELDS,
        signal: filter.signal,
      });

      return items.map(item => this.toDomain(item)).filter((d): d is SupportPlanningSheetRecord => d !== null);
    } catch (error) {
      console.error('[DataProviderSupportPlanningSheetRepository] List failed', {
        userId: filter.userId,
        error: toSafeError(error).message,
      });
      return [];
    }
  }

  private toDomain(item: Record<string, unknown>): SupportPlanningSheetRecord | null {
    try {
      const snapshotRaw = item[SP_FIELDS.snapshot];
      const snapshot = typeof snapshotRaw === 'string' ? JSON.parse(snapshotRaw) : snapshotRaw;

      return {
        id: String(item[SP_FIELDS.id] ?? ''),
        userId: String(item[SP_FIELDS.userId] ?? ''),
        goalId: String(item[SP_FIELDS.goalId] ?? ''),
        goalLabel: String(item[SP_FIELDS.goalLabel] ?? ''),
        decisionStatus: String(item[SP_FIELDS.decisionStatus] ?? '') as SupportPlanningSheetRecord['decisionStatus'],
        decisionNote: String(item[SP_FIELDS.decisionNote] ?? ''),
        decisionBy: String(item[SP_FIELDS.decisionBy] ?? ''),
        decisionAt: String(item[SP_FIELDS.decisionAt] ?? ''),
        recommendationLevel: String(item[SP_FIELDS.recommendationLevel] ?? '') as SupportPlanningSheetRecord['recommendationLevel'],
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
