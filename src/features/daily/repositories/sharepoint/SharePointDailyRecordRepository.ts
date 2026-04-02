import type { SpFetchFn } from '@/lib/sp/spLists';
import type {
    ApproveRecordInput,
    DailyRecordItem,
    DailyRecordRepository,
    DailyRecordRepositoryListParams,
    DailyRecordRepositoryMutationParams,
    SaveDailyRecordInput,
} from '../../domain/legacy/DailyRecordRepository';
import { 
    getListTitle,
    readNonEmptyEnv 
} from './constants';
import { buildListPath } from './utils/Helpers';
import { DailyRecordSchemaResolver } from './modules/SchemaResolver';
import { DailyRecordDataAccess } from './modules/DataAccess';
import { DailyRecordSaver } from './modules/Saver';
import { DailyRecordIntegrityScanner } from './modules/IntegrityScanner';
import { RowAggregateAccess } from './modules/RowAggregateAccess';
import { DailyIntegrityException } from '../../domain/integrity/dailyIntegrityChecker';

type SharePointDailyRecordRepositoryOptions = {
  listTitle?: string;
  spFetch?: SpFetchFn;
};

/**
 * SharePoint implementation of DailyRecordRepository
 * Optimized and Refactored into specialized modules.
 */
export class SharePointDailyRecordRepository implements DailyRecordRepository {
  private readonly spFetch: SpFetchFn;
  private readonly listTitle: string;
  
  private readonly schema: DailyRecordSchemaResolver;
  private readonly data: DailyRecordDataAccess;
  private readonly saver: DailyRecordSaver;
  private readonly integrity: DailyRecordIntegrityScanner;
  private readonly rowAggregate: RowAggregateAccess;

  constructor(options: SharePointDailyRecordRepositoryOptions = {}) {
    if (!options.spFetch) {
      throw new Error(
        '[SharePointDailyRecordRepository] spFetch is required.',
      );
    }
    this.spFetch = options.spFetch;
    this.listTitle = options.listTitle ?? getListTitle();

    this.schema = new DailyRecordSchemaResolver(this.spFetch, this.listTitle);
    this.data = new DailyRecordDataAccess(this.spFetch);
    this.saver = new DailyRecordSaver(this.spFetch);
    this.integrity = new DailyRecordIntegrityScanner(this.spFetch);
    this.rowAggregate = new RowAggregateAccess(this.spFetch);
  }

  private getRowsListTitle(): string {
    return readNonEmptyEnv('VITE_SP_LIST_PROCEDURE_RECORD_ROWS') ?? 'DailyRecordRows';
  }

  async save(
    input: SaveDailyRecordInput,
    params?: DailyRecordRepositoryMutationParams,
  ): Promise<void> {
    const listPath = await this.schema.resolveListPath();
    if (!listPath) {
        throw new Error(`Daily records list not found: ${this.listTitle}`);
    }
    const rowsListPath = buildListPath(this.getRowsListTitle());
    const existingItem = await this.data.findItemByDate(input.date, listPath, params?.signal);

    return this.saver.save(input, listPath, rowsListPath, existingItem, params);
  }

  async load(date: string): Promise<DailyRecordItem | null> {
    const listPath = await this.schema.resolveListPath();
    if (!listPath) return null;
    return this.data.load(date, listPath, this.getRowsListTitle());
  }

  async list(params: DailyRecordRepositoryListParams & { limit?: number }): Promise<DailyRecordItem[]> {
    const listPath = await this.schema.resolveListPath();
    if (!listPath) {
        const rowAggregateSource = await this.schema.resolveRowAggregateSource();
        if (!rowAggregateSource) return [];
        return this.rowAggregate.list(rowAggregateSource, params);
    }
    return this.data.list(params, listPath);
  }

  async approve(
    input: ApproveRecordInput,
    params?: DailyRecordRepositoryMutationParams,
  ): Promise<DailyRecordItem> {
    const listPath = await this.schema.resolveListPath();
    if (!listPath) throw new Error(`Daily records list not found: ${this.listTitle}`);

    const existingItem = await this.data.findItemByDate(input.date, listPath, params?.signal);
    if (!existingItem) {
        throw new Error(`Record not found for date: ${input.date}`);
    }

    return this.saver.approve(input, listPath, existingItem, params);
  }

  async scanIntegrity(dates: string[], signal?: AbortSignal): Promise<DailyIntegrityException[]> {
    const listPath = await this.schema.resolveListPath();
    if (!listPath) return [];
    return this.integrity.scan(dates, listPath, this.getRowsListTitle(), signal);
  }

  async checkListExists(): Promise<boolean> {
    const listPath = await this.schema.resolveListPath();
    return Boolean(listPath);
  }
}
