/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable */
import { acquireSpAccessToken } from '@/lib/msal';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import {
    buildIcebergPdcaSelectFields,
    ICEBERG_PDCA_PLANNING_SHEET_FIELD_CANDIDATES,
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
  private listInternalNamesCache: Set<string> | null = null;

  constructor(options: { defaultTop?: number } = {}) {
    this.defaultTop = options.defaultTop ?? DEFAULT_TOP;
    const { baseUrl } = ensureConfig();
    this.sp = createSpClient(acquireSpAccessToken, baseUrl);
  }

  async list(query: PdcaListQuery): Promise<IcebergPdcaItem[]> {
    const userId = query.userId;
    if (!userId) return [];

    const internalNames = await this.getListInternalNames();
    const selectFields = buildIcebergPdcaSelectFields(Array.from(internalNames));
    const filterParts = [
      `${FIELD_MAP_ICEBERG_PDCA.userId} eq '${this.escapeSingleQuotes(userId)}'`,
    ];
    if (query.planningSheetId) {
      const planningSheetField = this.resolvePlanningSheetFieldName(internalNames);
      if (!planningSheetField) {
        return [];
      }
      filterParts.push(`${planningSheetField} eq '${this.escapeSingleQuotes(query.planningSheetId)}'`);
    }

    const params = new URLSearchParams();
    params.set('$select', selectFields.join(','));
    params.set('$filter', filterParts.join(' and '));
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
    const internalNames = await this.getListInternalNames();
    const planningSheetField = this.resolvePlanningSheetFieldName(internalNames);
    const body: Record<string, unknown> = {
      [FIELD_MAP_ICEBERG_PDCA.title]: input.title,
      [FIELD_MAP_ICEBERG_PDCA.userId]: input.userId,
    };

    if (input.summary !== undefined) body[FIELD_MAP_ICEBERG_PDCA.summary] = input.summary;
    if (input.phase !== undefined) body[FIELD_MAP_ICEBERG_PDCA.phase] = input.phase;
    if (input.planningSheetId !== undefined && planningSheetField) {
      body[planningSheetField] = input.planningSheetId;
    }

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

    const internalNames = await this.getListInternalNames();
    const planningSheetField = this.resolvePlanningSheetFieldName(internalNames);
    const body: Record<string, unknown> = {};
    if (input.title !== undefined) body[FIELD_MAP_ICEBERG_PDCA.title] = input.title;
    if (input.summary !== undefined) body[FIELD_MAP_ICEBERG_PDCA.summary] = input.summary;
    if (input.phase !== undefined) body[FIELD_MAP_ICEBERG_PDCA.phase] = input.phase;
    if (input.planningSheetId !== undefined && planningSheetField) {
      body[planningSheetField] = input.planningSheetId;
    }

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
          planningSheetId: input.planningSheetId,
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
    const planningSheetId = this.readPlanningSheetId(raw);

    return {
      id: String(get(FIELD_MAP_ICEBERG_PDCA.id) ?? raw.Id ?? ''),
      userId: String(get(FIELD_MAP_ICEBERG_PDCA.userId) ?? ''),
      planningSheetId,
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

  private async getListInternalNames(): Promise<Set<string>> {
    if (this.listInternalNamesCache) return this.listInternalNamesCache;
    try {
      const names = await this.sp.getListFieldInternalNames(this.listTitle);
      this.listInternalNamesCache = new Set(Array.from(names));
      return this.listInternalNamesCache;
    } catch {
      this.listInternalNamesCache = new Set();
      return this.listInternalNamesCache;
    }
  }

  private resolvePlanningSheetFieldName(
    internalNames: Set<string>,
  ): string | undefined {
    return this.resolveFieldNameFromCandidates(
      internalNames,
      ICEBERG_PDCA_PLANNING_SHEET_FIELD_CANDIDATES,
    );
  }

  private resolveFieldNameFromCandidates(
    internalNames: Set<string>,
    candidates: readonly string[],
  ): string | undefined {
    if (internalNames.size === 0) return undefined;

    const map = new Map<string, string>();
    for (const name of internalNames) {
      map.set(name.toLowerCase(), name);
    }

    for (const candidate of candidates) {
      const hit = map.get(candidate.toLowerCase());
      if (hit) return hit;
    }

    for (const candidate of candidates) {
      const lower = candidate.toLowerCase();
      for (let i = 0; i < 10; i += 1) {
        const hit = map.get(`${lower}${i}`);
        if (hit) return hit;
      }
    }

    return undefined;
  }

  private readPlanningSheetId(raw: Record<string, unknown>): string | undefined {
    const getTrimmed = (value: unknown): string | undefined => {
      if (typeof value !== 'string') return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const direct = getTrimmed(raw[FIELD_MAP_ICEBERG_PDCA.planningSheetId]);
    if (direct) return direct;

    for (const candidate of ICEBERG_PDCA_PLANNING_SHEET_FIELD_CANDIDATES) {
      const value = getTrimmed(raw[candidate]);
      if (value) return value;
    }

    for (const [key, value] of Object.entries(raw)) {
      if (!/planning.?sheet/i.test(key)) continue;
      const hit = getTrimmed(value);
      if (hit) return hit;
    }

    return undefined;
  }
}
