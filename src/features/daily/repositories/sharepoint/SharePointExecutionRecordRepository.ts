import type { SpFetchFn } from '@/lib/sp/spLists';
import type { ExecutionRecord, RecordStatus } from '../../domain/legacy/executionRecordTypes';
import type { ExecutionRecordRepository, ExecutionRecordUpsertOptions } from '../../domain/legacy/ExecutionRecordRepository';
import { 
  getListTitle, 
  getRowsListTitle, 
  DAILY_RECORD_FIELDS,
  SharePointResponse,
  type ResolvedRowsFields,
  type ResolvedParentFields
} from './constants';
import type { JsonRecord } from '@/lib/sp/types';
import { DailyRecordSchemaResolver } from './modules/SchemaResolver';
import { normalizeScheduleItemId } from '@/features/daily/utils/normalizeScheduleItemId';
import { isKioskRecordDebugEnabled } from '@/lib/debug/kioskRecordDebug';
import { readSharePointText } from './utils/readSharePointText';
import {
  normalizeExecutionDate,
  normalizeExecutionUserId,
  buildExecutionUserIdCandidates,
  extractProcedureRowKey,
} from '@/features/daily/utils/normalizeExecutionLookup';

type SharePointExecutionRecordRepositoryOptions = {
  spFetch: SpFetchFn;
  getListFieldInternalNames?: (listTitle: string) => Promise<Set<string>>;
  store?: {
    getRecords: (date: string, userId: string) => ExecutionRecord[];
    upsertRecord: (record: ExecutionRecord, options?: ExecutionRecordUpsertOptions) => void;
    deleteRecord?: (date: string, userId: string, scheduleItemId: string) => void;
  };
};

type SharePointRecordLookup = {
  internalId: number;
  record: ExecutionRecord;
};

type ParentCandidate = {
  id: number;
  title: string;
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
  private resolvedParentFields: ResolvedParentFields | null = null;
  private resolvedParentPath: string | null = null;
  private resolvedChildPath: string | null = null;
  private resolvedFieldsPromise: Promise<ResolvedRowsFields> | null = null;
  private availableFields = new Map<string, Set<string>>();
  private initPromises = new Map<string, Promise<void>>();
  private entityTypes = new Map<string, string>();
  private parentRecordIds = new Map<string, number>();
  private parentRecordPromises = new Map<string, Promise<number>>();
  private recoverySchemaValidationPromise: Promise<void> | null = null;

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
    if (this.resolvedFieldsPromise) return this.resolvedFieldsPromise;

    this.resolvedFieldsPromise = (async () => {
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

      const [parentFields, rowsFields] = await Promise.all([
        this.resolver.resolveParentFields(this.resolvedParentPath),
        this.resolver.resolveRowsFields(this.resolvedChildPath),
      ]);

      this.resolvedParentFields = parentFields;
      this.resolvedFields = rowsFields;
      return rowsFields;
    })();

    try {
      return await this.resolvedFieldsPromise;
    } catch (error) {
      this.resolvedFieldsPromise = null;
      throw error;
    }
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

  private getSelectFields(rf: ResolvedRowsFields): string {
    const fields = new Set<string>(['Id', 'Title', 'Created', 'Modified']);
    fields.add(rf.parentId);
    fields.add(rf.userId);
    fields.add(rf.status);
    fields.add(rf.payload);
    fields.add(rf.recordedAt);
    fields.add(rf.rowKey);
    if (rf.rowNo) fields.add(rf.rowNo);
    if (rf.memo) fields.add(rf.memo);
    if (rf.staffName) fields.add(rf.staffName);
    if (rf.bipsJSON) fields.add(rf.bipsJSON);
    return Array.from(fields).join(',');
  }

  private getNextDateIso(dateIso: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      throw new Error(`[ExecutionRepo] Invalid execution date for parent lookup: ${dateIso}`);
    }

    const date = new Date(dateIso);
    date.setDate(date.getDate() + 1);
    const nextDateIso = date.toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDateIso)) {
      throw new Error(`[ExecutionRepo] Failed to serialize next execution date: ${dateIso}`);
    }
    return nextDateIso;
  }

  private async validateRecoverySchemaFields(rf: ResolvedRowsFields): Promise<void> {
    if (this.recoverySchemaValidationPromise) {
      return this.recoverySchemaValidationPromise;
    }

    this.recoverySchemaValidationPromise = (async () => {
      const pf = this.resolvedParentFields;
      if (!pf?.title || !pf.recordDate || !rf.parentId || !rf.rowKey) {
        throw new Error('[ExecutionRepo] Recovery schema fields could not be resolved.');
      }

      if (!this.getListFieldInternalNames) return;

      let parentFieldNames: Set<string>;
      let childFieldNames: Set<string>;
      try {
        [parentFieldNames, childFieldNames] = await Promise.all([
          this.getListFieldInternalNames(this.parentListTitle),
          this.getListFieldInternalNames(this.childListTitle),
        ]);
      } catch (error) {
        void error;
        throw new Error('[ExecutionRepo] Recovery schema field resolution failed.');
      }

      if (
        !parentFieldNames?.has(pf.title) ||
        !parentFieldNames.has(pf.recordDate) ||
        !childFieldNames?.has(rf.parentId) ||
        !childFieldNames.has(rf.rowKey)
      ) {
        throw new Error('[ExecutionRepo] Recovery schema fields are not present in SharePoint.');
      }
    })();

    try {
      await this.recoverySchemaValidationPromise;
    } catch (error) {
      this.recoverySchemaValidationPromise = null;
      throw error;
    }
  }

  private async resolveParentCandidates(
    normalizedDate: string,
    userId: string,
    rf: ResolvedRowsFields,
  ): Promise<ParentCandidate[]> {
    await this.validateRecoverySchemaFields(rf);
    const pf = this.resolvedParentFields;
    if (!pf || !this.resolvedParentPath) {
      throw new Error('[ExecutionRepo] Parent schema path could not be resolved.');
    }

    const nextDate = this.getNextDateIso(normalizedDate);
    const filter = `${pf.recordDate} ge '${this.escapeODataString(normalizedDate)}' and ${pf.recordDate} lt '${this.escapeODataString(nextDate)}'`;
    const select = ['Id', pf.title, pf.recordDate].filter((field, index, fields) => fields.indexOf(field) === index).join(',');
    const url = `${this.resolvedParentPath}/items?$filter=${encodeURIComponent(filter)}&$select=${select}`;
    const response = await this.spFetch(url);
    if (!response.ok) {
      throw new Error(`[ExecutionRepo] Parent lookup failed: ${response.status} ${response.statusText}`);
    }

    const data: SharePointResponse<JsonRecord> = await response.json();
    const candidates = new Set(
      buildExecutionUserIdCandidates(userId).map((candidate) => `${normalizedDate}-${candidate}`),
    );
    const matches: ParentCandidate[] = [];

    for (const item of data.value ?? []) {
      const title = readSharePointText(item[pf.title]);
      if (!candidates.has(title)) continue;

      const id = item.Id;
      if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
        throw new Error('[ExecutionRepo] Resolved parent ID is not numeric.');
      }
      matches.push({ id, title });
    }

    return matches;
  }

  private async getRowsByParentId(rf: ResolvedRowsFields, parentId: number): Promise<JsonRecord[]> {
    if (!Number.isSafeInteger(parentId) || parentId <= 0) {
      throw new Error('[ExecutionRepo] ParentID must be a positive numeric integer.');
    }
    if (!this.resolvedChildPath) {
      throw new Error('[ExecutionRepo] Child schema path could not be resolved.');
    }

    const filter = `${rf.parentId} eq ${parentId}`;
    const select = this.getSelectFields(rf);
    const url = `${this.resolvedChildPath}/items?$filter=${encodeURIComponent(filter)}&$select=${select}`;
    const response = await this.spFetch(url);
    if (!response.ok) {
      throw new Error(`[ExecutionRepo] Child lookup failed: ${response.status} ${response.statusText}`);
    }

    const data: SharePointResponse<JsonRecord> = await response.json();
    return data.value ?? [];
  }

  private mergeExecutionRecords(records: ExecutionRecord[]): ExecutionRecord[] {
    const merged = new Map<string, ExecutionRecord>();
    for (const record of records) {
      const normalizedScheduleItemId = normalizeScheduleItemId(record.scheduleItemId);
      const key = normalizedScheduleItemId
        ? `${normalizeExecutionDate(record.date)}\u0000${normalizedScheduleItemId}`
        : `${normalizeExecutionDate(record.date)}\u0000${normalizeExecutionUserId(record.userId)}\u0000${record.id}`;
      if (!merged.has(key)) merged.set(key, record);
    }
    return Array.from(merged.values());
  }

  private async ensureParentRecord(dailyKey: string, date: string, _userId: string): Promise<number> {
    const cachedId = this.parentRecordIds.get(dailyKey);
    if (cachedId) return cachedId;

    const cachedPromise = this.parentRecordPromises.get(dailyKey);
    if (cachedPromise) return cachedPromise;

    const promise = this.fetchOrCreateParentRecord(dailyKey, date, _userId)
      .then((id) => {
        this.parentRecordIds.set(dailyKey, id);
        return id;
      })
      .catch((error) => {
        this.parentRecordIds.delete(dailyKey);
        throw error;
      })
      .finally(() => {
        this.parentRecordPromises.delete(dailyKey);
      });

    this.parentRecordPromises.set(dailyKey, promise);
    return promise;
  }

  private async fetchOrCreateParentRecord(dailyKey: string, date: string, _userId: string): Promise<number> {
    await this.getResolvedFields(); // Ensure paths resolved
    const pf = this.resolvedParentFields!;
    const filter = `${pf.title} eq '${this.escapeODataString(dailyKey)}'`;
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
      [pf.title]: dailyKey,
      [pf.recordDate]: date,
      [pf.userCount]: 1,
      [pf.userRowsJSON]: '[]',
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

  private async getRecordLookupByRowKey(
    rf: ResolvedRowsFields,
    rowKey: string,
    normalizedDate: string,
    normalizedUserId: string,
    normalizedScheduleItemId: string,
  ): Promise<SharePointRecordLookup | undefined> {
    const parents = await this.resolveParentCandidates(normalizedDate, normalizedUserId, rf);
    const lookupProcedureRow = extractProcedureRowKey(normalizedScheduleItemId);
    for (const parent of parents) {
      const rows = await this.getRowsByParentId(rf, parent.id);
      for (const item of rows) {
        const mapped = this.mapToDomain(item, rf);
        const itemRowKey = readSharePointText(item[rf.rowKey]);
        const itemScheduleItemId = normalizeScheduleItemId(mapped.scheduleItemId);
        const itemProcedureRow =
          extractProcedureRowKey(itemScheduleItemId) || extractProcedureRowKey(itemRowKey);
        const exactMatch =
          itemRowKey === rowKey || itemScheduleItemId === normalizedScheduleItemId;
        // Canonical kiosk keys are procedure-N; legacy rows may store raw N / row-N.
        const procedureRowMatch =
          Boolean(lookupProcedureRow) &&
          Boolean(itemProcedureRow) &&
          lookupProcedureRow === itemProcedureRow;
        if (!exactMatch && !procedureRowMatch) continue;

        return {
          internalId: item.Id as number,
          record: {
            ...mapped,
            date: normalizedDate,
            userId: normalizedUserId,
            // Keep the persisted schedule identity when only the procedure-row
            // matched, so update/delete target the concrete legacy key.
            scheduleItemId: exactMatch ? normalizedScheduleItemId : itemScheduleItemId || normalizedScheduleItemId,
          },
        };
      }
    }

    return undefined;
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
    const select = this.getSelectFields(rf);
    const url = `${this.resolvedChildPath}/items?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=5000`;

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
    const rf = await this.getResolvedFields();

    const parents = await this.resolveParentCandidates(normalizedDate, userId, rf);
    const rows: JsonRecord[] = [];
    for (const parent of parents) {
      rows.push(...await this.getRowsByParentId(rf, parent.id));
    }

    const records = this.mergeExecutionRecords(rows.map((item) => this.mapToDomain(item, rf)));
    
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
    return (await this.getRecordLookupByRowKey(
      rf,
      rowKey,
      normalizedDate,
      normalizedUserId,
      normalizedScheduleItemId,
    ))?.record;
  }

  async upsertRecord(record: ExecutionRecord, options?: ExecutionRecordUpsertOptions): Promise<void> {
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

    const existingPromise = this.getRecordLookupByRowKey(
      rf,
      rowKey,
      normalizedDate,
      normalizedUserId,
      normalizedScheduleItemId,
    );
    const childFieldsPromise = this.initFields(this.childListTitle);

    const existingLookup = await existingPromise;
    const existing = existingLookup?.record;

    // Concurrency Protection: Merge memos if existing record has a different memo.
    let finalMemo = normalizedRecord.memo;
    if (
      options?.memoMode !== 'overwrite' &&
      existing &&
      existing.memo &&
      normalizedRecord.memo &&
      existing.memo !== normalizedRecord.memo
    ) {
      if (!existing.memo.includes(normalizedRecord.memo)) {
        const timeStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        const staffName = normalizedRecord.recordedBy || '職員';
        finalMemo = `${existing.memo}\n[${timeStr} ${staffName}] ${normalizedRecord.memo}`;
      } else {
        finalMemo = existing.memo;
      }
    } else if (existing && existing.memo && !normalizedRecord.memo) {
      finalMemo = existing.memo;
    }

    const mergedRecord = {
      ...normalizedRecord,
      memo: finalMemo,
    };

    const parentId = await this.ensureParentRecord(dailyKey, normalizedDate, normalizedUserId);
    await childFieldsPromise;

    const rawBody: Record<string, unknown> = {
      [rf.rowKey]: rowKey,
      [rf.parentId]: parentId,
      [rf.userId]: mergedRecord.userId,
      [rf.status]: mergedRecord.status,
      [rf.payload]: mergedRecord.memo, // Standard payload fallback
      [rf.recordedAt]: mergedRecord.recordedAt,
    };
    
    if (rf.rowNo) {
      const rawRowNo = extractProcedureRowKey(mergedRecord.scheduleItemId);
      if (rawRowNo) {
        rawBody[rf.rowNo] = Number.parseInt(rawRowNo, 10);
      } else {
        const fallbackNum = Number.parseInt(mergedRecord.scheduleItemId, 10);
        rawBody[rf.rowNo] = Number.isNaN(fallbackNum) ? mergedRecord.scheduleItemId : fallbackNum;
      }
    }
    if (rf.memo) rawBody[rf.memo] = mergedRecord.memo;
    if (rf.staffName) rawBody[rf.staffName] = mergedRecord.recordedBy;
    if (rf.bipsJSON) rawBody[rf.bipsJSON] = JSON.stringify(mergedRecord.triggeredBipIds);
    
    // Title is needed for POST (creation) but often ignored in MERGE if it doesn't change
    if (!existing) {
      rawBody[DAILY_RECORD_FIELDS.title] = mergedRecord.id;
    }

    const body = this.filterPayload(this.childListTitle, rawBody);

    if (existing) {
      if (existingLookup) {
        const internalId = existingLookup.internalId;
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
      this.store.upsertRecord(mergedRecord, options);
    }
  }

  async deleteRecord(date: string, userId: string, scheduleItemId: string): Promise<void> {
    const normalizedDate = normalizeExecutionDate(date);
    const normalizedUserId = normalizeExecutionUserId(userId);
    const normalizedScheduleItemId = normalizeScheduleItemId(scheduleItemId);
    const rf = await this.getResolvedFields();
    const rowKey = `${normalizedDate}-${normalizedUserId}-${normalizedScheduleItemId}`;

    // Same parent-first path as get/upsert so legacy Title / procedure-N aliases
    // remain deletable after LVT recovery (Title filter is no longer reliable).
    const existingLookup = await this.getRecordLookupByRowKey(
      rf,
      rowKey,
      normalizedDate,
      normalizedUserId,
      normalizedScheduleItemId,
    );

    if (existingLookup) {
      const deleteUrl = `${this.resolvedChildPath}/items(${existingLookup.internalId})`;
      const deleteResp = await this.spFetch(deleteUrl, {
        method: 'POST',
        headers: {
          'X-HTTP-Method': 'DELETE',
          'If-Match': '*',
        },
      });
      if (!deleteResp.ok) {
        throw new Error(`[ExecutionRepo] row delete failed: ${deleteResp.status} ${deleteResp.statusText}`);
      }
    }

    // Sync to local store using both requested and resolved identities.
    if (this.store && this.store.deleteRecord) {
      this.store.deleteRecord(normalizedDate, normalizedUserId, normalizedScheduleItemId);
      const resolvedScheduleItemId = normalizeScheduleItemId(existingLookup?.record.scheduleItemId);
      if (resolvedScheduleItemId && resolvedScheduleItemId !== normalizedScheduleItemId) {
        this.store.deleteRecord(normalizedDate, normalizedUserId, resolvedScheduleItemId);
      }
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
    const title = readSharePointText(item.Title) || readSharePointText(item.title);
    let triggeredBipIds: string[] = [];
    try {
      if (rf.bipsJSON && item[rf.bipsJSON]) {
        triggeredBipIds = JSON.parse(item[rf.bipsJSON] as string);
      }
    } catch (e) {
      console.warn('[ExecutionRepo] Failed to parse triggeredBipIds:', e);
    }

    let date = title.slice(0, 10);
    const userId = readSharePointText(item[rf.userId]);
    let scheduleItemId = '';

    // First attempt: extract scheduleItemId from Title or RowKey (composite keys)
    const keys = [title, readSharePointText(item[rf.rowKey])].filter(Boolean) as string[];
    for (const key of keys) {
      if (key.length > 11 && /^\d{4}-\d{2}-\d{2}-/.test(key)) {
        const parsedDate = key.slice(0, 10);
        const suffix = key.slice(11); // userId-scheduleItemId

        // Build user ID candidates including both current userId and any logical representations
        const userCandidates = buildExecutionUserIdCandidates(userId);
        // Sort candidates from longest to shortest to prevent prefix hijacking (e.g. matching "U" before "U-023" or similar)
        const sortedCandidates = [...userCandidates].sort((a, b) => b.length - a.length);
        let matchedCandidate: string | null = null;

        for (const candidate of sortedCandidates) {
          if (suffix.startsWith(`${candidate}-`)) {
            matchedCandidate = candidate;
            break;
          }
        }

        if (isKioskRecordDebugEnabled()) {
          console.debug(`[ExecutionRepo] mapToDomain - key: ${key}, userId: ${userId}, candidates: ${JSON.stringify(userCandidates)}, sorted: ${JSON.stringify(sortedCandidates)}, matched: ${matchedCandidate}`);
        }

        if (matchedCandidate) {
          if (!/^\d{4}-\d{2}-\d{2}/.test(date)) {
            date = parsedDate;
          }
          scheduleItemId = normalizeScheduleItemId(suffix.slice(matchedCandidate.length + 1)) || '';
          break;
        } else {
          // Secondary fallback: regex-based extraction if userId candidates didn't match
          // Try matching with keyword prefix first
          const kwMatch = suffix.match(/(?:^|.*[-_])(base|row|procedure|slot|step)[-_](\d+)$/i);
          if (kwMatch) {
            if (!/^\d{4}-\d{2}-\d{2}/.test(date)) {
              date = parsedDate;
            }
            const prefix = kwMatch[1];
            const digits = kwMatch[2];
            const separator = suffix.includes(`${prefix}_${digits}`) ? '_' : '-';
            scheduleItemId = `${prefix}${separator}${digits}`;
            break;
          }
          // Try matching digits only
          const digitsMatch = suffix.match(/(?:^|.*[-_])(\d+)$/i);
          if (digitsMatch) {
            if (!/^\d{4}-\d{2}-\d{2}/.test(date)) {
              date = parsedDate;
            }
            scheduleItemId = digitsMatch[1];
            break;
          }
        }
      }
    }

    // Fallback: use RowNo field if composite key parsing failed
    if (!scheduleItemId && rf.rowNo) {
      scheduleItemId = normalizeScheduleItemId(readSharePointText(item[rf.rowNo])) || '';
    }

    const rawStatus = String(item[rf.status] || '').trim();
    let status: RecordStatus = 'unrecorded';
    const s = rawStatus.toLowerCase();

    // Normalization logic for English & Japanese statuses
    if (s === 'completed' || s === 'done' || s === 'committed' || s === '完了' || s === '済') {
      status = 'completed';
    } else if (s === 'triggered' || s === '行動発生') {
      status = 'triggered';
    } else if (s === 'skipped' || s === 'スキップ' || s === '中止') {
      status = 'skipped';
    } else {
      // Fallback to strict domain enum if it matches exactly (already handled by toLowerCase above for English)
      if (['completed', 'triggered', 'skipped', 'unrecorded'].includes(s)) {
        status = s as RecordStatus;
      }
    }


    return {
      id: title,
      date, 
      userId,
      scheduleItemId,
      status: status,
      triggeredBipIds,
      memo: this.pickFirstNonEmptyString(
        rf.memo ? item[rf.memo] : undefined,
        item[rf.payload],
        item.Observation,
        item.observation,
      ),
      recordedBy: rf.staffName ? readSharePointText(item[rf.staffName]) : '',
      recordedAt: readSharePointText(item[rf.recordedAt])
        || readSharePointText(item.Created)
        || readSharePointText(item.Modified),
    };
  }
}
