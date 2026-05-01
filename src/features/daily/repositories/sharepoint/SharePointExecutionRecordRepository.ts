import type { SpFetchFn } from '@/lib/sp/spLists';
import type { ExecutionRecord, RecordStatus } from '../../domain/legacy/executionRecordTypes';
import type { ExecutionRecordRepository } from '../../domain/legacy/ExecutionRecordRepository';
import { 
  getListTitle, 
  getRowsListTitle, 
  EXECUTION_RECORD_FIELDS, 
  DAILY_RECORD_FIELDS,
  SharePointResponse 
} from './constants';
import type { JsonRecord } from '@/lib/sp/types';

type SharePointExecutionRecordRepositoryOptions = {
  spFetch: SpFetchFn;
  getListFieldInternalNames?: (listTitle: string) => Promise<Set<string>>;
};

/**
 * SharePointExecutionRecordRepository — 19行記録の SharePoint 永続化アダプター
 */
export class SharePointExecutionRecordRepository implements ExecutionRecordRepository {
  private readonly spFetch: SpFetchFn;
  private readonly getListFieldInternalNames?: (listTitle: string) => Promise<Set<string>>;
  private readonly parentListTitle: string;
  private readonly childListTitle: string;
  
  private availableFields = new Map<string, Set<string>>();
  private initPromises = new Map<string, Promise<void>>();

  constructor(options: SharePointExecutionRecordRepositoryOptions) {
    this.spFetch = options.spFetch;
    this.getListFieldInternalNames = options.getListFieldInternalNames;
    this.parentListTitle = getListTitle();
    this.childListTitle = getRowsListTitle();
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
    // Title is almost always required/present
    if (payload.Title !== undefined) activePayload.Title = payload.Title;

    for (const [k, v] of Object.entries(payload)) {
      if (k === 'Title') continue;
      if (fieldSet.has(k)) {
        activePayload[k] = v;
      }
    }
    return activePayload;
  }

  private async ensureParentRecord(dailyKey: string, date: string, userId: string): Promise<number> {
    const filter = `${DAILY_RECORD_FIELDS.title} eq '${dailyKey}'`;
    const url = `_api/web/lists/getbytitle('${this.parentListTitle}')/items?$filter=${encodeURIComponent(filter)}&$select=Id`;
    
    const response = await this.spFetch(url, { method: 'GET' });
    if (!response.ok) throw new Error(`[ExecutionRepo] Parent lookup failed: ${response.statusText}`);
    
    const data: SharePointResponse<JsonRecord> = await response.json();
    if (data.value && data.value.length > 0) {
      return data.value[0].Id as number;
    }

    const createUrl = `_api/web/lists/getbytitle('${this.parentListTitle}')/items`;
    
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
    const dailyKey = `${date}-${userId}`;
    const rowKeyPrefix = dailyKey;
    const filter = `startsWith(${EXECUTION_RECORD_FIELDS.rowKey}, '${rowKeyPrefix}')`;
    const url = `_api/web/lists/getbytitle('${this.childListTitle}')/items?$filter=${encodeURIComponent(filter)}`;

    const response = await this.spFetch(url);
    if (!response.ok) return [];

    const data: SharePointResponse<JsonRecord> = await response.json();
    if (!data.value) return [];

    return data.value.map((item: JsonRecord) => this.mapToDomain(item));
  }

  async getRecord(date: string, userId: string, scheduleItemId: string): Promise<ExecutionRecord | undefined> {
    const rowKey = `${date}-${userId}-${scheduleItemId}`;
    const filter = `${EXECUTION_RECORD_FIELDS.rowKey} eq '${rowKey}'`;
    const url = `_api/web/lists/getbytitle('${this.childListTitle}')/items?$filter=${encodeURIComponent(filter)}`;

    const response = await this.spFetch(url);
    if (!response.ok) return undefined;

    const data: SharePointResponse<JsonRecord> = await response.json();
    if (!data.value || data.value.length === 0) return undefined;

    return this.mapToDomain(data.value[0]);
  }

  async upsertRecord(record: ExecutionRecord): Promise<void> {
    const dailyKey = `${record.date}-${record.userId}`;
    const rowKey = `${dailyKey}-${record.scheduleItemId}`;

    const parentId = await this.ensureParentRecord(dailyKey, record.date, record.userId);
    const existing = await this.getRecord(record.date, record.userId, record.scheduleItemId);

    await this.initFields(this.childListTitle);
    const rawBody = {
      [EXECUTION_RECORD_FIELDS.title]: record.id,
      [EXECUTION_RECORD_FIELDS.rowKey]: rowKey,
      [EXECUTION_RECORD_FIELDS.parentId]: parentId,
      [EXECUTION_RECORD_FIELDS.userId]: record.userId,
      [EXECUTION_RECORD_FIELDS.rowNo]: record.scheduleItemId,
      [EXECUTION_RECORD_FIELDS.status]: record.status,
      [EXECUTION_RECORD_FIELDS.memo]: record.memo,
      [EXECUTION_RECORD_FIELDS.staffName]: record.recordedBy,
      [EXECUTION_RECORD_FIELDS.recordedAt]: record.recordedAt,
      [EXECUTION_RECORD_FIELDS.bipsJSON]: JSON.stringify(record.triggeredBipIds),
    };
    const body = this.filterPayload(this.childListTitle, rawBody);

    if (existing) {
      const filter = `${EXECUTION_RECORD_FIELDS.rowKey} eq '${rowKey}'`;
      const searchUrl = `_api/web/lists/getbytitle('${this.childListTitle}')/items?$filter=${encodeURIComponent(filter)}&$select=Id`;
      const searchResp = await this.spFetch(searchUrl);
      const searchData: SharePointResponse<JsonRecord> = await searchResp.json();
      
      if (searchData.value && searchData.value.length > 0) {
        const internalId = searchData.value[0].Id;
        const updateUrl = `_api/web/lists/getbytitle('${this.childListTitle}')/items(${internalId})`;
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
      const createUrl = `_api/web/lists/getbytitle('${this.childListTitle}')/items`;
      await this.spFetch(createUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;odata=verbose' },
        body: JSON.stringify(body),
      });
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

  private mapToDomain(item: JsonRecord): ExecutionRecord {
    const title = (item[EXECUTION_RECORD_FIELDS.title] || '') as string;
    return {
      id: title,
      date: title.slice(0, 10), 
      userId: (item[EXECUTION_RECORD_FIELDS.userId] || '') as string,
      scheduleItemId: (item[EXECUTION_RECORD_FIELDS.rowNo] || '') as string,
      status: item[EXECUTION_RECORD_FIELDS.status] as RecordStatus,
      triggeredBipIds: item[EXECUTION_RECORD_FIELDS.bipsJSON] ? JSON.parse(item[EXECUTION_RECORD_FIELDS.bipsJSON] as string) : [],
      memo: (item[EXECUTION_RECORD_FIELDS.memo] || '') as string,
      recordedBy: (item[EXECUTION_RECORD_FIELDS.staffName] || '') as string,
      recordedAt: (item[EXECUTION_RECORD_FIELDS.recordedAt] || '') as string,
    };
  }
}
