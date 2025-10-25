import { readEnv } from '@/lib/env';
import { readString } from '@/lib/env';
import type { UseSP } from '@/lib/spClient';
import { spWriteResilient, type SpWriteResult } from '@/lib/spWrite';
import { SCHEDULE_FIELD_CATEGORY } from '@/sharepoint/fields';
import type { SpScheduleItem } from '@/types';
import { buildScheduleSelectClause, handleScheduleOptionalFieldError } from './scheduleFeatures';
import { fromSpSchedule, toSpScheduleFields } from './spMap';
import { STATUS_DEFAULT } from './statusDictionary';
import type { ScheduleOrg } from './types';

const DEFAULT_LIST_TITLE = 'ScheduleEvents';
const LIST_TITLE = (() => {
  const override = readEnv('VITE_SP_LIST_SCHEDULES', '').trim();
  return override || DEFAULT_LIST_TITLE;
})();
const LIST_PATH = `/lists/getbytitle('${encodeURIComponent(LIST_TITLE)}')/items` as const;

const buildScheduleListPath = (_list: string, id?: number): string => (
  typeof id === 'number' ? `${LIST_PATH}(${id})` : LIST_PATH
);

const withScheduleFieldFallback = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error: unknown) {
    if (handleScheduleOptionalFieldError(error)) {
      return await operation();
    }
    throw error;
  }
};

const encodeODataDate = (iso: string): string => {
  const candidate = new Date(iso);
  if (Number.isNaN(candidate.getTime())) {
    throw new Error(`Invalid ISO datetime: ${iso}`);
  }
  return `datetime'${candidate.toISOString()}'`;
};

const buildOverlapFilter = (startIso: string, endIso: string): string => {
  return [
    `(${SCHEDULE_FIELD_CATEGORY} eq 'Org')`,
    `(EventDate lt ${encodeODataDate(endIso)})`,
    `(EndDate gt ${encodeODataDate(startIso)})`,
  ].join(' and ');
};

const getHeadersWithPrefs = (extra?: Record<string, string>) => ({
  Prefer: 'return=representation, odata.include-annotations="*"',
  ...extra,
});

const mapResponseItems = (payload: unknown): SpScheduleItem[] => {
  const coerce = (): SpScheduleItem[] => {
    if (!payload) return [];
    if (Array.isArray((payload as { value?: unknown }).value)) {
      return ((payload as { value: unknown[] }).value ?? []) as SpScheduleItem[];
    }
    if (Array.isArray(payload)) {
      return payload as SpScheduleItem[];
    }
    if (typeof payload === 'object' && payload !== null) {
      return [payload as SpScheduleItem];
    }
    return [];
  };

  const withEtag = (item: SpScheduleItem): SpScheduleItem => {
    if (!item || typeof item !== 'object') {
      return item;
    }
    const record = item as Record<string, unknown>;
    const annotation = record['@odata.etag'] as string | undefined;
    const fallback = record.ETag as string | undefined;
    const normalized = annotation ?? fallback;
    if (!normalized) {
      return item;
    }
    if (annotation === normalized && fallback === normalized) {
      return item;
    }
    return {
      ...item,
      '@odata.etag': normalized,
      ETag: normalized,
    } as SpScheduleItem;
  };

  return coerce().map(withEtag);
};

const ensureOrgSchedule = (schedule: ReturnType<typeof fromSpSchedule>): ScheduleOrg => {
  if (schedule.category !== 'Org') {
    throw new Error(`Expected Org schedule but received category ${schedule.category}`);
  }
  return schedule;
};

const parseSharePointJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const ensureWriteSuccess = <T>(result: SpWriteResult<T>): SpWriteResult<T> & { ok: true; raw: Response } => {
  if (!result.ok) {
    throw (result as Extract<typeof result, { ok: false }>).error ?? new Error('SharePoint write failed');
  }
  return result as SpWriteResult<T> & { ok: true; raw: Response };
};

const extractItem = (payload: unknown): SpScheduleItem | null => {
  if (!payload) return null;
  if (Array.isArray((payload as { value?: unknown[] }).value)) {
    const value = (payload as { value?: unknown[] }).value ?? [];
    return (value[0] ?? null) as SpScheduleItem | null;
  }
  if (typeof payload === 'object' && payload !== null) {
    if ('d' in (payload as Record<string, unknown>)) {
      const d = (payload as { d: unknown }).d;
      if (Array.isArray((d as { results?: unknown[] }).results)) {
        const results = (d as { results?: unknown[] }).results ?? [];
        return (results[0] ?? null) as SpScheduleItem | null;
      }
      return d as SpScheduleItem;
    }
  }
  return payload as SpScheduleItem;
};

const toNumericId = (id: string | number): number => {
  if (typeof id === 'number' && Number.isFinite(id)) return id;
  const parsed = Number(String(id ?? '').trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid SharePoint item id: ${id}`);
  }
  return parsed;
};

type ScheduleOrgDraft = Omit<ScheduleOrg, 'id' | 'etag'> & { id?: string; etag?: string };

const normalizeAudience = (input?: unknown): string[] | undefined => {
  if (!input) return undefined;
  if (Array.isArray(input)) {
    const values = input
      .map((part) => (typeof part === 'string' ? part : String(part ?? '')).trim())
      .filter((part) => part.length > 0);
    return values.length ? values : undefined;
  }
  if (typeof input === 'string') {
    const values = input
      .split(/[,\n\r\u3001\uFF0C]+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    return values.length ? values : undefined;
  }
  return undefined;
};

const coerceOrgSchedule = (input: Partial<ScheduleOrg>): ScheduleOrg => {
  const audience = normalizeAudience(input.audience);
  const resourceId = input.resourceId;
  const resourceString = typeof resourceId === 'string' ? resourceId.trim() : resourceId != null ? String(resourceId).trim() : '';
  const externalName = typeof input.externalOrgName === 'string' ? input.externalOrgName.trim() : '';
  const location = typeof input.location === 'string' ? input.location.trim() : '';
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  const title = typeof input.title === 'string' ? input.title : '';

  return {
    id: input.id ?? '',
    etag: input.etag ?? '',
    category: 'Org',
    title,
    start: input.start ?? '',
    end: input.end ?? '',
    allDay: Boolean(input.allDay),
  status: input.status ?? STATUS_DEFAULT,
    location: location.length ? location : undefined,
    notes: notes.length ? notes : undefined,
    recurrenceRule: input.recurrenceRule,
    dayKey: input.dayKey,
    fiscalYear: input.fiscalYear,
    subType: input.subType ?? '会議',
    audience: audience ? [...audience] : undefined,
    resourceId: resourceString.length ? resourceString : undefined,
    externalOrgName: externalName.length ? externalName : undefined,
  } satisfies ScheduleOrg;
};

export async function getOrgScheduleById(sp: UseSP, id: string | number): Promise<ScheduleOrg> {
  const numericId = toNumericId(id);
  const params = new URLSearchParams();
  params.set('$select', buildScheduleSelectClause());

  const execute = async () => {
    const res = await sp.spFetch(`${LIST_PATH}(${numericId})?${params.toString()}`, {
      headers: getHeadersWithPrefs(),
    });
    const payload = await res.json();
    const item = extractItem(payload);
    if (!item) {
      throw new Error(`Schedule item #${numericId} not found`);
    }
    return ensureOrgSchedule(fromSpSchedule(item));
  };

  return withScheduleFieldFallback(execute);
}

export async function getOrgSchedules(
  sp: UseSP,
  params: {
    start: string;
    end: string;
    top?: number;
  }
): Promise<ScheduleOrg[]> {
  const execute = async () => {
    const search = new URLSearchParams();
    search.set('$top', String(params.top ?? 500));
    search.set('$filter', buildOverlapFilter(params.start, params.end));
    search.set('$orderby', 'EventDate asc,Id asc');
    search.set('$select', buildScheduleSelectClause());

    const path = `${LIST_PATH}?${search.toString()}`;

    // 開発環境での無限リトライ防止
    const isDevelopment = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

    try {
      const res = await sp.spFetch(path, {
        headers: getHeadersWithPrefs(),
      });

      // 開発環境で400エラーの場合、SharePointフィールド問題として早期に例外を投げる
      if (isDevelopment && !res.ok && res.status === 400) {
        throw new Error(`SharePoint API 400 Bad Request: フィールド設定またはリスト構造の問題 (Org) (URL: ${path.substring(0, 200)}...)`);
      }

      const payload = await res.json();
      return mapResponseItems(payload).map((item) => ensureOrgSchedule(fromSpSchedule(item)));
    } catch (error) {
      // 開発環境でのネットワークエラーも早期に例外化
      if (isDevelopment) {
        const errMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`SharePoint接続エラー (開発環境/Org): ${errMsg}`);
      }
      throw error;
    }
  };

  return withScheduleFieldFallback(execute);
}

export async function createOrgSchedule(sp: UseSP, draft: ScheduleOrgDraft): Promise<ScheduleOrg> {
  const candidate = coerceOrgSchedule({ ...draft, category: 'Org' });
  const execute = async () => {
    const writeResult = await spWriteResilient({
      list: LIST_TITLE,
      method: 'POST',
      body: toSpScheduleFields(candidate),
      additionalHeaders: getHeadersWithPrefs(),
      urlBuilder: buildScheduleListPath,
      fetcher: sp.spFetch,
      parse: parseSharePointJson,
    });
    const res = ensureWriteSuccess(writeResult);
    const json = (res.data as unknown) ?? null;
    const item = extractItem(json);
    if (item) {
      return ensureOrgSchedule(fromSpSchedule(item));
    }
    const newId = (json as { Id?: number })?.Id ?? (json as { d?: { Id?: number } })?.d?.Id;
    if (newId != null) {
      return getOrgScheduleById(sp, newId);
    }
    throw new Error('Failed to parse SharePoint create response');
  };

  return withScheduleFieldFallback(execute);
}

export async function updateOrgSchedule(sp: UseSP, schedule: ScheduleOrg): Promise<ScheduleOrg> {
  const candidate = coerceOrgSchedule(schedule);
  const id = toNumericId(candidate.id);
  try {
    const execute = async () => {
      const writeResult = await spWriteResilient({
        list: LIST_TITLE,
        itemId: id,
        method: 'PATCH',
        body: toSpScheduleFields(candidate),
        ifMatch: candidate.etag ?? undefined,
        additionalHeaders: getHeadersWithPrefs(),
        urlBuilder: buildScheduleListPath,
        fetcher: sp.spFetch,
        parse: parseSharePointJson,
      });

      const res = ensureWriteSuccess(writeResult);

      if (res.raw.status === 204 || !res.raw.headers.get('Content-Type')) {
        return getOrgScheduleById(sp, id);
      }

      const json = (res.data as unknown) ?? null;
      const updated = extractItem(json);
      if (updated) {
        return ensureOrgSchedule(fromSpSchedule(updated));
      }
      return getOrgScheduleById(sp, id);
    };

    return await withScheduleFieldFallback(execute);
  } catch (error: unknown) {
    if ((error as { code?: string } | null)?.code === 'conflict') {
      (error as Record<string, unknown>)._httpStatus = 412;
    }
    throw error;
  }
}

export async function deleteOrgSchedule(sp: UseSP, item: Pick<ScheduleOrg, 'id' | 'etag'>): Promise<void> {
  const numericId = toNumericId(item.id);
  try {
    const result = await spWriteResilient({
      list: LIST_TITLE,
      itemId: numericId,
      method: 'DELETE',
      ifMatch: item.etag ?? undefined,
      urlBuilder: buildScheduleListPath,
      fetcher: sp.spFetch,
    });
    ensureWriteSuccess(result);
  } catch (error: unknown) {
    if ((error as { code?: string } | null)?.code === 'conflict') {
      (error as Record<string, unknown>)._httpStatus = 412;
    }
    throw error;
  }
}
