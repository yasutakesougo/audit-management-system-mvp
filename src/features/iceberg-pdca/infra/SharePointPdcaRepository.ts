import { spfi, SPFx, type ISPFXContext, type SPFI } from '@pnp/sp';
import '@pnp/sp/items';
import '@pnp/sp/lists';
import '@pnp/sp/webs';

import { getAppConfig } from '@/lib/env';
import {
  FIELD_MAP_ICEBERG_PDCA,
  ICEBERG_PDCA_SELECT_FIELDS,
  LIST_CONFIG,
  ListKeys,
} from '@/sharepoint/fields';

import type { IcebergPdcaItem, IcebergPdcaPhase } from '../domain/pdca';
import type { PdcaListQuery, PdcaRepository } from '../domain/pdcaRepository';

const DEFAULT_TOP = 200;

type SpContextCarrier = {
  __SPFX_CONTEXT__?: ISPFXContext;
};

export type SharePointPdcaRepositoryOptions = {
  sp?: SPFI;
  spfxContext?: ISPFXContext;
  defaultTop?: number;
};

export class SharePointPdcaRepository implements PdcaRepository {
  private readonly sp: SPFI;
  private readonly listTitle = LIST_CONFIG[ListKeys.IcebergPdca].title;
  private readonly defaultTop: number;

  constructor(options: SharePointPdcaRepositoryOptions = {}) {
    this.ensureSharePointConfig();
    this.defaultTop = options.defaultTop ?? DEFAULT_TOP;
    this.sp = options.sp ?? this.createSpInstance(options.spfxContext);
  }

  async list(query: PdcaListQuery): Promise<IcebergPdcaItem[]> {
    const userId = query.userId;
    if (!userId) return [];

    const filters = [`${FIELD_MAP_ICEBERG_PDCA.userId} eq '${this.escapeSingleQuotes(userId)}'`];

    let spQuery = this.spList.items
      .select(...ICEBERG_PDCA_SELECT_FIELDS)
      .orderBy(FIELD_MAP_ICEBERG_PDCA.updatedAt, false);

    if (this.defaultTop) {
      spQuery = spQuery.top(this.defaultTop);
    }

    if (filters.length) {
      spQuery = spQuery.filter(filters.join(' and '));
    }

    const items = await spQuery();
    return (items ?? []).map((item: Record<string, unknown>) => this.toDomain(item));
  }

  private get spList() {
    return this.sp.web.lists.getByTitle(this.listTitle);
  }

  private ensureSharePointConfig(): void {
    const config = getAppConfig();
    if (!config.VITE_SP_RESOURCE || !config.VITE_SP_SITE_RELATIVE) {
      console.warn('[SharePointPdcaRepository] SharePoint environment variables are missing.');
    }
  }

  private createSpInstance(context?: ISPFXContext): SPFI {
    const resolved = context ?? SharePointPdcaRepository.resolveGlobalSpfxContext();
    if (!resolved) {
      throw new Error('[SharePointPdcaRepository] SPFx context is not available.');
    }
    return spfi().using(SPFx(resolved));
  }

  private static resolveGlobalSpfxContext(): ISPFXContext | undefined {
    const carrier = globalThis as SpContextCarrier;
    return carrier.__SPFX_CONTEXT__;
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
