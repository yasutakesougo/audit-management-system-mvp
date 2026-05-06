import type { SpFetchFn } from '@/lib/sp/spLists';
import type { ExecutionRecord, RecordStatus } from '../../domain/legacy/executionRecordTypes';
import type { ExecutionRecordRepository } from '../../domain/legacy/ExecutionRecordRepository';
import { 
  getListTitle, 
  getRowsListTitle, 
  DAILY_RECORD_FIELDS,
  SharePointResponse,
  type ResolvedRowsFields 
} from './constants';
import type { JsonRecord } from '@/lib/sp/types';
import { DailyRecordSchemaResolver } from './modules/SchemaResolver';
import { buildListPath } from './utils/Helpers';

type SharePointExecutionRecordRepositoryOptions = {
  spFetch: SpFetchFn;
  getListFieldInternalNames?: (listTitle: string) => Promise<Set<string>>;
  store?: {
    getRecords: (date: string, userId: string) => ExecutionRecord[];
    upsertRecord: (record: ExecutionRecord) => void;
  };
};

/**
 * SharePointExecutionRecordRepository — 17行記録の SharePoint 永続化アダプター
 * スキーマドリフト（Payload vs Memo等）を動的に解決する。
 */
export class SharePointExecutionRecordRepository implements ExecutionRecordRepository {
  private readonly spFetch: SpFetchFn;
  private readonly store?: SharePointExecutionRecordRepositoryOptions['store'];
  private readonly getListFieldInternalNames?: (listTitle: string) => Promise<Set<string>>;
  private readonly parentListTitle: string;
  private readonly childListTitle: string;
  private readonly resolver: DailyRecordSchemaResolver;
  
  private resolvedFields: ResolvedRowsFields | null = null;
  private availableFields = new Map<string, Set<string>>();
  private initPromises = new Map<string, Promise<void>>();

  constructor(options: SharePointExecutionRecordRepositoryOptions) {
    this.spFetch = options.spFetch;
    this.getListFieldInternalNames = options.getListFieldInternalNames;
    this.store = options.store;
    this.parentListTitle = getListTitle();
    this.childListTitle = getRowsListTitle();
    this.resolver = new DailyRecordSchemaResolver(
      this.spFetch, 
      this.parentListTitle,
      options.getListFieldInternalNames
    );
  }

  private async getResolvedFields(): Promise<ResolvedRowsFields> {
    if (this.resolvedFields) return this.resolvedFields;
    
    const rowsListPath = buildListPath(this.childListTitle);
    this.resolvedFields = await this.resolver.resolveRowsFields(rowsListPath);
    return this.resolvedFields;
  }

  private async initFields(listTitle: string): Promise<void> {
    if (!this.getListFieldInternalNames) return;
    if (this.availableFields.has(listTitle)) return;
    
    let promise = this.initPromises.get(listTitle);
    if (!promise) {
      promise = (async () => {
        try {
          const fieldSet = await this.getListFieldInternalNames!(listTitle);
          if (fieldSet) {
            this.availableFields.set(listTitle, fieldSet);
          }
        } catch (err) {
          console.warn(`[ExecutionRepo] Field resolution failed for ${listTitle}:`, err);
        }
      })();
      this.initPromises.set(listTitle, promise);
    }
    return promise;
  }

  private filterPayload(listTitle: string, payload: Record<string, unknown>): Record<string, unknown> {
    const fieldSet = this.availableFields.get(listTitle);
    if (!fieldSet || fieldSet.size === 0) return payload; // fail-open

    const activePayload: Record<string, unknown> = {};
    if (payload.Title !== undefined) activePayload.Title = payload.Title;

    for (const [k, v] of Object.entries(payload)) {
      if (k === 'Title') continue;
      //Case-insensitive match check for SharePoint flexibility
      const matchedKey = Array.from(fieldSet).find(f => f.toLowerCase() === k.toLowerCase());
      if (matchedKey) {
        activePayload[matchedKey] = v;
      }
    }
    return activePayload;
  }

  private async ensureParentRecord(dailyKey: string, date: string, userId: string): Promise<number> {
    const filter = `${DAILY_RECORD_FIELDS.title} eq '${dailyKey}'`;
    const url = `lists/getbytitle('${this.parentListTitle}')/items?$filter=${encodeURIComponent(filter)}&$select=Id`;
    
    const response = await this.spFetch(url, { method: 'GET' });
    if (!response.ok) throw new Error(`[ExecutionRepo] Parent lookup failed: ${response.statusText}`);
    
    const data: SharePointResponse<JsonRecord> = await response.json();
    if (data.value && data.value.length > 0) {
      return data.value[0].Id as number;
    }

    const createUrl = `lists/getbytitle('${this.parentListTitle}')/items`;
    
    await this.initFields(this.parentListTitle);
    const rawBody = {
      [DAILY_RECORD_FIELDS.title]: dailyKey,
      [DAILY_RECORD_FIELDS.recordDate]: date,
      UserId: userId, 
    };
    const body = this.filterPayload(this.parentListTitle, rawBody);

    const createResponse = await this.spFetch(createUrl, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json;odata=verbose', 'Accept': 'application/json;odata=verbose' }
    });

    if (createResponse.ok) {
      const result = await createResponse.json();
      return result.d.Id;
    }

    const secondAttemptResponse = await this.spFetch(url, { method: 'GET' });
    const secondData: SharePointResponse<JsonRecord> = await secondAttemptResponse.json();
    if (secondData.value && secondData.value.length > 0) {
      return secondData.value[0].Id as number;
    }

    throw new Error(`[ExecutionRepo] Failed to ensure parent record for ${dailyKey}`);
  }

  async getRecords(date: string, userId: string): Promise<ExecutionRecord[]> {
    const rf = await this.getResolvedFields();
    const dailyKey = `${date}-${userId}`;
    const rowKeyPrefix = dailyKey;
    const filter = `startsWith(${rf.rowKey}, '${rowKeyPrefix}')`;
    const url = `lists/getbytitle('${this.childListTitle}')/items?$filter=${encodeURIComponent(filter)}`;

    const response = await this.spFetch(url);
    if (!response.ok) return [];

    const data: SharePointResponse<JsonRecord> = await response.json();
    if (!data.value) return [];
    
    const records = data.value.map((item: JsonRecord) => this.mapToDomain(item, rf));
    
    // Sync to local store for reactive UI updates
    if (this.store) {
      records.forEach(r => this.store!.upsertRecord(r));
    }

    return records;
  }

  async getRecord(date: string, userId: string, scheduleItemId: string): Promise<ExecutionRecord | undefined> {
    const rf = await this.getResolvedFields();
    const rowKey = `${date}-${userId}-${scheduleItemId}`;
    const filter = `${rf.rowKey} eq '${rowKey}'`;
    const url = `lists/getbytitle('${this.childListTitle}')/items?$filter=${encodeURIComponent(filter)}`;

    const response = await this.spFetch(url);
    if (!response.ok) return undefined;

    const data: SharePointResponse<JsonRecord> = await response.json();
    if (!data.value || data.value.length === 0) return undefined;

    return this.mapToDomain(data.value[0], rf);
  }

  async upsertRecord(record: ExecutionRecord): Promise<void> {
    const rf = await this.getResolvedFields();
    const dailyKey = `${record.date}-${record.userId}`;
    const rowKey = `${dailyKey}-${record.scheduleItemId}`;

    const parentId = await this.ensureParentRecord(dailyKey, record.date, record.userId);
    const existing = await this.getRecord(record.date, record.userId, record.scheduleItemId);

    await this.initFields(this.childListTitle);
    const rawBody = {
      [rf.rowKey]: rowKey,
      [rf.parentId]: parentId,
      [rf.userId]: record.userId,
      [rf.rowNo]: record.scheduleItemId,
      [rf.status]: record.status,
      [rf.memo]: record.memo,
      [rf.payload]: record.memo, // Drift protection: map to both candidates
      [rf.staffName]: record.recordedBy,
      [rf.recordedAt]: record.recordedAt,
      [rf.bipsJSON]: JSON.stringify(record.triggeredBipIds),
    };
    
    // Title is needed for POST (creation) but often ignored in MERGE if it doesn't change
    if (!existing) {
        rawBody[DAILY_RECORD_FIELDS.title] = record.id;
    }

    const body = this.filterPayload(this.childListTitle, rawBody);

    if (existing) {
      const filter = `${rf.rowKey} eq '${rowKey}'`;
      const searchUrl = `lists/getbytitle('${this.childListTitle}')/items?$filter=${encodeURIComponent(filter)}&$select=Id`;
      const searchResp = await this.spFetch(searchUrl);
      const searchData: SharePointResponse<JsonRecord> = await searchResp.json();
      
      if (searchData.value && searchData.value.length > 0) {
        const internalId = searchData.value[0].Id;
        const updateUrl = `lists/getbytitle('${this.childListTitle}')/items(${internalId})`;
        await this.spFetch(updateUrl, {
          method: 'POST',
          headers: {
            'X-HTTP-Method': 'MERGE',
            'If-Match': '*',
            'Content-Type': 'application/json;odata=verbose'
          },
          body: JSON.stringify(body),
        });
      }
    } else {
      const createUrl = `lists/getbytitle('${this.childListTitle}')/items`;
      await this.spFetch(createUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;odata=verbose' },
        body: JSON.stringify(body),
      });
    }

    // Sync to local store
    if (this.store) {
      this.store.upsertRecord(record);
    }
  }

  async getCompletionRate(
    date: string, 
    userId: string, 
    totalSlots: number
  ): Promise<{ completed: number; triggered: number; rate: number }> {
    const records = await this.getRecords(date, userId);
    const completed = records.filter(r => r.status === 'completed').length;
    const triggered = records.filter(r => r.status === 'triggered').length;
    const rate = totalSlots > 0 ? (completed + triggered) / totalSlots : 0;
    return { completed, triggered, rate };
  }

  private mapToDomain(item: JsonRecord, rf: ResolvedRowsFields): ExecutionRecord {
    const title = (item.Title || item.title || '') as string;
    return {
      id: title,
      date: title.slice(0, 10), 
      userId: (item[rf.userId] || '') as string,
      scheduleItemId: (item[rf.rowNo] || '') as string,
      status: item[rf.status] as RecordStatus,
      triggeredBipIds: item[rf.bipsJSON] ? JSON.parse(item[rf.bipsJSON] as string) : [],
      memo: (item[rf.memo] || item[rf.payload] || '') as string,
      recordedBy: (item[rf.staffName] || '') as string,
      recordedAt: (item[rf.recordedAt] || '') as string,
    };
  }
}
