import { acquireSpAccessToken } from '@/lib/msal';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import {
    buildIcebergAnalysisSelectFields,
    FIELD_MAP_ICEBERG_ANALYSIS,
    LIST_CONFIG,
    ListKeys,
} from '@/sharepoint/fields';

import type { IcebergAnalysisRecord, IcebergAnalysisStatus } from '../domain/icebergAnalysisRecord';
import type {
    IcebergAnalysisListQuery,
    IcebergAnalysisRepository,
    SaveIcebergAnalysisInput,
} from '../domain/icebergAnalysisRepository';

const DEFAULT_TOP = 100;

type SpClient = ReturnType<typeof createSpClient>;

export class SharePointIcebergAnalysisRepository implements IcebergAnalysisRepository {
  private readonly sp: SpClient;
  private readonly listTitle = LIST_CONFIG[ListKeys.IcebergAnalysis].title;
  private readonly defaultTop: number;

  constructor(options: { defaultTop?: number } = {}) {
    this.defaultTop = options.defaultTop ?? DEFAULT_TOP;
    const { baseUrl } = ensureConfig();
    this.sp = createSpClient(acquireSpAccessToken, baseUrl);
  }

  async list(query: IcebergAnalysisListQuery): Promise<IcebergAnalysisRecord[]> {
    const userId = query.userId;
    if (!userId) return [];

    const internalNames = await this.sp.getListFieldInternalNames(this.listTitle);
    const selectFields = buildIcebergAnalysisSelectFields(Array.from(internalNames));
    const filter = `${FIELD_MAP_ICEBERG_ANALYSIS.userId} eq '${this.escapeSingleQuotes(userId)}'`;

    const params = new URLSearchParams();
    params.set('$select', selectFields.join(','));
    params.set('$filter', filter);
    params.set('$orderby', `${FIELD_MAP_ICEBERG_ANALYSIS.updatedAt} desc`);
    if (this.defaultTop) {
      params.set('$top', String(this.defaultTop));
    }

    const url = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items?${params.toString()}`;
    const res = await this.sp.spFetch(url, { method: 'GET' });
    const json = (await res.json()) as { value?: Record<string, unknown>[] };
    return (json.value ?? []).map((item) => this.toDomain(item));
  }

  async save(input: SaveIcebergAnalysisInput): Promise<IcebergAnalysisRecord> {
    // Check if an item with the same entryHash already exists
    if (input.entryHash) {
      const existing = await this.findByEntryHash(input.entryHash);
      if (existing) {
        return this.update(existing.id, input);
      }
    }
    return this.create(input);
  }

  private async findByEntryHash(entryHash: string): Promise<IcebergAnalysisRecord | null> {
    const filter = `${FIELD_MAP_ICEBERG_ANALYSIS.entryHash} eq '${this.escapeSingleQuotes(entryHash)}'`;
    const params = new URLSearchParams();
    params.set('$filter', filter);
    params.set('$top', '1');
    params.set('$select', 'Id');

    const url = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items?${params.toString()}`;
    const res = await this.sp.spFetch(url, { method: 'GET' });
    const json = (await res.json()) as { value?: Record<string, unknown>[] };
    const items = json.value ?? [];
    if (items.length === 0) return null;
    return this.toDomain(items[0]);
  }

  private async create(input: SaveIcebergAnalysisInput): Promise<IcebergAnalysisRecord> {
    const body: Record<string, unknown> = {
      [FIELD_MAP_ICEBERG_ANALYSIS.title]: input.title,
      [FIELD_MAP_ICEBERG_ANALYSIS.userId]: input.userId,
      [FIELD_MAP_ICEBERG_ANALYSIS.snapshotJSON]: input.snapshotJSON,
      [FIELD_MAP_ICEBERG_ANALYSIS.entryHash]: input.entryHash,
      [FIELD_MAP_ICEBERG_ANALYSIS.status]: input.status ?? 'Draft',
      [FIELD_MAP_ICEBERG_ANALYSIS.version]: 1,
    };

    const url = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items`;
    const res = await this.sp.spFetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=nometadata',
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return this.toDomain(data);
  }

  private async update(itemId: string, input: SaveIcebergAnalysisInput): Promise<IcebergAnalysisRecord> {
    const idNum = Number(itemId);
    if (Number.isNaN(idNum)) {
      throw new Error(`[SharePointIcebergAnalysisRepository] Invalid id: ${itemId}`);
    }

    const body: Record<string, unknown> = {
      [FIELD_MAP_ICEBERG_ANALYSIS.title]: input.title,
      [FIELD_MAP_ICEBERG_ANALYSIS.snapshotJSON]: input.snapshotJSON,
    };
    if (input.status !== undefined) {
      body[FIELD_MAP_ICEBERG_ANALYSIS.status] = input.status;
    }

    const url = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items(${idNum})`;
    const etag = input.etag ?? '*';
    const res = await this.doPatch(url, body, etag);

    // 412 Precondition Failed: another client updated the item.
    // Re-fetch the latest ETag and retry once.
    if (res.status === 412) {
      console.warn('[SharePointIcebergAnalysisRepository] 412 conflict detected, retrying with fresh ETag');
      const freshEtag = await this.fetchLatestEtag(idNum);
      if (!freshEtag) {
        throw new Error(`[SharePointIcebergAnalysisRepository] Conflict: item ${itemId} was deleted or inaccessible`);
      }
      const retryRes = await this.doPatch(url, body, freshEtag);
      if (retryRes.status === 412) {
        throw new Error(`[SharePointIcebergAnalysisRepository] Conflict persists after retry for item ${itemId}`);
      }
      return this.parseUpdateResponse(retryRes, itemId, input);
    }

    return this.parseUpdateResponse(res, itemId, input);
  }

  private async doPatch(url: string, body: Record<string, unknown>, etag: string): Promise<Response> {
    return this.sp.spFetch(url, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=nometadata',
        'IF-MATCH': etag,
      },
      body: JSON.stringify(body),
    });
  }

  private async fetchLatestEtag(itemId: number): Promise<string | null> {
    const url = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items(${itemId})?$select=Id`;
    try {
      const res = await this.sp.spFetch(url, { method: 'GET' });
      const etag = res.headers.get('etag');
      return etag || null;
    } catch {
      return null;
    }
  }

  private async parseUpdateResponse(
    res: Response,
    itemId: string,
    input: SaveIcebergAnalysisInput,
  ): Promise<IcebergAnalysisRecord> {
    if (res.status === 204 || res.status === 200) {
      const text = await res.text();
      if (!text || text.length === 0) {
        return {
          id: itemId,
          userId: input.userId,
          title: input.title,
          snapshotJSON: input.snapshotJSON,
          version: 1,
          entryHash: input.entryHash,
          status: input.status ?? 'Draft',
          createdAt: '',
          updatedAt: new Date().toISOString(),
        };
      }
      const data = JSON.parse(text) as Record<string, unknown>;
      return this.toDomain(data);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return this.toDomain(data);
  }

  private toDomain(raw: Record<string, unknown>): IcebergAnalysisRecord {
    const get = <T = unknown>(field: string): T | undefined => raw[field] as T | undefined;
    const status = this.normalizeStatus(get(FIELD_MAP_ICEBERG_ANALYSIS.status));

    return {
      id: String(get(FIELD_MAP_ICEBERG_ANALYSIS.id) ?? raw.Id ?? ''),
      userId: String(get(FIELD_MAP_ICEBERG_ANALYSIS.userId) ?? ''),
      title: String(get(FIELD_MAP_ICEBERG_ANALYSIS.title) ?? ''),
      snapshotJSON: String(get(FIELD_MAP_ICEBERG_ANALYSIS.snapshotJSON) ?? ''),
      version: Number(get(FIELD_MAP_ICEBERG_ANALYSIS.version) ?? 1),
      entryHash: String(get(FIELD_MAP_ICEBERG_ANALYSIS.entryHash) ?? ''),
      status,
      createdAt: String(get(FIELD_MAP_ICEBERG_ANALYSIS.createdAt) ?? raw.Created ?? ''),
      updatedAt: String(
        get(FIELD_MAP_ICEBERG_ANALYSIS.updatedAt) ?? raw.Modified ?? raw.Created ?? '',
      ),
    };
  }

  private normalizeStatus(value: unknown): IcebergAnalysisStatus {
    if (typeof value !== 'string') return 'Draft';
    const normalized = value.trim();
    if (normalized === 'Draft' || normalized === 'Final') {
      return normalized;
    }
    return 'Draft';
  }

  private escapeSingleQuotes(value: string): string {
    return value.replace(/'/g, "''");
  }
}
