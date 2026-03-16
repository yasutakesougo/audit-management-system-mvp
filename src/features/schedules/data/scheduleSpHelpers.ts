/**
 * Schedule SharePoint Request Helpers
 *
 * Contains pure helper functions for building SharePoint REST API requests:
 * date formatting, OData filter/query construction, error detection, and
 * field metadata introspection.
 *
 * @module features/schedules/data/scheduleSpHelpers
 */

// eslint-disable-next-line no-restricted-imports -- Phase 3-C: spClient 移行予定
import { fetchSp } from '@/lib/fetchSp';
import { ensureConfig } from '@/lib/spClient';

import type { DateRange, SchedItem } from './port';
import { mapSpRowToSchedule, parseSpScheduleRows } from './spRowSchema';
import {
    buildSchedulesListPath,
    getSchedulesListTitle,
    resolveSchedulesListIdentifier,
} from './spSchema';

import {
    buildSelectSets,
    sortByStart,
    type ListFieldMeta,
    type ScheduleFieldNames,
    type SharePointResponse,
} from './scheduleSpMappers';

import { SCHEDULES_DEBUG } from '../debug';

// ============================================================================
// Timezone Helpers
// ============================================================================

/**
 * Timezone used for all schedule date keys
 * CRITICAL: Always use site timezone (JST) to prevent UTC offset bugs
 */
const SCHEDULES_TZ = 'Asia/Tokyo';

/**
 * Get date key (YYYY-MM-DD) in site timezone
 * @param date - Date object (can be in any timezone)
 * @param timeZone - IANA timezone (default: Asia/Tokyo)
 * @returns Date string in YYYY-MM-DD format using site timezone
 */
export function dayKeyInTz(date: Date, timeZone: string = SCHEDULES_TZ): string {
  // sv-SE locale returns YYYY-MM-DD format
  return new Intl.DateTimeFormat('sv-SE', { timeZone }).format(date);
}

/**
 * Get month key (YYYY-MM) in site timezone
 * @param date - Date object (can be in any timezone)
 * @param timeZone - IANA timezone (default: Asia/Tokyo)
 * @returns Month string in YYYY-MM format using site timezone
 */
export function monthKeyInTz(date: Date, timeZone: string = SCHEDULES_TZ): string {
  const day = dayKeyInTz(date, timeZone); // YYYY-MM-DD
  return day.slice(0, 7); // YYYY-MM
}

// ============================================================================
// OData Query Builders
// ============================================================================

/**
 * Strip 'Z' suffix so SharePoint interprets as site timezone (JST) not UTC
 * Prevents 9-hour offset causing week boundary mismatches
 */
export const toIsoWithoutZ = (date: Date): string => {
  const iso = date.toISOString();
  return iso.endsWith('Z') ? iso.slice(0, -1) : iso;
};

export const buildRangeFilter = (range: DateRange, fields: ScheduleFieldNames): string => {
  // Add ±1 day buffer for timezone/all-day event safety (SharePoint best practice)
  const fromBuffer = toIsoWithoutZ(new Date(new Date(range.from).getTime() - 24 * 60 * 60 * 1000));
  const toBuffer = toIsoWithoutZ(new Date(new Date(range.to).getTime() + 24 * 60 * 60 * 1000));
  const fromLiteral = encodeDateLiteral(fromBuffer);
  const toLiteral = encodeDateLiteral(toBuffer);
  return `(${fields.start} lt ${toLiteral}) and (${fields.end} ge ${fromLiteral})`;
};

export const encodeDateLiteral = (value: string): string => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid date value: ${value}`);
  }
  // Remove 'Z' so SharePoint interprets as site timezone (JST)
  const iso = new Date(parsed).toISOString();
  const withoutZ = iso.endsWith('Z') ? iso.slice(0, -1) : iso;
  return `datetime'${withoutZ}'`;
};

// ============================================================================
// Error Detection
// ============================================================================

export const isMissingFieldError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message ?? '';
  return /does not exist|cannot find field|存在しません/i.test(message);
};

/**
 * Extract HTTP status code from various error shapes
 * Phase 2-1b: Used for 412 Precondition Failed detection
 */
export const getHttpStatus = (e: unknown): number | undefined => {
  if (!e || typeof e !== 'object') return undefined;
  const obj = e as Record<string, unknown>;

  // Direct status
  if (typeof obj.status === 'number') return obj.status;

  // Nested response.status / response.statusCode
  if (obj.response && typeof obj.response === 'object') {
    const resp = obj.response as Record<string, unknown>;
    if (typeof resp.status === 'number') return resp.status;
    if (typeof resp.statusCode === 'number') return resp.statusCode;
  }

  // Nested cause.status / cause.response.status
  if (obj.cause && typeof obj.cause === 'object') {
    const cause = obj.cause as Record<string, unknown>;
    if (typeof cause.status === 'number') return cause.status;
    if (cause.response && typeof cause.response === 'object') {
      const causeResp = cause.response as Record<string, unknown>;
      if (typeof causeResp.status === 'number') return causeResp.status;
    }
  }

  return undefined;
};

// ============================================================================
// SharePoint Response Helpers
// ============================================================================

export const readSpErrorMessage = async (response: Response): Promise<string> => {
  const text = await response.text().catch(() => '');
  if (!text) return '';
  try {
    const data = JSON.parse(text) as {
      error?: { message?: { value?: string } };
      'odata.error'?: { message?: { value?: string } };
      message?: { value?: string };
    };
    return (
      data.error?.message?.value ??
      data['odata.error']?.message?.value ??
      data.message?.value ??
      ''
    );
  } catch {
    return text.slice(0, 4000);
  }
};

// ============================================================================
// SharePoint Fetch Operations
// ============================================================================

export const fetchRange = async (
  range: DateRange,
  select: readonly string[],
  fields: ScheduleFieldNames,
  options?: { includeOrderby?: boolean; includeFilter?: boolean; top?: number }
): Promise<ReturnType<typeof parseSpScheduleRows>> => {
  const { baseUrl } = ensureConfig();
  const listPath = buildSchedulesListPath(baseUrl);
  const params = new URLSearchParams();
  params.set('$top', String(options?.top ?? 500));
  if (options?.includeOrderby ?? true) {
    params.set('$orderby', `${fields.start} asc,Id asc`);
  }
  if (options?.includeFilter ?? true) {
    params.set('$filter', buildRangeFilter(range, fields));
  }
  params.set('$select', select.join(','));

  const url = `${listPath}?${params.toString()}`;
  const response = await fetchSp(url);
  if (!response.ok) {
    const message = await readSpErrorMessage(response);
    console.error('[schedules] SharePoint list query failed', {
      status: response.status,
      listTitle: getSchedulesListTitle(),
      url,
      select: select.join(','),
      includeOrderby: options?.includeOrderby ?? true,
      includeFilter: options?.includeFilter ?? true,
      message,
    });
    const error = new Error(message || `SharePoint request failed (${response.status})`);
    (error as { status?: number }).status = response.status;
    (error as { url?: string }).url = url;
    (error as { body?: string }).body = message;
    throw error;
  }
  const payload = (await response.json()) as SharePointResponse<unknown>;
  try {
    return parseSpScheduleRows(payload.value ?? []);
  } catch (parseError) {
    // Dump raw payload on parse failure (helps diagnose field/shape issues)
    console.error('[schedules] fetchRange parse failed', {
      url,
      status: response.status,
      payloadPreview: JSON.stringify(payload).slice(0, 2000),
    });
    throw parseError;
  }
};

/**
 * List field metadata for diagnostics
 */
export const getListFieldsMeta = async (): Promise<ListFieldMeta[]> => {
  const { baseUrl } = ensureConfig();
  const identifier = resolveSchedulesListIdentifier();
  const listBase = identifier.type === 'guid'
    ? `${baseUrl}/lists(guid'${identifier.value}')`
    : `${baseUrl}/lists/getbytitle('${identifier.value.replace(/'/g, "''")}')`;
  const url = `${listBase}/fields?$select=InternalName,TypeAsString,Required,Choices&$filter=Hidden eq false`;

  const response = await fetchSp(url);
  if (!response.ok) {
    const message = await readSpErrorMessage(response);
    const error = new Error(message || `SharePoint request failed (${response.status})`);
    (error as { status?: number }).status = response.status;
    (error as { url?: string }).url = url;
    (error as { body?: string }).body = message;
    throw error;
  }

  const payload = (await response.json()) as SharePointResponse<{
    InternalName?: string;
    TypeAsString?: string;
    Required?: boolean;
    Choices?: { results?: string[] } | string[];
  }>;

  const fields = (payload.value ?? [])
    .map((field) => {
      const internalName = field.InternalName ?? '';
      if (!internalName) return null;
      const rawChoices = Array.isArray(field.Choices)
        ? field.Choices
        : field.Choices?.results;

      return {
        internalName,
        type: field.TypeAsString ?? 'Unknown',
        required: Boolean(field.Required),
        choices: rawChoices?.filter(Boolean),
      };
    })
    .filter(Boolean);
  return fields as ListFieldMeta[];
};

/**
 * Default list range implementation with progressive fallback stages
 */
export const defaultListRange = async (range: DateRange): Promise<SchedItem[]> => {
  const listTitle = getSchedulesListTitle().trim().toLowerCase();
  if (listTitle === 'dailyopssignals') {
    if (SCHEDULES_DEBUG) {
      console.warn('[schedules] DailyOpsSignals is not a schedules list; skipping fetch.');
    }
    return [];
  }

  const isEventList = listTitle === 'scheduleevents';
  const { fields, eventSafe, required, selectVariants } = buildSelectSets();
  const selectFull = isEventList ? eventSafe : selectVariants[0];
  const selectLite = isEventList ? eventSafe : selectVariants[1];
  const selectMin = isEventList ? required : selectVariants[2];
  const stages = [
    { name: 'full', select: selectFull, keepOrderby: true, keepFilter: true, top: 500 },
    { name: 'selectLite', select: selectLite, keepOrderby: true, keepFilter: true, top: 500 },
    { name: 'noOrderby', select: selectLite, keepOrderby: false, keepFilter: true, top: 500 },
    { name: 'noFilter', select: selectMin, keepOrderby: false, keepFilter: false, top: 1 },
  ] as const;

  const diagnostics: Array<{ stage: string; url: string; status?: number; body?: string }> = [];

  for (const stage of stages) {
    try {
      const rows = await fetchRange(range, stage.select, fields, {
        includeOrderby: stage.keepOrderby,
        includeFilter: stage.keepFilter,
        top: stage.top,
      });
      if (SCHEDULES_DEBUG) {
        console.info(`[schedules] ✅ stage=${stage.name} succeeded`);
      }
      return sortByStart(rows.map(mapSpRowToSchedule).filter((item): item is SchedItem => Boolean(item)));
    } catch (error) {
      const status = getHttpStatus(error);
      const url = (error as { url?: string }).url ?? '';
      const rawBody = (error as { body?: unknown }).body;
      const body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody, null, 2);
      diagnostics.push({ stage: stage.name, url, status, body });

      const shouldFallback = isMissingFieldError(error) || status === 400;
      if (!shouldFallback) {
        throw error;
      }
      if (SCHEDULES_DEBUG) {
        console.warn('[schedules] SharePoint list fallback stage failed, retrying with alternate query.', stage, error);
      }
    }
  }

  const detail = diagnostics
    .map((d) => `--- stage=${d.stage} status=${d.status ?? 'unknown'}\nurl=${d.url}\nbody=${d.body ?? ''}`)
    .join('\n');
  throw new Error(`[schedules] 400 persisted across fallback stages.\n${detail}`);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const _fetchItemById = async (id: number): Promise<SchedItem> => {
  const { baseUrl } = ensureConfig();
  const listPath = buildSchedulesListPath(baseUrl);
  const { selectVariants } = buildSelectSets();

  for (let index = 0; index < selectVariants.length; index += 1) {
    const select = selectVariants[index];
    const params = new URLSearchParams();
    params.set('$select', select.join(','));

    try {
      const response = await fetchSp(`${listPath}(${id})?${params.toString()}`);
      const row = (await response.json()) as unknown;
      const mapped = mapSpRowToSchedule(row as never);
      if (!mapped) {
        throw new Error('更新後の予定データをマッピングできませんでした');
      }
      return mapped;
    } catch (error) {
      const isLastAttempt = index === selectVariants.length - 1;
      if (!isMissingFieldError(error) || isLastAttempt) {
        throw error;
      }
      if (SCHEDULES_DEBUG) {
        console.warn('[schedules] SharePoint item fetch missing optional field, retrying with alternate select.', select, error);
      }
    }
  }

  throw new Error('予定データの取得に失敗しました');
};
