import { spfi, SPFx, type ISPFXContext, type SPFI } from '@pnp/sp';
import '@pnp/sp/items';
import '@pnp/sp/lists';
import '@pnp/sp/webs';

import { getAppConfig } from '@/lib/env';
import { BEHAVIORS_SELECT_FIELDS, FIELD_MAP_BEHAVIORS, LIST_CONFIG, ListKeys } from '@/sharepoint/fields';
import type { BehaviorQueryOptions, BehaviorRepository } from '../domain/BehaviorRepository';
import type { BehaviorObservation } from '../domain/daily/types';

const DEFAULT_TOP = 200;

type SpContextCarrier = {
  __SPFX_CONTEXT__?: ISPFXContext;
};

export type SharePointBehaviorRepositoryOptions = {
  sp?: SPFI;
  spfxContext?: ISPFXContext;
  defaultTop?: number;
};

export class SharePointBehaviorRepository implements BehaviorRepository {
  private readonly sp: SPFI;
  private readonly listTitle = LIST_CONFIG[ListKeys.Behaviors].title;
  private readonly defaultTop: number;

  constructor(options: SharePointBehaviorRepositoryOptions = {}) {
    this.ensureSharePointConfig();
    this.defaultTop = options.defaultTop ?? DEFAULT_TOP;
    this.sp = options.sp ?? this.createSpInstance(options.spfxContext);
  }

  async add(observation: Omit<BehaviorObservation, 'id'>): Promise<BehaviorObservation> {
    const payload = this.toRequest(observation);
    const result = await this.list.items.add(payload);
    return this.toDomain(result.data ?? payload);
  }

  async getByUser(userId: string, options?: BehaviorQueryOptions): Promise<BehaviorObservation[]> {
    if (!userId) return [];

    const filters: string[] = [
      `${FIELD_MAP_BEHAVIORS.userId} eq '${this.escapeSingleQuotes(userId)}'`,
    ];

    if (options?.dateRange?.from) {
      filters.push(`${FIELD_MAP_BEHAVIORS.timestamp} ge '${options.dateRange.from}'`);
    }
    if (options?.dateRange?.to) {
      filters.push(`${FIELD_MAP_BEHAVIORS.timestamp} le '${options.dateRange.to}'`);
    }

    let query = this.list.items
      .select(...BEHAVIORS_SELECT_FIELDS)
      .orderBy(FIELD_MAP_BEHAVIORS.timestamp, false);

    const top = options?.limit ?? this.defaultTop;
    if (top && top > 0) {
      query = query.top(top);
    }

    if (filters.length) {
      query = query.filter(filters.join(' and '));
    }

    const items = await query();
    return (items ?? []).map((item) => this.toDomain(item));
  }

  private get list() {
    return this.sp.web.lists.getByTitle(this.listTitle);
  }

  private toDomain(item: Record<string, unknown>): BehaviorObservation {
    const field = FIELD_MAP_BEHAVIORS;
    const get = <T = unknown>(key: string): T | undefined => item[key] as T | undefined;
    return {
      id: String(get(field.id) ?? ''),
      userId: String(get(field.userId) ?? ''),
      timestamp: String(get(field.timestamp) ?? ''),
      antecedent: (get<string | null>(field.antecedent) ?? null) || null,
      behavior: String(get(field.behavior) ?? ''),
      consequence: (get<string | null>(field.consequence) ?? null) || null,
      intensity: Number(get(field.intensity) ?? 0) as BehaviorObservation['intensity'],
      durationMinutes: get<number | null>(field.duration) ?? undefined,
      memo: get<string | null>(field.memo) ?? undefined,
    };
  }

  private toRequest(observation: Omit<BehaviorObservation, 'id'>): Record<string, unknown> {
    const fm = FIELD_MAP_BEHAVIORS;
    return {
      [fm.userId]: observation.userId,
      [fm.timestamp]: observation.timestamp,
      [fm.antecedent]: observation.antecedent,
      [fm.behavior]: observation.behavior,
      [fm.consequence]: observation.consequence,
      [fm.intensity]: observation.intensity,
      [fm.duration]: observation.durationMinutes ?? null,
      [fm.memo]: observation.memo ?? null,
    };
  }

  private ensureSharePointConfig(): void {
    const config = getAppConfig();
    if (!config.VITE_SP_RESOURCE || !config.VITE_SP_SITE_RELATIVE) {
      console.warn('[SharePointBehaviorRepository] SharePoint environment variables are missing.');
    }
  }

  private createSpInstance(context?: ISPFXContext): SPFI {
    const resolved = context ?? SharePointBehaviorRepository.resolveGlobalSpfxContext();
    if (!resolved) {
      throw new Error('[SharePointBehaviorRepository] SPFx context is not available.');
    }
    return spfi().using(SPFx(resolved));
  }

  private static resolveGlobalSpfxContext(): ISPFXContext | undefined {
    const carrier = globalThis as SpContextCarrier;
    return carrier.__SPFX_CONTEXT__;
  }

  private escapeSingleQuotes(value: string): string {
    return value.replace(/'/g, "''");
  }
}
