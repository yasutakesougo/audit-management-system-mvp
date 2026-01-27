import { acquireSpAccessToken } from '@/lib/msal';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import {
  buildIcebergPdcaSelectFields,
  FIELD_MAP_ICEBERG_PDCA,
  LIST_CONFIG,
  ListKeys,
} from '@/sharepoint/fields';

import type { IcebergPdcaItem, IcebergPdcaPhase } from '../domain/pdca';
import type {
  CreatePdcaInput,
  DeletePdcaInput,
  PdcaListQuery,
  PdcaRepository,
  UpdatePdcaInput,
} from '../domain/pdcaRepository';

const DEFAULT_TOP = 200;

type SpClient = ReturnType<typeof createSpClient>;

export class SharePointPdcaRepository implements PdcaRepository {
  private readonly sp: SpClient;
  private readonly listTitle = LIST_CONFIG[ListKeys.IcebergPdca].title;
  private readonly defaultTop: number;

  constructor(options: { defaultTop?: number } = {}) {
    this.defaultTop = options.defaultTop ?? DEFAULT_TOP;
    const { baseUrl } = ensureConfig();
    this.sp = createSpClient(acquireSpAccessToken, baseUrl);
  }

  async list(query: PdcaListQuery): Promise<IcebergPdcaItem[]> {
    const userId = query.userId;
    if (!userId) return [];

    const internalNames = await this.sp.getListFieldInternalNames(this.listTitle);
    const selectFields = buildIcebergPdcaSelectFields(Array.from(internalNames));
    const filter = `${FIELD_MAP_ICEBERG_PDCA.userId} eq '${this.escapeSingleQuotes(userId)}'`;

    const params = new URLSearchParams();
    params.set('$select', selectFields.join(','));
    params.set('$filter', filter);
    params.set('$orderby', `${FIELD_MAP_ICEBERG_PDCA.updatedAt} desc`);
    if (this.defaultTop) {
      params.set('$top', String(this.defaultTop));
    }

    const url = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items?${params.toString()}`;
    const res = await this.sp.spFetch(url, { method: 'GET' });
    const json = (await res.json()) as { value?: Record<string, unknown>[] };
    return (json.value ?? []).map((item) => this.toDomain(item));
  }

  async create(input: CreatePdcaInput): Promise<IcebergPdcaItem> {
    const body: Record<string, unknown> = {
      [FIELD_MAP_ICEBERG_PDCA.title]: input.title,
      [FIELD_MAP_ICEBERG_PDCA.userId]: input.userId,
    };

    if (input.summary !== undefined) body[FIELD_MAP_ICEBERG_PDCA.summary] = input.summary;
    if (input.phase !== undefined) body[FIELD_MAP_ICEBERG_PDCA.phase] = input.phase;

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

  async update(input: UpdatePdcaInput): Promise<IcebergPdcaItem> {
    const idNum = Number(input.id);
    if (Number.isNaN(idNum)) {
      throw new Error(`[SharePointPdcaRepository] Invalid id: ${input.id}`);
    }

    const body: Record<string, unknown> = {};
    if (input.title !== undefined) body[FIELD_MAP_ICEBERG_PDCA.title] = input.title;
    if (input.summary !== undefined) body[FIELD_MAP_ICEBERG_PDCA.summary] = input.summary;
    if (input.phase !== undefined) body[FIELD_MAP_ICEBERG_PDCA.phase] = input.phase;

    const url = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items(${idNum})`;
    const res = await this.sp.spFetch(url, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=nometadata',
        'IF-MATCH': input.etag ?? '*',
      },
      body: JSON.stringify(body),
    });

    // 204 No Content は SharePoint の更新で一般的。ボディが空なので json() は呼ばない
    if (res.status === 204 || res.status === 200) {
      const text = await res.text();
      if (!text || text.length === 0) {
        // 更新成功だが、レスポンスボディが空。元のデータを返す（キャッシュ無効化は呼び出し側で）
        return {
          id: String(input.id),
          userId: input.userId ?? '',
          title: input.title ?? '',
          summary: input.summary ?? '',
          phase: input.phase ?? 'PLAN',
          createdAt: '',
          updatedAt: new Date().toISOString(),
        };
      }
      const data = JSON.parse(text) as Record<string, unknown>;
      return this.toDomain(data);
    }

    // その他のステータス
    const data = (await res.json()) as Record<string, unknown>;
    return this.toDomain(data);
  }

  async delete(input: DeletePdcaInput): Promise<void> {
    const idNum = Number(input.id);
    if (Number.isNaN(idNum)) {
      throw new Error(`[SharePointPdcaRepository] Invalid id: ${input.id}`);
    }

    const url = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items(${idNum})`;
    const res = await this.sp.spFetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=nometadata',
        'X-HTTP-Method': 'DELETE',
        'IF-MATCH': input.etag ?? '*',
      },
    });

    if (res.status === 204 || res.status === 200) return;
    throw new Error(`[SharePointPdcaRepository] delete failed: ${res.status}`);
  }

  private toDomain(raw: Record<string, unknown>): IcebergPdcaItem {
    const get = <T = unknown>(field: string): T | undefined => raw[field] as T | undefined;
    const phase = this.normalizePhase(get(FIELD_MAP_ICEBERG_PDCA.phase));

    return {
      id: String(get(FIELD_MAP_ICEBERG_PDCA.id) ?? raw.Id ?? ''),
      userId: String(get(FIELD_MAP_ICEBERG_PDCA.userId) ?? ''),
      title: String(get(FIELD_MAP_ICEBERG_PDCA.title) ?? ''),
      summary: (get<string | null>(FIELD_MAP_ICEBERG_PDCA.summary) ?? '') ?? '',
      phase,
      createdAt: get(FIELD_MAP_ICEBERG_PDCA.createdAt) ?? get('Created') ?? '',
      updatedAt:
        get(FIELD_MAP_ICEBERG_PDCA.updatedAt) ?? get('Modified') ?? get('Created') ?? '',
    };
  }

  private normalizePhase(value: unknown): IcebergPdcaPhase {
    if (typeof value !== 'string') return 'PLAN';
    const normalized = value.trim().toUpperCase();
    if (normalized === 'PLAN' || normalized === 'DO' || normalized === 'CHECK' || normalized === 'ACT') {
      return normalized as IcebergPdcaPhase;
    }
    return 'PLAN';
  }

  private escapeSingleQuotes(value: string): string {
    return value.replace(/'/g, "''");
  }
}
