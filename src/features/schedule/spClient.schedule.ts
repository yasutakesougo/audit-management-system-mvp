import { HYDRATION_FEATURES, estimatePayloadSize, startFeatureSpan } from '@/hydration/features';
import { readEnv } from '@/lib/env';
import type { UseSP } from '@/lib/spClient';
import { spWriteResilient, type SpWriteResult } from '@/lib/spWrite';
import {
    SCHEDULE_FIELD_CATEGORY,
    SCHEDULE_FIELD_PERSON_TYPE,
    SCHEDULE_FIELD_SERVICE_TYPE,
} from '@/sharepoint/fields';
import type { SpScheduleItem } from '@/types';
import { buildScheduleSelectClause, handleScheduleOptionalFieldError } from './scheduleFeatures';
import { fromSpSchedule, toSpScheduleFields } from './spMap';
import { STATUS_DEFAULT } from './statusDictionary';
import type { ScheduleUserCare, ServiceType } from './types';
import { validateUserCare } from './validation';

type ScheduleUserCareDraft = Omit<ScheduleUserCare, 'id' | 'etag'> & {
  id?: string;
  etag?: string;
};

const DEFAULT_LIST_TITLE = 'ScheduleEvents';
const LIST_TITLE = (() => {
  const override = readEnv('VITE_SP_LIST_SCHEDULES', '').trim();
  return override || DEFAULT_LIST_TITLE;
})();
const escapeODataString = (input: string): string => input.replace(/'/g, "''");
const buildListPath = (title: string): string => {
  const guid = title.replace(/^guid:/i, '').replace(/[{}]/g, '').trim();
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(guid)) {
    return `/lists(guid'${guid}')/items`;
  }
  return `/lists/getbytitle('${escapeODataString(title)}')/items`;
};
const LIST_PATH = buildListPath(LIST_TITLE);

const buildScheduleListPath = (list: string, id?: number): string => {
  const base = buildListPath(list);
  return typeof id === 'number' ? `${base}(${id})` : base;
};

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

const toNumericId = (id: string | number): number => {
  if (typeof id === 'number' && Number.isFinite(id)) return id;
  const parsed = Number(String(id ?? '').trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid SharePoint item id: ${id}`);
  }
  return parsed;
};

const buildOverlapFilter = (startIso: string, endIso: string, keyword?: string, personType?: 'Internal' | 'External', serviceType?: ServiceType): string => {
  const parts = [
    `(${SCHEDULE_FIELD_CATEGORY} eq 'User')`,
    `(EventDate lt ${encodeODataDate(endIso)})`,
    `(EndDate gt ${encodeODataDate(startIso)})`,
  ];

  if (keyword?.trim()) {
    const safe = keyword.replace(/'/g, "''");
    parts.push(`substringof('${safe}', Title)`);
  }
  if (personType) {
    parts.push(`(${SCHEDULE_FIELD_PERSON_TYPE} eq '${personType}')`);
  }
  if (serviceType) {
    parts.push(`(${SCHEDULE_FIELD_SERVICE_TYPE} eq '${serviceType}')`);
  }

  return parts.join(' and ');
};

const coerceUserCare = (input: Partial<ScheduleUserCare>): ScheduleUserCare => ({
  id: input.id ?? '',
  etag: input.etag ?? '',
  category: 'User',
  title: input.title ?? '',
  start: input.start ?? '',
  end: input.end ?? '',
  allDay: Boolean(input.allDay),
  status: input.status ?? STATUS_DEFAULT,
  location: input.location,
  notes: input.notes,
  recurrenceRule: input.recurrenceRule,
  dayKey: input.dayKey,
  fiscalYear: input.fiscalYear,
  serviceType: input.serviceType as ScheduleUserCare['serviceType'],
  personType: input.personType as ScheduleUserCare['personType'],
  personId: input.personId,
  personName: input.personName,
  userLookupId: input.userLookupId,
  externalPersonName: input.externalPersonName,
  externalPersonOrg: input.externalPersonOrg,
  externalPersonContact: input.externalPersonContact,
  staffIds: [...(input.staffIds ?? [])],
  staffNames: input.staffNames ? [...input.staffNames] : undefined,
}) as ScheduleUserCare;

const ensureUserSchedule = (schedule: ReturnType<typeof fromSpSchedule>): ScheduleUserCare => {
  if (schedule.category !== 'User') {
    throw new Error(`Expected User schedule but received category ${schedule.category}`);
  }
  return schedule;
};

const extractItem = (payload: unknown): SpScheduleItem | null => {
  if (!payload) return null;
  if (Array.isArray((payload as { value?: unknown }).value)) {
    const value = (payload as { value: unknown[] }).value;
    return (value[0] ?? null) as SpScheduleItem | null;
  }
  if (typeof payload === 'object' && payload !== null) {
    if ('d' in (payload as Record<string, unknown>)) {
      const d = (payload as { d: unknown }).d;
      if (Array.isArray((d as { results?: unknown }).results)) {
        const results = (d as { results: unknown[] }).results;
        return (results[0] ?? null) as SpScheduleItem | null;
      }
      return d as SpScheduleItem;
    }
  }
  return payload as SpScheduleItem;
};

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

const getHeadersWithPrefs = (extra?: Record<string, string>) => ({
  Prefer: 'return=representation, odata.include-annotations="*"',
  ...extra,
});


const parseSharePointJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const ensureWriteSuccess = <T>(result: SpWriteResult<T>): SpWriteResult<T> & { ok: true; raw: Response } => {
  if (!result.ok) {
    throw result.error ?? new Error('SharePoint write failed');
  }
  return result as SpWriteResult<T> & { ok: true; raw: Response };
};

export async function getUserCareSchedules(
  sp: UseSP,
  params: {
    start: string;
    end: string;
    keyword?: string;
    personType?: 'Internal' | 'External';
    serviceType?: '一時ケア' | 'ショートステイ';
    top?: number;
  }
): Promise<ScheduleUserCare[]> {
  const span = startFeatureSpan(HYDRATION_FEATURES.schedules.load, {
    scope: 'userCare',
    hasKeyword: Boolean(params.keyword),
  });
  const execute = async () => {
    const search = new URLSearchParams();
    search.set('$top', String(params.top ?? 500));
    search.set('$filter', buildOverlapFilter(params.start, params.end, params.keyword, params.personType, params.serviceType));
    search.set('$orderby', 'EventDate asc,Id asc');
    search.set('$select', buildScheduleSelectClause());

    const path = `${LIST_PATH}?${search.toString()}`;

    // 開発環境での無限リトライ防止
    const isDevelopment = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

    try {
      const res = await sp.spFetch(path, { headers: getHeadersWithPrefs() });

      // 開発環境で400エラーの場合、SharePointフィールド問題として早期に例外を投げる
      if (isDevelopment && !res.ok && res.status === 400) {
        throw new Error(`SharePoint API 400 Bad Request: フィールド設定またはリスト構造の問題 (URL: ${path.substring(0, 200)}...)`);
      }

      const payload = await res.json();
      return mapResponseItems(payload).map((item) => ensureUserSchedule(fromSpSchedule(item)));
    } catch (error) {
      // 開発環境でのネットワークエラーも早期に例外化
      if (isDevelopment) {
        const errMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`SharePoint接続エラー (開発環境): ${errMsg}`);
      }
      throw error;
    }
  };

  try {
    const result = await withScheduleFieldFallback(execute);
    span({ meta: { status: 'ok', count: result.length, bytes: estimatePayloadSize(result) } });
    return result;
  } catch (error) {
    span({
      meta: { status: 'error' },
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function createUserCare(sp: UseSP, draft: ScheduleUserCareDraft): Promise<ScheduleUserCare> {
  const candidate = coerceUserCare({ ...draft, category: 'User' });
  validateUserCare(candidate);

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
      return ensureUserSchedule(fromSpSchedule(item));
    }
    const newId = (json as { Id?: number })?.Id ?? (json as { d?: { Id?: number } })?.d?.Id;
    if (newId != null) {
      return getUserCareById(sp, newId);
    }
    throw new Error('Failed to parse SharePoint create response');
  };

  return withScheduleFieldFallback(execute);
}

export async function updateUserCare(sp: UseSP, item: ScheduleUserCare): Promise<ScheduleUserCare> {
  const candidate = coerceUserCare(item);
  validateUserCare(candidate);

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
        return getUserCareById(sp, id);
      }

      const json = (res.data as unknown) ?? null;
      const updated = extractItem(json);
      if (updated) {
        return ensureUserSchedule(fromSpSchedule(updated));
      }
      return getUserCareById(sp, id);
    };

    return await withScheduleFieldFallback(execute);
  } catch (error: unknown) {
    if ((error as { code?: string } | null)?.code === 'conflict') {
      (error as Record<string, unknown>)._httpStatus = 412;
    }
    throw error;
  }
}

export async function getUserCareById(sp: UseSP, id: number | string): Promise<ScheduleUserCare> {
  const numericId = toNumericId(id);
  const params = new URLSearchParams();
  params.set('$select', buildScheduleSelectClause());

  const execute = async () => {
    const res = await sp.spFetch(`${LIST_PATH}(${numericId})?${params.toString()}`, { headers: getHeadersWithPrefs() });
    const payload = await res.json();
    const item = extractItem(payload);
    if (!item) {
      throw new Error(`Schedule item #${numericId} not found`);
    }
    return ensureUserSchedule(fromSpSchedule(item));
  };

  return withScheduleFieldFallback(execute);
}

export async function deleteUserCare(sp: UseSP, item: Pick<ScheduleUserCare, 'id' | 'etag'>): Promise<void> {
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

type MonthlyScheduleParams = {
  year: number;
  month: number;
  keyword?: string;
  personType?: 'Internal' | 'External';
  serviceType?: '一時ケア' | 'ショートステイ';
  top?: number;
};

const clampMonth = (value: number): number => {
  if (!Number.isFinite(value) || value < 1 || value > 12) {
    throw new Error(`Invalid month value: ${value}`);
  }
  return Math.trunc(value);
};

const clampYear = (value: number): number => {
  if (!Number.isFinite(value) || value < 1970 || value > 9999) {
    throw new Error(`Invalid year value: ${value}`);
  }
  return Math.trunc(value);
};

export async function getMonthlySchedule(sp: UseSP, params: MonthlyScheduleParams): Promise<ScheduleUserCare[]> {
  const year = clampYear(params.year);
  const month = clampMonth(params.month);

  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1, 0, 0, 0, 0));

  return getUserCareSchedules(sp, {
    start: monthStart.toISOString(),
    end: monthEnd.toISOString(),
    keyword: params.keyword,
    personType: params.personType,
    serviceType: params.serviceType,
    top: params.top,
  });
}
