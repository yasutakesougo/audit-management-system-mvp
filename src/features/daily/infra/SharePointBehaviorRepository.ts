import { acquireSpAccessToken } from '@/lib/msal';
import { ensureConfig, createSpClient } from '@/lib/spClient';
import { getAppConfig } from '@/lib/env';
import {
  buildDailyActivitySelectFields,
  FIELD_MAP_DAILY_ACTIVITY,
  LIST_CONFIG,
  ListKeys,
} from '@/sharepoint/fields';
import type { BehaviorQueryOptions, BehaviorRepository } from '../domain/BehaviorRepository';
import type { BehaviorObservation } from '../domain/daily/types';

const DEFAULT_TOP = 200;

export type SharePointBehaviorRepositoryOptions = {
  sp?: ReturnType<typeof createSpClient>;
  defaultTop?: number;
};

export class SharePointBehaviorRepository implements BehaviorRepository {
  private readonly sp: ReturnType<typeof createSpClient>;
  private readonly listTitle = LIST_CONFIG[ListKeys.DailyActivityRecords].title;
  private readonly defaultTop: number;

  constructor(options: SharePointBehaviorRepositoryOptions = {}) {
    this.ensureSharePointConfig();
    this.defaultTop = options.defaultTop ?? DEFAULT_TOP;
    const { baseUrl } = ensureConfig();
    this.sp = options.sp ?? createSpClient(acquireSpAccessToken, baseUrl);
  }

  async add(observation: Omit<BehaviorObservation, 'id'>): Promise<BehaviorObservation> {
    const internalNames = await this.sp.getListFieldInternalNames(this.listTitle);
    this.assertRequiredFields(internalNames, {
      userId: FIELD_MAP_DAILY_ACTIVITY.userId,
      recordDate: FIELD_MAP_DAILY_ACTIVITY.recordDate,
    });

    const payload = this.toRequest(observation, internalNames);
    const url = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items`;
    const res = await this.sp.spFetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=nometadata',
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => payload)) as Record<string, unknown>;
    return this.toDomain(data ?? payload);
  }

  async getByUser(userId: string, options?: BehaviorQueryOptions): Promise<BehaviorObservation[]> {
    return this.listByUser(userId, options);
  }

  async listByUser(userId: string, options?: BehaviorQueryOptions): Promise<BehaviorObservation[]> {
    if (!userId) return [];

    // 🔥 動的フィールド取得：テナント差分に完全対応
    const internalNames = await this.sp.getListFieldInternalNames(this.listTitle);
    
    // 🚨 必須列の検証（500エラー根本対策）
    this.assertRequiredFields(internalNames, {
      userId: FIELD_MAP_DAILY_ACTIVITY.userId,
      recordDate: FIELD_MAP_DAILY_ACTIVITY.recordDate,
    });

    // ✅ ここから先は安全（必要列が確実に存在）
    const selectFields = buildDailyActivitySelectFields(Array.from(internalNames));
    const timestampField = FIELD_MAP_DAILY_ACTIVITY.recordDate;

    const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    if (isDev) {
      console.log('[daily/support] Fields検証OK', {
        userId,
        totalFields: internalNames.size,
        selectedFields: selectFields.length,
      });
    }

    const filters: string[] = [
      `${FIELD_MAP_DAILY_ACTIVITY.userId} eq '${this.escapeSingleQuotes(userId)}'`,
    ];

    // rowNo は数値型なので日付範囲フィルタは適用しない
    const canUseDateRange = /date|time/i.test(timestampField);
    if (canUseDateRange && options?.dateRange?.from) {
      filters.push(`${timestampField} ge '${options.dateRange.from}'`);
    }
    if (canUseDateRange && options?.dateRange?.to) {
      filters.push(`${timestampField} le '${options.dateRange.to}'`);
    }

    // rowNo は昇順が基本（手順の並び順）
    const defaultAscending = false;
    const isDescending = options?.order
      ? options.order !== 'asc'
      : !defaultAscending;
    const params = new URLSearchParams();
    params.set('$select', selectFields.join(','));
    params.set('$orderby', `${timestampField} ${isDescending ? 'desc' : 'asc'}`);
    if (filters.length) {
      params.set('$filter', filters.join(' and '));
    }
    const top = options?.limit ?? this.defaultTop;
    if (top && top > 0) {
      params.set('$top', String(top));
    }

    const url = `/lists/getbytitle('${encodeURIComponent(this.listTitle)}')/items?${params.toString()}`;
    const res = await this.sp.spFetch(url, { method: 'GET' });
    const json = (await res.json().catch(() => ({ value: [] }))) as { value?: Record<string, unknown>[] };
    
    // Phase 1: SharePoint userCode → ドメイン UserID (そのまま)
    return (json.value ?? []).map((item) => this.toDomain(item));
  }

  private toDomain(item: Record<string, unknown>): BehaviorObservation {
    const field = FIELD_MAP_DAILY_ACTIVITY;
    const get = <T = unknown>(key: string): T | undefined => item[key] as T | undefined;
    return {
      id: String(get(field.id) ?? ''),
      userId: String(get(field.userId) ?? ''),
      timestamp: String(get(field.recordDate) ?? ''),
      antecedent: null,
      behavior: String(get(field.behavior) ?? ''),
      consequence: null,
      intensity: Number(get(field.intensity) ?? 0) as BehaviorObservation['intensity'],
      durationMinutes: get<number | null>(field.duration) ?? undefined,
      memo: undefined,
      timeSlot: get<string | null>(field.timeSlot) ?? undefined,
      actualObservation: get<string | null>(field.observation) ?? undefined,
    };
  }

  private toRequest(
    observation: Omit<BehaviorObservation, 'id'>,
    internalNames?: Set<string>
  ): Record<string, unknown> {
    const fm = FIELD_MAP_DAILY_ACTIVITY;
    const order = this.toOrderMinutes(observation.timeSlot ?? '');
    const payload: Record<string, unknown> = {
      [fm.userId]: observation.userId,
      [fm.recordDate]: observation.timestamp,
      [fm.timeSlot]: observation.timeSlot ?? null,
      [fm.observation]: observation.actualObservation ?? observation.memo ?? null,
      [fm.behavior]: observation.behavior,
      [fm.intensity]: observation.intensity,
      [fm.duration]: observation.durationMinutes ?? null,
      ...(order !== null ? { [fm.order]: order } : {}),
    };

    if (!internalNames || internalNames.size === 0) {
      return payload;
    }

    const allowed = new Set(Array.from(internalNames, (name) => name.toLowerCase()));
    return Object.fromEntries(
      Object.entries(payload).filter(([key]) => allowed.has(key.toLowerCase()))
    );
  }

  private assertRequiredFields(internalNames: Set<string>, required: Record<string, string>): void {
    const missing: Array<[string, string]> = [];
    for (const [key, internalName] of Object.entries(required)) {
      if (!internalNames.has(internalName)) {
        missing.push([key, internalName]);
      }
    }

    if (missing.length === 0) return;

    const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const missingList = missing
      .map(([key, name]) => `  - ${key}: "${name}"`)
      .join('\n');

    const detail = isDev
      ? `\n\nAvailable internal names (最初の20件):\n${Array.from(internalNames)
          .sort()
          .slice(0, 20)
          .map((name) => `  ✓ ${name}`)
          .join('\n')}${
          internalNames.size > 20 ? `\n  ... 他 ${internalNames.size - 20} 件\n` : ''
        }`
      : '';

    const error = new Error(
      `[SharePointBehaviorRepository] 必要な列が見つかりません。\n\nMissing fields:\n${missingList}${detail}`
    );

    if (isDev) {
      console.error('[daily/support] フィールド検証エラー:', error);
    }

    throw error;
  }

  private ensureSharePointConfig(): void {
    const config = getAppConfig();
    if (!config.VITE_SP_RESOURCE || !config.VITE_SP_SITE_RELATIVE) {
      console.warn('[SharePointBehaviorRepository] SharePoint environment variables are missing.');
    }
  }

  private escapeSingleQuotes(value: string): string {
    return value.replace(/'/g, "''");
  }

  private toOrderMinutes(timeSlot: string): number | null {
    const base = (timeSlot ?? '').split('|')[0]?.trim();
    if (!base) return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(base);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
  }
}
