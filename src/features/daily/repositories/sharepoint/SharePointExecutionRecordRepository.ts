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
import { normalizeScheduleItemId } from '@/features/daily/utils/normalizeScheduleItemId';
import {
  normalizeExecutionDate,
  normalizeExecutionUserId,
} from '@/features/daily/utils/normalizeExecutionLookup';

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
  private resolvedParentPath: string | null = null;
  private resolvedChildPath: string | null = null;
  private availableFields = new Map<string, Set<string>>();
  private initPromises = new Map<string, Promise<void>>();
  private entityTypes = new Map<string, string>();

  private escapeODataString(value: string): string {
    return value.replace(/'/g, "''");
  }

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

  private async getEntityType(listTitle: string): Promise<string> {
    const cached = this.entityTypes.get(listTitle);
    if (cached) return cached;
    try {
      const base = listTitle.startsWith('/') ? listTitle : `/lists/getbytitle('${encodeURIComponent(listTitle)}')`;
      const url = `${base}?$select=ListItemEntityTypeFullName`;
      const res = await this.spFetch(url);
      if (res.ok) {
        const data = await res.json();
        const type = data.ListItemEntityTypeFullName || data.d?.ListItemEntityTypeFullName;
        if (type) {
          this.entityTypes.set(listTitle, type);
          return type;
        }
      }
    } catch (e) {
      console.warn(`[ExecutionRepo] Failed to fetch ListItemEntityTypeFullName for ${listTitle}:`, e);
    }
    const cleanTitle = listTitle.replace(/[^a-zA-Z0-9]/g, '');
    const fallback = `SP.Data.${cleanTitle}ListItem`;
    this.entityTypes.set(listTitle, fallback);
    return fallback;
  }

  private async getResolvedFields(): Promise<ResolvedRowsFields> {
    if (this.resolvedFields) return this.resolvedFields;
    
    // Resolve paths first
    this.resolvedParentPath = await this.resolver.resolveListPath();
    if (!this.resolvedParentPath) {
      this.resolvedParentPath = `lists/getbytitle('${this.parentListTitle}')`;
    }
    this.resolvedChildPath = await this.resolver.resolveRowsPath(this.childListTitle);

    if (!this.resolvedChildPath) {
       // Fallback to direct path if resolution fails
       this.resolvedChildPath = `lists/getbytitle('${this.childListTitle}')`;
    }

    this.resolvedFields = await this.resolver.resolveRowsFields(this.resolvedChildPath);
    return this.resolvedFields!;
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

  private async ensureParentRecord(dailyKey: string, date: string, _userId: string): Promise<number> {
    await this.getResolvedFields(); // Ensure paths resolved
    const filter = `${DAILY_RECORD_FIELDS.title} eq '${dailyKey}'`;
    const url = `${this.resolvedParentPath}/items?$filter=${encodeURIComponent(filter)}&$select=Id`;
    
    const response = await this.spFetch(url, { method: 'GET' });
    if (!response.ok) throw new Error(`[ExecutionRepo] Parent lookup failed: ${response.statusText}`);
    
    const data: SharePointResponse<JsonRecord> = await response.json();
    if (data.value && data.value.length > 0) {
      return data.value[0].Id as number;
    }

    const createUrl = `${this.resolvedParentPath}/items`;
    
    await this.initFields(this.parentListTitle);
    const rawBody = {
      [DAILY_RECORD_FIELDS.title]: dailyKey,
      [DAILY_RECORD_FIELDS.recordDate]: date,
      [DAILY_RECORD_FIELDS.userCount]: 1,
      [DAILY_RECORD_FIELDS.latestVersion]: 1,
      [DAILY_RECORD_FIELDS.userRowsJSON]: '[]',
    };
    const body = this.filterPayload(this.parentListTitle, rawBody);

    const createResponse = await this.spFetch(createUrl, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json;odata=nometadata', 'Accept': 'application/json;odata=nometadata' }
    });

    if (createResponse.ok) {
      const result = await createResponse.json();
      return result.d ? result.d.Id : result.Id;
    }

    const secondAttemptResponse = await this.spFetch(url, { method: 'GET' });
    const secondData: SharePointResponse<JsonRecord> = await secondAttemptResponse.json();
    if (secondData.value && secondData.value.length > 0) {
      return secondData.value[0].Id as number;
    }

    throw new Error(`[ExecutionRepo] Failed to ensure parent record for ${dailyKey}`);
  }

  async getRecordsInRange(userId: string, from: string, to: string): Promise<ExecutionRecord[]> {
    const normalizedUserId = normalizeExecutionUserId(userId);
    const normalizedFrom = normalizeExecutionDate(from);
    const normalizedTo = normalizeExecutionDate(to);
    const rf = await this.getResolvedFields();

    // rowKey format: YYYY-MM-DD-userId-scheduleItemId
    // We filter by userId and date range in rowKey.
    // rowKey >= from and rowKey <= to + 'z' ensures we get all items for those dates.
    const filter = `(${rf.userId} eq '${normalizedUserId}') and (${rf.rowKey} ge '${normalizedFrom}') and (${rf.rowKey} le '${normalizedTo}z')`;
    const url = `${this.resolvedChildPath}/items?$filter=${encodeURIComponent(filter)}&$top=5000`;

    const response = await this.spFetch(url);
    if (!response.ok) {
      throw new Error(`[ExecutionRepo] getRecordsInRange failed: ${response.status} ${response.statusText}`);
    }

    const data: SharePointResponse<JsonRecord> = await response.json();
    if (!data.value) return [];

    return data.value.map((item: JsonRecord) => this.mapToDomain(item, rf));
  }

  async getRecords(date: string, userId: string): Promise<ExecutionRecord[]> {
    const normalizedDate = normalizeExecutionDate(date);
    const normalizedUserId = normalizeExecutionUserId(userId);
    const rf = await this.getResolvedFields();
    const dailyKey = `${normalizedDate}-${normalizedUserId}`;
    const rowKeyPrefix = dailyKey;
    
    // Safety check: if rf.rowKey is RowKey but was resolved without actual presence, OData will fail.
    // However, resolveInternalNames is supposed to be accurate. 
    // We lowercase startswith for maximum compatibility.
    const filter = `startswith(${rf.rowKey}, '${rowKeyPrefix}')`;
    const url = `${this.resolvedChildPath}/items?$filter=${encodeURIComponent(filter)}`;

    const response = await this.spFetch(url);
    if (!response.ok) {
      throw new Error(`[ExecutionRepo] getRecords failed: ${response.status} ${response.statusText}`);
    }

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
    const normalizedDate = normalizeExecutionDate(date);
    const normalizedUserId = normalizeExecutionUserId(userId);
    const normalizedScheduleItemId = normalizeScheduleItemId(scheduleItemId);
    const rf = await this.getResolvedFields();
    const rowKey = `${normalizedDate}-${normalizedUserId}-${normalizedScheduleItemId}`;
    const filter = `${rf.rowKey} eq '${rowKey}'`;
    const url = `${this.resolvedChildPath}/items?$filter=${encodeURIComponent(filter)}`;

    const response = await this.spFetch(url);
    if (!response.ok) return undefined;

    const data: SharePointResponse<JsonRecord> = await response.json();
    if (!data.value || data.value.length === 0) return undefined;

    return this.mapToDomain(data.value[0], rf);
  }

  async upsertRecord(record: ExecutionRecord): Promise<void> {
    const normalizedDate = normalizeExecutionDate(record.date);
    const normalizedUserId = normalizeExecutionUserId(record.userId);
    const normalizedScheduleItemId = normalizeScheduleItemId(record.scheduleItemId);
    const normalizedRecord = {
      ...record,
      date: normalizedDate,
      userId: normalizedUserId,
      scheduleItemId: normalizedScheduleItemId,
    };
    const rf = await this.getResolvedFields();
    const dailyKey = `${normalizedDate}-${normalizedUserId}`;
    const rowKey = `${dailyKey}-${normalizedScheduleItemId}`;

    const parentId = await this.ensureParentRecord(dailyKey, normalizedDate, normalizedUserId);
    const existing = await this.getRecord(normalizedDate, normalizedUserId, normalizedScheduleItemId);

    await this.initFields(this.childListTitle);
    const rawBody: Record<string, unknown> = {
      [rf.rowKey]: rowKey,
      [rf.parentId]: parentId,
      [rf.userId]: normalizedRecord.userId,
      [rf.status]: normalizedRecord.status,
      [rf.payload]: normalizedRecord.memo, // Standard payload fallback
      [rf.recordedAt]: normalizedRecord.recordedAt,
    };
    
    if (rf.rowNo) rawBody[rf.rowNo] = normalizedRecord.scheduleItemId;
    if (rf.memo) rawBody[rf.memo] = normalizedRecord.memo;
    if (rf.staffName) rawBody[rf.staffName] = normalizedRecord.recordedBy;
    if (rf.bipsJSON) rawBody[rf.bipsJSON] = JSON.stringify(normalizedRecord.triggeredBipIds);
    
    // Title is needed for POST (creation) but often ignored in MERGE if it doesn't change
    if (!existing) {
        rawBody[DAILY_RECORD_FIELDS.title] = normalizedRecord.id;
    }

    const body = this.filterPayload(this.childListTitle, rawBody);

    if (existing) {
      const filter = `${rf.rowKey} eq '${rowKey}'`;
      const searchUrl = `${this.resolvedChildPath}/items?$filter=${encodeURIComponent(filter)}&$select=Id`;
      const searchResp = await this.spFetch(searchUrl);
      if (!searchResp.ok) {
        throw new Error(`[ExecutionRepo] row search failed: ${searchResp.status} ${searchResp.statusText}`);
      }
      const searchData: SharePointResponse<JsonRecord> = await searchResp.json();
      
      if (searchData.value && searchData.value.length > 0) {
        const internalId = searchData.value[0].Id;
        const updateUrl = `${this.resolvedChildPath}/items(${internalId})`;
        const updateResp = await this.spFetch(updateUrl, {
          method: 'POST',
          headers: {
            'X-HTTP-Method': 'MERGE',
            'If-Match': '*',
            'Content-Type': 'application/json;odata=nometadata',
            'Accept': 'application/json;odata=nometadata'
          },
          body: JSON.stringify(body),
        });
        if (!updateResp.ok) {
          throw new Error(`[ExecutionRepo] row update failed: ${updateResp.status} ${updateResp.statusText}`);
        }
      }
    } else {
      const createUrl = `${this.resolvedChildPath}/items`;
      const createResp = await this.spFetch(createUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json;odata=nometadata',
          'Accept': 'application/json;odata=nometadata'
        },
        body: JSON.stringify(body),
      });
      if (!createResp.ok) {
        throw new Error(`[ExecutionRepo] row create failed: ${createResp.status} ${createResp.statusText}`);
      }
    }

    // Sync to local store
    if (this.store) {
      this.store.upsertRecord(normalizedRecord);
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

  async getHistoricalRecords(
    userId: string,
    scheduleItemId: string,
    limit?: number,
  ): Promise<ExecutionRecord[]> {
    const normalizedUserId = normalizeExecutionUserId(userId);
    const normalizedScheduleItemId = normalizeScheduleItemId(scheduleItemId);
    const escapedUserId = this.escapeODataString(normalizedUserId);
    const escapedScheduleItemId = this.escapeODataString(normalizedScheduleItemId);
    const rf = await this.getResolvedFields();
    
    // Safety: Limit history to approx 3 months to prevent large data transfers
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 95);
    const thresholdStr = threshold.toISOString().split('T')[0];

    // Build dynamic select to avoid querying non-existent columns
    const selectFields = ['Id', 'Title', 'Created', 'Modified', rf.userId, rf.status, rf.payload, rf.recordedAt];
    if (rf.rowKey) selectFields.push(rf.rowKey);
    if (rf.rowNo) selectFields.push(rf.rowNo);
    if (rf.memo) selectFields.push(rf.memo);
    if (rf.staffName) selectFields.push(rf.staffName);
    if (rf.bipsJSON) selectFields.push(rf.bipsJSON);
    
    const uniqueSelect = [...new Set(selectFields.filter((f): f is string => Boolean(f)))];

    // 1. Primary query: Try direct filtering ONLY if rowNo is physically resolved
    if (rf.rowNo) {
      const runPrimary = async (rowNoExpr: string): Promise<ExecutionRecord[] | null> => {
        const filter = `${rf.userId} eq '${escapedUserId}' and ${rf.rowNo} eq ${rowNoExpr} and ${rf.recordedAt} ge '${thresholdStr}'`;
        const url = `${this.resolvedChildPath}/items?$select=${uniqueSelect.join(',')}&$filter=${encodeURIComponent(filter)}&$orderby=${rf.recordedAt} desc${limit ? `&$top=${limit}` : ''}`;
        const response = await this.spFetch(url);
        if (!response.ok) {
          console.warn(`[ExecutionRepo] Primary history query failed (status: ${response.status}), fallback step next...`);
          return null;
        }
        const data: SharePointResponse<JsonRecord> = await response.json();
        return (data.value || []).map((item: JsonRecord) => this.mapToDomain(item, rf));
      };

      // Step 1: text comparison
      const textPrimary = await runPrimary(`'${escapedScheduleItemId}'`);
      if (textPrimary && textPrimary.length > 0) return textPrimary;

      // Step 2: numeric fallback (for Number rowNo columns)
      if (/^\d+$/.test(normalizedScheduleItemId)) {
        const numberPrimary = await runPrimary(String(Number.parseInt(normalizedScheduleItemId, 10)));
        if (numberPrimary && numberPrimary.length > 0) return numberPrimary;
      }
    }

    // 2. Fallback query: Filter by UserID + Date range and filter rows in-app
    // This is used when rowNo is missing or primary query fails.
    const fallbackSelect = uniqueSelect.filter(f => f !== rf.rowNo);
    const fallbackFilter = `${rf.userId} eq '${escapedUserId}' and (Created ge '${thresholdStr}' or ${rf.recordedAt} ge '${thresholdStr}')`;
    const fallbackUrl = `${this.resolvedChildPath}/items?$select=${fallbackSelect.join(',')}&$filter=${encodeURIComponent(fallbackFilter)}&$top=1000`;
    
    const fallbackRes = await this.spFetch(fallbackUrl);
    if (fallbackRes.ok) {
      const fallbackData: SharePointResponse<JsonRecord> = await fallbackRes.json();
      const items = fallbackData.value || [];
      return items
        .map((item: JsonRecord) => this.mapToDomain(item, rf))
        // Critical: filter by userId and scheduleItemId in-app
        .filter(r => r.userId === normalizedUserId && r.scheduleItemId === normalizedScheduleItemId)
        .sort((a, b) => (b.recordedAt || b.id).localeCompare(a.recordedAt || a.id))
        .slice(0, limit || 150);
    }

    console.warn('[ExecutionRepo] Both primary and fallback history queries failed.');
    return [];
  }

  private pickFirstNonEmptyString(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return '';
  }

  private mapToDomain(item: JsonRecord, rf: ResolvedRowsFields): ExecutionRecord {
    const title = (item.Title || item.title || '') as string;
    let triggeredBipIds: string[] = [];
    try {
      if (rf.bipsJSON && item[rf.bipsJSON]) {
        triggeredBipIds = JSON.parse(item[rf.bipsJSON] as string);
      }
    } catch (e) {
      console.warn('[ExecutionRepo] Failed to parse triggeredBipIds:', e);
    }

    let date = title.slice(0, 10);
    const userId = (item[rf.userId] || '') as string;
    let scheduleItemId = rf.rowNo ? normalizeScheduleItemId(item[rf.rowNo]) : '';

    // Fallback: extract scheduleItemId and/or date from composite key if missing or empty
    if (!scheduleItemId || !/^\d{4}-\d{2}-\d{2}/.test(date)) {
      const keys = [title, (item[rf.rowKey] || '') as string];
      for (const key of keys) {
        if (key.length > 11 && /^\d{4}-\d{2}-\d{2}-/.test(key)) {
          const parsedDate = key.slice(0, 10);
          const suffix = key.slice(11); // userId-scheduleItemId
          const userPrefix = `${userId}-`;
          if (suffix.startsWith(userPrefix)) {
            if (!/^\d{4}-\d{2}-\d{2}/.test(date)) {
              date = parsedDate;
            }
            if (!scheduleItemId) {
              scheduleItemId = normalizeScheduleItemId(suffix.slice(userPrefix.length));
            }
            break;
          }
        }
      }
    }

    return {
      id: title,
      date, 
      userId,
      scheduleItemId,
      status: item[rf.status] as RecordStatus,
      triggeredBipIds,
      memo: this.pickFirstNonEmptyString(
        rf.memo ? item[rf.memo] : undefined,
        item[rf.payload],
        item.Observation,
        item.observation,
      ),
      recordedBy: (rf.staffName ? item[rf.staffName] : '') as string,
      recordedAt: (item[rf.recordedAt] || item.Created || item.Modified || '') as string,
    };
  }
}
