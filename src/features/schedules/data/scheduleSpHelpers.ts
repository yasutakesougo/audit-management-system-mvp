/**
 * Schedule SharePoint Request Helpers
 *
 * Contains pure helper functions for building SharePoint REST API requests:
 * date formatting, OData filter/query construction, error detection, and
 * field metadata introspection.
 *
 * All fetch operations accept `spFetch: SpFetchFn` via explicit parameter injection.
 *
 * @module features/schedules/data/scheduleSpHelpers
 */

import type { IDataProvider } from '@/lib/data/dataProvider.interface';

import type { DateRange, SchedItem } from './port';
import { mapSpRowToSchedule, parseSpScheduleRows } from './spRowSchema';
import {
    getSchedulesListTitle,
} from './spSchema';

import {
    buildSelectSets,
    resolveScheduleFieldVariants,
    sortByStart,
    type ListFieldMeta,
    type ScheduleFieldNames,
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
 * SharePoint-safe UTC ISO8601 literal (no milliseconds, with trailing Z).
 */
export const toIsoWithoutZ = (date: Date): string => {
  return date.toISOString().replace(/\.\d{3}Z$/u, 'Z');
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
  const isoUtc = toIsoWithoutZ(new Date(parsed));
  return `datetime'${isoUtc}'`;
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

// readSpErrorMessage 削除: spFetch (throwOnError: true) が SpHttpError として自動 throw する

// ============================================================================
// SharePoint Fetch Operations
// ============================================================================

/**
 * Fetch schedule items within a date range.
 * Uses spFetch (DI) with relative paths.
 */
export const fetchRange = async (
  provider: IDataProvider,
  range: DateRange,
  select: readonly string[],
  fields: ScheduleFieldNames,
  options?: { includeOrderby?: boolean; includeFilter?: boolean; top?: number }
): Promise<ReturnType<typeof parseSpScheduleRows>> => {
  const resourceName = getSchedulesListTitle();
  
  const rows = await provider.listItems<unknown>(resourceName, {
    select: [...select],
    filter: options?.includeFilter !== false ? buildRangeFilter(range, fields) : undefined,
    orderby: options?.includeOrderby !== false ? `${fields.start} asc,Id asc` : undefined,
    top: options?.top ?? 500,
  });

  try {
    return parseSpScheduleRows(rows);
  } catch (parseError) {
    // Dump diagnostic info on parse failure
    console.error('[schedules] fetchRange parse failed', {
      resourceName,
      rowsCount: rows.length,
    });
    throw parseError;
  }
};

/**
 * List field metadata for diagnostics.
 * Uses spFetch (DI) with relative paths.
 */
export const getListFieldsMeta = async (provider: IDataProvider): Promise<ListFieldMeta[]> => {
  // getMetadata returns the resolved list metadata. 
  // For granular field info, we might need a more specific provider method, 
  // but for now we'll assume the provider provides this.
  const resourceName = getSchedulesListTitle();
  const meta = await provider.getMetadata?.(resourceName);
  
  if (!meta || !('value' in meta) || !Array.isArray(meta.value)) return [];

  const fields = (meta.value as unknown[])
    .map((field) => {
      if (!field || typeof field !== 'object') return null;
      const f = field as Record<string, unknown>;
      const internalName = (f.InternalName as string) ?? '';
      if (!internalName) return null;
      
      const rawChoices = Array.isArray(f.Choices)
        ? (f.Choices as string[])
        : (f.Choices as any)?.results as string[] | undefined;

      return {
        internalName,
        type: (f.TypeAsString as string) ?? 'Unknown',
        required: Boolean(f.Required),
        choices: rawChoices?.filter(Boolean),
      };
    })
    .filter(Boolean);
  return fields as ListFieldMeta[];
};

/**
 * Default list range implementation with progressive fallback stages.
 * Accepts spFetch (DI) for all SharePoint communication.
 */
export const defaultListRange = async (provider: IDataProvider, range: DateRange): Promise<SchedItem[]> => {
  const listTitle = getSchedulesListTitle().trim().toLowerCase();
  if (listTitle === 'dailyopssignals') {
    if (SCHEDULES_DEBUG) {
      console.warn('[schedules] DailyOpsSignals is not a schedules list; skipping fetch.');
    }
    return [];
  }

  const isEventList = listTitle === 'scheduleevents';
  const fieldVariants = resolveScheduleFieldVariants();

  const diagnostics: Array<{ stage: string; url: string; status?: number; body?: string }> = [];

  for (let variantIndex = 0; variantIndex < fieldVariants.length; variantIndex += 1) {
    const fields = fieldVariants[variantIndex];
    const { eventSafe, required, selectVariants } = buildSelectSets(fields);
    const selectFull = isEventList ? eventSafe : selectVariants[0];
    const selectLite = isEventList ? eventSafe : selectVariants[1];
    const selectMin = isEventList ? required : selectVariants[2];
    const stages = [
      { name: 'minimal', select: selectMin, keepOrderby: true, keepFilter: true, top: 500 },
      { name: 'selectLite', select: selectLite, keepOrderby: true, keepFilter: true, top: 500 },
      { name: 'full', select: selectFull, keepOrderby: true, keepFilter: true, top: 500 },
      { name: 'noOrderby', select: selectLite, keepOrderby: false, keepFilter: true, top: 500 },
      { name: 'probeNoFilter', select: selectMin, keepOrderby: false, keepFilter: false, top: 1 },
    ] as const;

    for (const stage of stages) {
      try {
        const rows = await fetchRange(provider, range, stage.select, fields, {
          includeOrderby: stage.keepOrderby,
          includeFilter: stage.keepFilter,
          top: stage.top,
        });
        if (SCHEDULES_DEBUG) {
          console.info(`[schedules] ✅ stage=${stage.name} variant=${fields.start}/${fields.end} succeeded`);
        }
        return sortByStart(rows.map(mapSpRowToSchedule).filter((item): item is SchedItem => Boolean(item)));
      } catch (error) {
        const status = getHttpStatus(error);
        const url = (error as { url?: string }).url ?? '';
        const rawBody = (error as { body?: unknown }).body;
        const body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody, null, 2);
        diagnostics.push({
          stage: `${stage.name}[${fields.start}/${fields.end}]`,
          url,
          status,
          body,
        });

        const shouldFallback = isMissingFieldError(error) || status === 400;
        if (!shouldFallback) {
          throw error;
        }
        if (SCHEDULES_DEBUG) {
          console.warn('[schedules] SharePoint list fallback stage failed, retrying with alternate query.', stage, error);
        }
      }
    }
  }

  const detail = diagnostics
    .map((d) => `--- stage=${d.stage} status=${d.status ?? 'unknown'}\nurl=${d.url}\nbody=${d.body ?? ''}`)
    .join('\n');
  throw new Error(`[schedules] 400 persisted across fallback stages.\n${detail}`);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const _fetchItemById = async (provider: IDataProvider, id: number): Promise<SchedItem> => {
  const resourceName = getSchedulesListTitle();
  const { selectVariants } = buildSelectSets();

  for (let index = 0; index < selectVariants.length; index += 1) {
    const select = selectVariants[index];

    try {
      const row = await provider.getItemById<unknown>(resourceName, id, {
        select: [...select],
      });
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
