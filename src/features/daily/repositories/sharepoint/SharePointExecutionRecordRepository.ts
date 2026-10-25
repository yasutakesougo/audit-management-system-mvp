import type { SpFetchFn } from '@/lib/sp/spLists';
import type { ExecutionRecord, RecordStatus } from '../../domain/legacy/executionRecordTypes';
import {
  ExecutionTargetMismatchError,
  type ExecutionCandidateClassification,
  type ExecutionRecordRepository,
  type ExecutionRecordUpsertOptions,
} from '../../domain/legacy/ExecutionRecordRepository';
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
  parentId?: number;
  parentTitle?: string;
  storedDate?: string;
  storedUserId?: string;
  storedScheduleItemId?: string;
};

type ParentCandidate = {
  id: number;
  title: string;
};

export { ExecutionTargetMismatchError };

export const AMBIGUOUS_EXECUTION_RECORD = 'AMBIGUOUS_EXECUTION_RECORD';

export class AmbiguousExecutionRecordError extends Error {
  readonly code = AMBIGUOUS_EXECUTION_RECORD;

  constructor() {
    super(AMBIGUOUS_EXECUTION_RECORD);
    this.name = 'AmbiguousExecutionRecordError';
  }
}

const EXECUTION_LIST_PAGE_SIZE = 500;
const EXECUTION_MAX_DATA_PAGES = 50;

type ListLookupKind = 'Parent lookup' | 'Child lookup';

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

  private parentTitlesForUser(normalizedDate: string, userId: string): Set<string> {
    return new Set(
      buildExecutionUserIdCandidates(userId).map((candidate) => `${normalizedDate}-${candidate}`),
    );
  }

  private uniqueNormalizedIds(
    values: readonly string[],
    normalize: (value: string) => string,
  ): string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const value of values) {
      const normalized = normalize(value);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      ordered.push(normalized);
    }
    return ordered;
  }

  private readPositiveItemId(item: JsonRecord, invalidIdMessage: string): number {
    const raw = item.Id ?? item.ID;
    if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw <= 0) {
      throw new Error(invalidIdMessage);
    }
    return raw;
  }

  private buildIdKeysetPath(
    listPath: string,
    filter: string,
    select: string,
    lastId: number,
  ): string {
    if (!Number.isSafeInteger(lastId) || lastId < 0) {
      throw new Error('[ExecutionRepo] Invalid paging cursor.');
    }
    // Repository-built relative path only. Server nextLink values are never copied here.
    const pagedFilter = `(${filter}) and ID gt ${lastId}`;
    return `${listPath}/items?$filter=${encodeURIComponent(pagedFilter)}&$select=${select}&$orderby=${encodeURIComponent('ID asc')}&$top=${EXECUTION_LIST_PAGE_SIZE}`;
  }

  private readPageRows(payload: unknown, failureLabel: ListLookupKind): JsonRecord[] {
    const fail = (): never => {
      throw new Error(`[ExecutionRepo] ${failureLabel} failed: unrecognized response shape`);
    };
    if (!payload || typeof payload !== 'object') return fail();
    const body = payload as Record<string, unknown>;
    if ('value' in body) {
      if (!Array.isArray(body.value)) return fail();
      return body.value as JsonRecord[];
    }
    const verbose = body.d;
    if (verbose && typeof verbose === 'object' && 'results' in verbose) {
      const results = (verbose as Record<string, unknown>).results;
      if (!Array.isArray(results)) return fail();
      return results as JsonRecord[];
    }
    return fail();
  }

  private async readAllPages(
    listPath: string,
    filter: string,
    select: string,
    failureLabel: ListLookupKind,
  ): Promise<JsonRecord[]> {
    if (/^[a-z][a-z+.-]*:/i.test(listPath)) {
      throw new Error(`[ExecutionRepo] ${failureLabel} failed: refusing absolute list path`);
    }
    const invalidIdMessage = failureLabel === 'Parent lookup'
      ? '[ExecutionRepo] Resolved parent ID is not numeric.'
      : '[ExecutionRepo] Child item ID is not numeric.';
    const rows: JsonRecord[] = [];
    let lastId = 0;
    let dataPages = 0;

    // One extra fetch is the empty completion page. A 51st page that still
    // contains rows exceeds the data-page cap and discards everything read.
    for (let pageIndex = 0; pageIndex <= EXECUTION_MAX_DATA_PAGES; pageIndex += 1) {
      const url = this.buildIdKeysetPath(listPath, filter, select, lastId);
      const response = await this.spFetch(url);
      if (!response.ok) {
        throw new Error(`[ExecutionRepo] ${failureLabel} failed: ${response.status} ${response.statusText}`);
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error(`[ExecutionRepo] ${failureLabel} failed: unparseable JSON`);
      }
      const page = this.readPageRows(payload, failureLabel);
      if (page.length === 0) return rows;

      let previous = lastId;
      for (const item of page) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          throw new Error(invalidIdMessage);
        }
        const id = this.readPositiveItemId(item, invalidIdMessage);
        if (id <= previous) {
          throw new Error(`[ExecutionRepo] ${failureLabel} failed: non-monotonic ID`);
        }
        previous = id;
      }

      dataPages += 1;
      if (dataPages > EXECUTION_MAX_DATA_PAGES) {
        throw new Error(`[ExecutionRepo] ${failureLabel} failed: page limit exceeded`);
      }
      rows.push(...page);
      lastId = previous;
    }

    throw new Error(`[ExecutionRepo] ${failureLabel} failed: page limit exceeded`);
  }

  private async fetchParentPage(
    normalizedDate: string,
    rf: ResolvedRowsFields,
  ): Promise<ParentCandidate[]> {
    await this.validateRecoverySchemaFields(rf);
    const pf = this.resolvedParentFields;
    if (!pf || !this.resolvedParentPath) {
      throw new Error('[ExecutionRepo] Parent schema path could not be resolved.');
    }

    const nextDate = this.getNextDateIso(normalizedDate);
    const filter = `${pf.recordDate} ge '${this.escapeODataString(normalizedDate)}' and ${pf.recordDate} lt '${this.escapeODataString(nextDate)}'`;
    const select = ['Id', pf.title, pf.recordDate]
      .filter((field, index, fields) => fields.indexOf(field) === index)
      .join(',');
    const items = await this.readAllPages(
      this.resolvedParentPath,
      filter,
      select,
      'Parent lookup',
    );
    return items.map((item) => ({
      id: this.readPositiveItemId(item, '[ExecutionRepo] Resolved parent ID is not numeric.'),
      title: readSharePointText(item[pf.title]),
    }));
  }

  private async resolveParentCandidates(
    normalizedDate: string,
    userId: string,
    rf: ResolvedRowsFields,
  ): Promise<ParentCandidate[]> {
    const titles = this.parentTitlesForUser(normalizedDate, userId);
    const parents = await this.fetchParentPage(normalizedDate, rf);
    return parents.filter((parent) => titles.has(parent.title));
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
    return this.readAllPages(
      this.resolvedChildPath,
      filter,
      select,
      'Child lookup',
    );
  }

  private getRowsByParentIdCached(
    rf: ResolvedRowsFields,
    parentId: number,
    cache: Map<number, Promise<JsonRecord[]>>,
  ): Promise<JsonRecord[]> {
    const cached = cache.get(parentId);
    if (cached) return cached;
    const pending = this.getRowsByParentId(rf, parentId);
    cache.set(parentId, pending);
    return pending;
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

  private async ensureParentRecord(
    dailyKey: string,
    date: string,
    _userId: string,
    candidateUserIds?: readonly string[],
  ): Promise<number> {
    const candidateKeys = candidateUserIds && candidateUserIds.length > 0
      ? candidateUserIds.map((u) => `${date}-${u}`)
      : [dailyKey];

    for (const key of candidateKeys) {
      const cachedId = this.parentRecordIds.get(key);
      if (cachedId) return cachedId;
      const cachedPromise = this.parentRecordPromises.get(key);
      if (cachedPromise) return cachedPromise;
    }

    const promise = this.fetchOrCreateParentRecord(dailyKey, date, _userId, candidateKeys)
      .then((id) => {
        for (const key of candidateKeys) {
          this.parentRecordIds.set(key, id);
        }
        return id;
      })
      .catch((error) => {
        for (const key of candidateKeys) {
          this.parentRecordIds.delete(key);
        }
        throw error;
      })
      .finally(() => {
        for (const key of candidateKeys) {
          this.parentRecordPromises.delete(key);
        }
      });

    for (const key of candidateKeys) {
      this.parentRecordPromises.set(key, promise);
    }
    return promise;
  }

  private async fetchOrCreateParentRecord(
    dailyKey: string,
    date: string,
    _userId: string,
    candidateKeys?: readonly string[],
  ): Promise<number> {
    await this.getResolvedFields(); // Ensure paths resolved
    const pf = this.resolvedParentFields!;
    const keysToCheck = candidateKeys && candidateKeys.length > 0 ? candidateKeys : [dailyKey];

    for (const key of keysToCheck) {
      const filter = `${pf.title} eq '${this.escapeODataString(key)}'`;
      const url = `${this.resolvedParentPath}/items?$filter=${encodeURIComponent(filter)}&$select=Id`;

      const response = await this.spFetch(url, { method: 'GET' });
      if (!response.ok) throw new Error(`[ExecutionRepo] Parent lookup failed: ${response.statusText}`);

      const data: SharePointResponse<JsonRecord> = await response.json();
      if (data.value && data.value.length > 0) {
        return data.value[0].Id as number;
      }
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

    const fallbackFilter = `${pf.title} eq '${this.escapeODataString(dailyKey)}'`;
    const fallbackUrl = `${this.resolvedParentPath}/items?$filter=${encodeURIComponent(fallbackFilter)}&$select=Id`;
    const secondAttemptResponse = await this.spFetch(fallbackUrl, { method: 'GET' });
    const secondData: SharePointResponse<JsonRecord> = await secondAttemptResponse.json();
    if (secondData.value && secondData.value.length > 0) {
      return secondData.value[0].Id as number;
    }

    throw new Error(`[ExecutionRepo] Failed to ensure parent record for ${dailyKey}`);
  }

  private collectMatchingLookups(
    rows: readonly JsonRecord[],
    rf: ResolvedRowsFields,
    rowKey: string,
    normalizedDate: string,
    normalizedUserId: string,
    normalizedScheduleItemId: string,
    parent?: ParentCandidate,
  ): SharePointRecordLookup[] {
    const lookupProcedureRow = extractProcedureRowKey(normalizedScheduleItemId);
    const matches: SharePointRecordLookup[] = [];
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

      matches.push({
        internalId: this.readPositiveItemId(item, '[ExecutionRepo] Child item ID is not numeric.'),
        parentId: parent?.id,
        parentTitle: parent?.title,
        storedDate: mapped.date,
        storedUserId: mapped.userId,
        storedScheduleItemId: mapped.scheduleItemId,
        record: {
          ...mapped,
          date: normalizedDate,
          userId: mapped.userId,
          // Keep the persisted schedule identity when only the procedure-row
          // matched, so update/delete target the concrete legacy key.
          scheduleItemId: exactMatch ? normalizedScheduleItemId : itemScheduleItemId || normalizedScheduleItemId,
        },
      });
    }
    return matches;
  }

  private uniqueLookup(matches: readonly SharePointRecordLookup[]): SharePointRecordLookup | undefined {
    const distinct = new Map<number, SharePointRecordLookup>();
    for (const match of matches) {
      if (!distinct.has(match.internalId)) distinct.set(match.internalId, match);
    }
    if (distinct.size > 1) throw new AmbiguousExecutionRecordError();
    if (distinct.size === 0) return undefined;
    return distinct.values().next().value;
  }

  private async lookupPair(
    rf: ResolvedRowsFields,
    parents: readonly ParentCandidate[],
    childCache: Map<number, Promise<JsonRecord[]>>,
    rowKey: string,
    normalizedDate: string,
    normalizedUserId: string,
    normalizedScheduleItemId: string,
  ): Promise<SharePointRecordLookup | undefined> {
    const matches: SharePointRecordLookup[] = [];
    for (const parent of parents) {
      const rows = await this.getRowsByParentIdCached(rf, parent.id, childCache);
      matches.push(...this.collectMatchingLookups(
        rows,
        rf,
        rowKey,
        normalizedDate,
        normalizedUserId,
        normalizedScheduleItemId,
        parent,
      ));
    }
    return this.uniqueLookup(matches);
  }

  private async getRecordLookupByRowKey(
    rf: ResolvedRowsFields,
    rowKey: string,
    normalizedDate: string,
    normalizedUserId: string,
    normalizedScheduleItemId: string,
  ): Promise<SharePointRecordLookup | undefined> {
    const parents = await this.resolveParentCandidates(normalizedDate, normalizedUserId, rf);
    return this.lookupPair(
      rf,
      parents,
      new Map(),
      rowKey,
      normalizedDate,
      normalizedUserId,
      normalizedScheduleItemId,
    );
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

  async getRecords(
    date: string,
    userId: string,
    candidateUserIds: readonly string[] = [userId],
  ): Promise<ExecutionRecord[]> {
    const normalizedDate = normalizeExecutionDate(date);
    const rf = await this.getResolvedFields();
    const verifiedUserIds = buildExecutionUserIdCandidates(userId, candidateUserIds);
    const allowedUserIds = new Set(verifiedUserIds);
    const allowedParentTitles = new Set(
      verifiedUserIds.flatMap((candidate) => Array.from(this.parentTitlesForUser(normalizedDate, candidate))),
    );
    const allParents = await this.fetchParentPage(normalizedDate, rf);
    const parents = Array.from(new Map(
      allParents
        .filter((parent) => allowedParentTitles.has(parent.title))
        .map((parent) => [parent.id, parent] as const),
    ).values());
    const rows: JsonRecord[] = [];
    for (const parent of parents) {
      rows.push(...await this.getRowsByParentId(rf, parent.id));
    }

    const seenItemIds = new Set<number>();
    const mappedRecords = rows
      .filter((item) => {
        const itemId = this.readPositiveItemId(item, '[ExecutionRepo] Child item ID is not numeric.');
        if (seenItemIds.has(itemId)) return false;
        seenItemIds.add(itemId);
        return true;
      })
      .map((item) => this.mapToDomain(item, rf));

    // A child under a parent selected for this master row must itself identify
    // one of that row's verified ID forms. Treat an invalid/foreign child as a
    // mismatch instead of silently turning the parent into an empty day.
    if (mappedRecords.some((record) => !allowedUserIds.has(record.userId))) {
      throw new ExecutionTargetMismatchError();
    }

    const records = mappedRecords.filter((record) => (
      normalizeExecutionDate(record.date) === normalizedDate
      && Boolean(normalizeScheduleItemId(record.scheduleItemId))
    ));

    const seenSlots = new Set<string>();
    for (const record of records) {
      const slotId = normalizeScheduleItemId(record.scheduleItemId);
      const key = `${normalizedDate}\u0000${slotId}`;
      if (seenSlots.has(key)) throw new AmbiguousExecutionRecordError();
      seenSlots.add(key);
    }
    
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

  async getRecordForCandidates(
    date: string,
    userIds: readonly string[],
    scheduleItemIds: readonly string[],
  ): Promise<ExecutionRecord | undefined> {
    const normalizedDate = normalizeExecutionDate(date);
    const users = this.uniqueNormalizedIds(userIds, normalizeExecutionUserId);
    const schedules = this.uniqueNormalizedIds(scheduleItemIds, normalizeScheduleItemId);
    if (!normalizedDate || users.length === 0 || schedules.length === 0) return undefined;

    const rf = await this.getResolvedFields();
    const parents = await this.fetchParentPage(normalizedDate, rf);
    const childCache = new Map<number, Promise<JsonRecord[]>>();

    for (const userId of users) {
      const titles = this.parentTitlesForUser(normalizedDate, userId);
      const userParents = parents.filter((parent) => titles.has(parent.title));
      for (const scheduleItemId of schedules) {
        const rowKey = `${normalizedDate}-${userId}-${scheduleItemId}`;
        const match = await this.lookupPair(
          rf,
          userParents,
          childCache,
          rowKey,
          normalizedDate,
          userId,
          scheduleItemId,
        );
        if (match) return match.record;
      }
    }

    return undefined;
  }

  private lookupMatchesRequestedTarget(
    lookup: SharePointRecordLookup,
    normalizedDate: string,
    expandedUsers: readonly string[],
    requestedSchedules: readonly string[],
    allowedTitles: ReadonlySet<string>,
  ): boolean {
    const parentTitle = lookup.parentTitle ?? '';
    if (!parentTitle.startsWith(`${normalizedDate}-`) || !allowedTitles.has(parentTitle)) return false;
    if (lookup.storedDate && normalizeExecutionDate(lookup.storedDate) !== normalizedDate) return false;
    const storedUserId = normalizeExecutionUserId(lookup.storedUserId);
    if (!storedUserId || !expandedUsers.includes(storedUserId)) return false;
    const storedSchedule = normalizeScheduleItemId(lookup.storedScheduleItemId);
    if (!storedSchedule) return false;
    return requestedSchedules.some((scheduleItemId) => {
      if (storedSchedule === scheduleItemId) return true;
      const storedRow = extractProcedureRowKey(storedSchedule);
      const requestedRow = extractProcedureRowKey(scheduleItemId);
      return Boolean(storedRow) && storedRow === requestedRow;
    });
  }

  async classifyExecutionCandidates(
    date: string,
    userIds: readonly string[],
    scheduleItemIds: readonly string[],
  ): Promise<ExecutionCandidateClassification> {
    const normalizedDate = normalizeExecutionDate(date);
    const requestedUsers = this.uniqueNormalizedIds(userIds, normalizeExecutionUserId);
    const requestedSchedules = this.uniqueNormalizedIds(scheduleItemIds, normalizeScheduleItemId);
    if (!normalizedDate || requestedUsers.length === 0 || requestedSchedules.length === 0) {
      return { kind: 'absent' };
    }

    const expandedUsers = this.uniqueNormalizedIds(
      requestedUsers.flatMap((userId) => buildExecutionUserIdCandidates(userId)),
      normalizeExecutionUserId,
    );
    const allowedTitles = new Set<string>();
    for (const userId of expandedUsers) {
      for (const title of this.parentTitlesForUser(normalizedDate, userId)) {
        allowedTitles.add(title);
      }
    }

    const rf = await this.getResolvedFields();
    const parents = (await this.fetchParentPage(normalizedDate, rf))
      .filter((parent) => allowedTitles.has(parent.title));
    const childCache = new Map<number, Promise<JsonRecord[]>>();
    const matches: SharePointRecordLookup[] = [];
    const seenIds = new Set<number>();

    for (const parent of parents) {
      const rows = await this.getRowsByParentIdCached(rf, parent.id, childCache);
      for (const userId of expandedUsers) {
        for (const scheduleItemId of requestedSchedules) {
          const found = this.collectMatchingLookups(
            rows,
            rf,
            `${normalizedDate}-${userId}-${scheduleItemId}`,
            normalizedDate,
            userId,
            scheduleItemId,
            parent,
          );
          for (const match of found) {
            if (seenIds.has(match.internalId)) continue;
            seenIds.add(match.internalId);
            matches.push(match);
          }
        }
      }
    }

    let lookup: SharePointRecordLookup | undefined;
    try {
      lookup = this.uniqueLookup(matches);
    } catch (error) {
      if (error instanceof AmbiguousExecutionRecordError) return { kind: 'duplicate' };
      throw error;
    }
    if (!lookup) return { kind: 'absent' };
    if (!this.lookupMatchesRequestedTarget(
      lookup,
      normalizedDate,
      expandedUsers,
      requestedSchedules,
      allowedTitles,
    )) {
      return { kind: 'mismatch' };
    }
    return {
      kind: 'unique',
      internalId: lookup.internalId,
      record: lookup.record,
    };
  }

  private async classifyForWrite(
    date: string,
    userId: string,
    scheduleItemId: string,
    candidateUserIds?: readonly string[],
  ): Promise<Extract<ExecutionCandidateClassification, { kind: 'absent' | 'unique' }>> {
    const userIds = candidateUserIds && candidateUserIds.length > 0 ? candidateUserIds : [userId];
    const classification = await this.classifyExecutionCandidates(date, userIds, [scheduleItemId]);
    if (classification.kind === 'duplicate') throw new AmbiguousExecutionRecordError();
    if (classification.kind === 'mismatch') throw new ExecutionTargetMismatchError();
    return classification;
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

    const childFieldsPromise = this.initFields(this.childListTitle);
    const candidateUserIds = options?.candidateUserIds && options.candidateUserIds.length > 0
      ? options.candidateUserIds.map(normalizeExecutionUserId)
      : [normalizedUserId];
    const classification = await this.classifyForWrite(
      normalizedDate,
      normalizedUserId,
      normalizedScheduleItemId,
      candidateUserIds,
    );
    if (classification.kind === 'unique') {
      const existingUserId = normalizeExecutionUserId(classification.record.userId);
      if (existingUserId && !candidateUserIds.includes(existingUserId)) {
        throw new ExecutionTargetMismatchError();
      }
    }
    const existing = classification.kind === 'unique' ? classification.record : undefined;
    const existingId = classification.kind === 'unique' ? classification.internalId : undefined;

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

    const parentId = await this.ensureParentRecord(
      dailyKey,
      normalizedDate,
      normalizedUserId,
      candidateUserIds,
    );
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

    if (existingId !== undefined) {
      const updateUrl = `${this.resolvedChildPath}/items(${existingId})`;
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
    } else {
      // Another client can create a matching row between this lookup and POST.
      // All-page item-id dedupe does not prevent that duplicate.
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

  async deleteRecord(
    date: string,
    userId: string,
    scheduleItemId: string,
    options?: { candidateUserIds?: readonly string[] },
  ): Promise<void> {
    const normalizedDate = normalizeExecutionDate(date);
    const normalizedUserId = normalizeExecutionUserId(userId);
    const normalizedScheduleItemId = normalizeScheduleItemId(scheduleItemId);
    const candidateUserIds = options?.candidateUserIds && options.candidateUserIds.length > 0
      ? options.candidateUserIds.map(normalizeExecutionUserId)
      : [normalizedUserId];
    const classification = await this.classifyForWrite(
      normalizedDate,
      normalizedUserId,
      normalizedScheduleItemId,
      candidateUserIds,
    );

    if (classification.kind === 'unique') {
      const existingUserId = normalizeExecutionUserId(classification.record.userId);
      if (existingUserId && !candidateUserIds.includes(existingUserId)) {
        throw new ExecutionTargetMismatchError();
      }
      const deleteUrl = `${this.resolvedChildPath}/items(${classification.internalId})`;
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

    // Absent is a confirmed miss. Duplicate, mismatch, and fetch failures throw
    // above, so the local store is cleared only after a confirmed outcome.
    this.clearStoredExecutionRecord(
      normalizedDate,
      normalizedUserId,
      normalizedScheduleItemId,
      classification.kind === 'unique' ? classification.record.scheduleItemId : undefined,
    );
  }

  private clearStoredExecutionRecord(
    normalizedDate: string,
    normalizedUserId: string,
    normalizedScheduleItemId: string,
    resolvedScheduleItemId: string | undefined,
  ): void {
    if (!this.store?.deleteRecord) return;
    this.store.deleteRecord(normalizedDate, normalizedUserId, normalizedScheduleItemId);
    const resolved = normalizeScheduleItemId(resolvedScheduleItemId);
    if (resolved && resolved !== normalizedScheduleItemId) {
      this.store.deleteRecord(normalizedDate, normalizedUserId, resolved);
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
    const userId = readSharePointText(item[rf.userId])
      || readSharePointText(item.User_x0020_ID)
      || readSharePointText(item.UserId)
      || readSharePointText(item.userId);
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
