import type { ToiletRecord, ToiletRecordInput, IToiletRecordRepository } from './types';
import type { SpFetchFn } from '@/lib/sp/spLists';
import { findListEntry } from '@/sharepoint/spListRegistry';
import { TOILET_RECORD_CANDIDATES } from '@/sharepoint/fields/toiletRecordFields';
import { resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import { toLocalDateISO } from '@/utils/getNow';
import type { JsonRecord } from '@/lib/sp/types';

type CandidateKey = keyof typeof TOILET_RECORD_CANDIDATES;

export class SharePointToiletRecordRepository implements IToiletRecordRepository {
  private resolvedFields: Record<string, string | undefined> = {};
  private availablePhysicalFields = new Set<string>();
  private initPromise: Promise<void> | null = null;

  constructor(
    private readonly spFetch: SpFetchFn,
    private readonly getListFieldInternalNames?: (listTitle: string) => Promise<Set<string>>
  ) {}

  private rf(key: CandidateKey): string | undefined {
    return this.resolvedFields[key];
  }

  private rfFallback(key: CandidateKey): string {
    return this.resolvedFields[key] || TOILET_RECORD_CANDIDATES[key][0];
  }

  private async initFields(listTitle: string): Promise<void> {
    if (Object.keys(this.resolvedFields).length > 0) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const fieldSet = this.getListFieldInternalNames
          ? await this.getListFieldInternalNames(listTitle)
          : undefined;
        if (!fieldSet || fieldSet.size === 0) return;

        this.availablePhysicalFields = fieldSet;

        const res = resolveInternalNamesDetailed(
          fieldSet,
          TOILET_RECORD_CANDIDATES as unknown as Record<string, string[]>,
        );
        this.resolvedFields = res.resolved;
      } catch (err) {
        console.warn('[SharePointToiletRecordRepo] Field resolution failed.', err);
      }
    })();

    return this.initPromise;
  }

  private resolveListTitle(): string {
    const entry = findListEntry('toilet_records');
    if (!entry) {
      throw new Error('[SharePointToiletRecordRepo] toilet_records not found in registry.');
    }
    return entry.resolve();
  }

  private filterPayload(payload: Record<string, unknown>): Record<string, unknown> {
    if (this.availablePhysicalFields.size === 0) return payload; // fail-open

    const activePayload: Record<string, unknown> = {};
    if (payload.Title !== undefined) activePayload.Title = payload.Title;

    for (const [k, v] of Object.entries(payload)) {
      if (k === 'Title') continue;
      // Case-insensitive match check
      const matchedKey = Array.from(this.availablePhysicalFields).find(
        (f) => f.toLowerCase() === k.toLowerCase()
      );
      if (matchedKey) {
        activePayload[matchedKey] = v;
      }
    }
    return activePayload;
  }

  async listByDate(dateIso: string): Promise<ToiletRecord[]> {
    const listTitle = this.resolveListTitle();
    await this.initFields(listTitle);

    const recordDateField = this.rfFallback('recordDate');
    const isDeletedField = this.rfFallback('isDeleted');
    const filter = `(${recordDateField} eq '${dateIso}') and (${isDeletedField} ne true)`;
    
    // OData query
    const select = [
      'Id',
      'Title',
      'Created',
      'Modified',
      this.rfFallback('userId'),
      recordDateField,
      this.rfFallback('occurredAt'),
      this.rfFallback('toiletType'),
      this.rfFallback('amount'),
      this.rfFallback('memo'),
      this.rfFallback('recorderName'),
      this.rfFallback('source'),
      isDeletedField,
    ];
    const selectQuery = select.join(',');

    const url = `/lists/getbytitle('${encodeURIComponent(listTitle)}')/items?$filter=${encodeURIComponent(filter)}&$select=${selectQuery}`;
    
    const response = await this.spFetch(url);
    if (!response.ok) {
      throw new Error(`[SharePointToiletRecordRepo] listByDate failed: ${response.statusText}`);
    }

    const data = await response.json();
    const items = (data.value || data.d?.results || []) as JsonRecord[];

    return items
      .map((item) => this.mapToDomain(item))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  async create(input: ToiletRecordInput): Promise<ToiletRecord> {
    const listTitle = this.resolveListTitle();
    await this.initFields(listTitle);

    const recordId = `toilet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const recordDate = toLocalDateISO(new Date(input.occurredAt));

    const rawPayload: Record<string, unknown> = {
      Title: recordId,
      [this.rfFallback('userId')]: input.userId,
      [this.rfFallback('recordDate')]: recordDate,
      [this.rfFallback('occurredAt')]: input.occurredAt,
      [this.rfFallback('toiletType')]: input.toiletType,
      [this.rfFallback('amount')]: input.amount,
      [this.rfFallback('memo')]: input.memo?.trim() ?? '',
      [this.rfFallback('recorderName')]: input.recorderName?.trim() ?? 'kiosk',
      [this.rfFallback('source')]: 'kiosk',
      [this.rfFallback('isDeleted')]: false,
    };

    const body = this.filterPayload(rawPayload);
    const url = `/lists/getbytitle('${encodeURIComponent(listTitle)}')/items`;

    const response = await this.spFetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json;odata=nometadata',
        'Accept': 'application/json;odata=nometadata',
      },
    });

    if (!response.ok) {
      throw new Error(`[SharePointToiletRecordRepo] create failed: ${response.statusText}`);
    }

    const result = await response.json();
    return this.mapToDomain(result.d || result);
  }

  private mapToDomain(item: JsonRecord): ToiletRecord {
    const title = (item.Title || '') as string;
    const isDeletedField = this.rfFallback('isDeleted');
    const isDeletedRaw = item[isDeletedField] ?? item.IsDeleted;
    const isDeleted = typeof isDeletedRaw === 'boolean' ? isDeletedRaw : isDeletedRaw === 'true' || isDeletedRaw === 1;

    const recordDateField = this.rfFallback('recordDate');
    const recordDateRaw = (item[recordDateField] ?? item.RecordDate ?? item.recordDate ?? '') as string;
    const recordDate = recordDateRaw ? toLocalDateISO(new Date(recordDateRaw)) : '';

    const userIdField = this.rfFallback('userId');
    const occurredAtField = this.rfFallback('occurredAt');
    const toiletTypeField = this.rfFallback('toiletType');
    const amountField = this.rfFallback('amount');
    const memoField = this.rfFallback('memo');
    const recorderNameField = this.rfFallback('recorderName');

    return {
      id: title || String(item.Id),
      userId: (item[userIdField] ?? item.UserId ?? item.userId ?? '') as string,
      recordDate,
      occurredAt: (item[occurredAtField] ?? item.OccurredAt ?? item.occurredAt ?? item.Created ?? '') as string,
      toiletType: (item[toiletTypeField] ?? item.ToiletType ?? item.toiletType ?? 'urination') as ToiletRecord['toiletType'],
      amount: (item[amountField] ?? item.Amount ?? item.amount ?? 'normal') as ToiletRecord['amount'],
      memo: (item[memoField] ?? item.Memo ?? item.memo ?? '') as string,
      recorderName: (item[recorderNameField] ?? item.RecorderName ?? item.recorderName ?? '') as string,
      source: 'kiosk',
      isDeleted,
      createdAt: (item.Created || item.createdAt || '') as string,
      updatedAt: (item.Modified || item.updatedAt || '') as string,
    };
  }
}
