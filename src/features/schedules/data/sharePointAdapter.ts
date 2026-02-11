import { toSafeError } from '@/lib/errors';
import { fetchSp } from '@/lib/fetchSp';
import { AuthRequiredError } from '@/lib/errors';
import { withUserMessage } from '@/lib/notice';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { result } from '@/shared/result';
import { SCHEDULES_DEBUG } from '../debug';
import {
  createSchedule,
  updateSchedule,
  removeSchedule,
  type CreateScheduleInput,
  type UpdateScheduleInput,
} from '@/infra/sharepoint/repos/schedulesRepo';

/**
 * Extract HTTP status code from various error shapes
 * Phase 2-1b: Used for 412 Precondition Failed detection
 */
const getHttpStatus = (e: unknown): number | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = e as any;
  return (
    anyErr?.status ??
    anyErr?.response?.status ??
    anyErr?.response?.statusCode ??
    anyErr?.cause?.status ??
    anyErr?.cause?.response?.status
  );
};
import type { DateRange, SchedItem, SchedulesPort, ScheduleServiceType } from './port';
import { mapSpRowToSchedule, parseSpScheduleRows } from './spRowSchema';
import { getSchedulesListTitle, SCHEDULES_FIELDS, buildSchedulesListPath } from './spSchema';

type ListRangeFn = (range: DateRange) => Promise<SchedItem[]>;

type SharePointSchedulesPortOptions = {
  acquireToken?: () => Promise<string | null>;
  listRange?: ListRangeFn;
  create?: SchedulesPort['create'];
  update?: SchedulesPort['update'];
  remove?: SchedulesPort['remove'];
  // Phase 1: Current user's ownerUserId for visibility filtering
  currentOwnerUserId?: string;
};

type SharePointResponse<T> = {
  value?: T[];
};

type ScheduleFieldNames = {
  title: string;
  start: string;
  end: string;
  serviceType?: string;
  locationName?: string;
};

const resolveScheduleFieldNames = (): ScheduleFieldNames => {
  const listTitle = getSchedulesListTitle().trim().toLowerCase();
  if (listTitle === 'dailyopssignals') {
    return {
      title: 'Title',
      start: 'date',
      end: 'date',
    };
  }

  return {
    title: SCHEDULES_FIELDS.title,
    start: SCHEDULES_FIELDS.start,
    end: SCHEDULES_FIELDS.end,
    serviceType: SCHEDULES_FIELDS.serviceType,
    locationName: SCHEDULES_FIELDS.locationName,
  };
};

const compact = (values: Array<string | undefined>): string[] =>
  values.filter((value): value is string => Boolean(value));

const buildSelectSets = () => {
  const fields = resolveScheduleFieldNames();
  const required = compact(['Id', fields.title, fields.start, fields.end]);
  // ScheduleEvents (BaseTemplate=106) only has basic event fields
  const optional = compact([
    fields.serviceType,
    fields.locationName,
    'Created',
    'Modified',
  ]);
  const eventSafe = compact([
    'Id',
    fields.title,
    fields.start,
    fields.end,
    fields.locationName,
    fields.serviceType,
  ]);
  const mergeSelectFields = (fallbackOnly: boolean): readonly string[] =>
    fallbackOnly ? [...required] : [...new Set([...required, ...optional])];
  const essentialService = compact([...required, fields.serviceType]);
  const selectVariants = [mergeSelectFields(false), essentialService, mergeSelectFields(true)] as const;

  return {
    fields,
    required,
    eventSafe,
    selectVariants,
  };
};

const defaultListRange: ListRangeFn = async (range) => {
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

const readSpErrorMessage = async (response: Response): Promise<string> => {
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

const fetchRange = async (
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

const buildRangeFilter = (range: DateRange, fields: ScheduleFieldNames): string => {
  // Add ±1 day buffer for timezone/all-day event safety (SharePoint best practice)
  const fromBuffer = new Date(new Date(range.from).getTime() - 24 * 60 * 60 * 1000).toISOString();
  const toBuffer = new Date(new Date(range.to).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const fromLiteral = encodeDateLiteral(fromBuffer);
  const toLiteral = encodeDateLiteral(toBuffer);
  return `(${fields.start} lt ${toLiteral}) and (${fields.end} ge ${fromLiteral})`;
};

const encodeDateLiteral = (value: string): string => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return `datetime'${new Date(parsed).toISOString()}'`;
};

const isMissingFieldError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message ?? '';
  return /does not exist|cannot find field|存在しません/i.test(message);
};

const sortByStart = (items: SchedItem[]): SchedItem[] =>
  [...items].sort((a, b) => a.start.localeCompare(b.start));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _fetchItemById = async (id: number): Promise<SchedItem> => {
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
/**
 * LEGACY: makeSharePointScheduleUpdater and makeSharePointScheduleRemover
 * Replaced by Step 3 repo layer (createSchedule, updateSchedule, removeSchedule)
 * in makeSharePointSchedulesPort. Removed to avoid dependency on toSharePointPayload/fetchItemById.
 */

/**
 * Helper: Map RepoSchedule → SchedItem
 * Bridges repo layer (internal names) to port layer (domain types)
 */
const mapRepoScheduleToSchedItem = (repo: Parameters<typeof mapSpRowToSchedule>[0]): SchedItem | null => {
  return mapSpRowToSchedule(repo);
};

/**
 * Helper: Generate rowKey for new schedule
 * Format: YYYYMMDD-HHMMSS-randomId (or use input-provided rowKey)
 */
const generateRowKey = (input?: string): string => {
  if (input) return input;
  const now = new Date();
  const date = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return `${date}${random}`;
};

export const makeSharePointSchedulesPort = (options?: SharePointSchedulesPortOptions): SchedulesPort => {
  // Create client for mutations if acquireToken is provided
  let client: ReturnType<typeof createSpClient> | null = null;
  if (options?.acquireToken) {
    const { baseUrl } = ensureConfig();
    client = createSpClient(options.acquireToken, baseUrl);
  }

  return {
    async list(range) {
      try {
        // Step 2: Use legacy defaultListRange (already working with SharePoint via fetchSp)
        const allItems = await defaultListRange(range);

        // Phase 1: visibility filtering
        if (!options?.currentOwnerUserId) {
          return allItems.filter(item => !item.visibility || item.visibility === 'org');
        }
        return allItems.filter(item => {
          const visibility = item.visibility ?? 'org';
          if (visibility === 'org') return true;
          if (visibility === 'team') return true; // Phase 1: team = org
          if (visibility === 'private') {
            return item.ownerUserId === options.currentOwnerUserId;
          }
          return true;
        });
      } catch (error) {
        const safe = toSafeError(error instanceof Error ? error : new Error(String(error)));
        const isAuthError = error instanceof AuthRequiredError || safe.code === 'AUTH_REQUIRED' || safe.name === 'AuthRequiredError';
        const userMessage = isAuthError
          ? 'サインインが必要です。右上の「サインイン」からログインしてください。'
          : '予定の取得に失敗しました。時間をおいて再試行してください。';
        throw withUserMessage(safe, userMessage);
      }
    },

    async create(input) {
      if (!client) {
        return result.err({
          kind: 'unknown',
          message: 'SharePoint client not available for create',
        });
      }

      try {
        // Extract start/end ISO strings
        const startIso = input.startLocal || new Date().toISOString();
        const endIso = input.endLocal || new Date(Date.now() + 3600000).toISOString();

        // Parse dates for day/month/fiscal year
        const startDate = new Date(startIso);
        const dayKey = startDate.toISOString().slice(0, 10); // YYYY-MM-DD
        const monthKey = startDate.toISOString().slice(0, 7); // YYYY-MM
        const fiscalYear = String(startDate.getFullYear());

        const createPayload: CreateScheduleInput = {
          title: input.title,
          start: startIso,
          end: endIso,
          status: input.status,
          serviceType: input.serviceType as ScheduleServiceType | string,
          visibility: input.visibility,

          personType: input.category as 'User' | 'Staff' | 'Org',
          personId: input.userId || '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          personName: (input as any).userName,

          assignedStaffId: input.assignedStaffId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          targetUserId: (input as any).targetUserId,

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rowKey: generateRowKey((input as any).rowKey),
          dayKey,
          monthKey,
          fiscalYear,

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          orgAudience: (input as any).orgAudience,
          notes: input.notes,
        };

        const created = await createSchedule(client, createPayload);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item = mapRepoScheduleToSchedItem(created as any);

        if (!item) {
          return result.err({ kind: 'unknown', message: 'Failed to map created schedule' });
        }

        return result.ok(item);
      } catch (e) {
        const safeErr = toSafeError(e instanceof Error ? e : new Error(String(e)));
        return result.unknown(safeErr.message || '予定の作成に失敗しました。時間をおいて再試行してください。');
      }
    },

    async update(input) {
      if (!client) {
        return result.err({
          kind: 'unknown',
          message: 'SharePoint client not available for update',
        });
      }

      try {
        const idNum = Number(input.id);
        if (!Number.isFinite(idNum)) {
          return result.err({
            kind: 'unknown',
            message: `Invalid schedule ID: ${input.id}`,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const etag = (input as any)?.etag;
        if (!etag) {
          return result.validation('Missing etag for update', { field: 'etag' });
        }

        const startDate = new Date(input.startLocal || new Date());
        const dayKey = startDate.toISOString().slice(0, 10);
        const monthKey = startDate.toISOString().slice(0, 7);

        const updatePayload: UpdateScheduleInput = {
          title: input.title,
          start: input.startLocal,
          end: input.endLocal,
          status: input.status,
          serviceType: input.serviceType as ScheduleServiceType | string,

          personType: input.category as 'User' | 'Staff' | 'Org',
          personId: input.userId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          personName: (input as any).userName,

          assignedStaffId: input.assignedStaffId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          targetUserId: (input as any).targetUserId,

          dayKey,
          monthKey,
          fiscalYear: String(startDate.getFullYear()),

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          orgAudience: (input as any).orgAudience,
          notes: input.notes,
        };

        const updated = await updateSchedule(client, idNum, etag, updatePayload);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item = mapRepoScheduleToSchedItem(updated as any);

        if (!item) {
          return result.err({ kind: 'unknown', message: 'Failed to map updated schedule' });
        }

        return result.ok(item);
      } catch (e) {
        // Phase 2-2: Detect 412 Precondition Failed (ETag conflict)
        const status = getHttpStatus(e);
        if (status === 412) {
          // Return conflict error for Phase 2-2 UX
          return result.conflict({
            message: 'Schedule was modified by another user (412)',
            op: 'update',
            id: input.id,
          });
        }

        const safeErr = toSafeError(e instanceof Error ? e : new Error(String(e)));
        return result.unknown(safeErr.message || '予定の更新に失敗しました。時間をおいて再試行してください。');
      }
    },

    async remove(eventId: string): Promise<void> {
      if (!client) {
        throw new Error('SharePoint client not available for remove');
      }

      try {
        const idNum = Number(eventId);
        if (!Number.isFinite(idNum)) {
          throw new Error(`Invalid schedule ID for delete: ${eventId}`);
        }

        await removeSchedule(client, idNum);
      } catch (error) {
        throw withUserMessage(
          toSafeError(error instanceof Error ? error : new Error(String(error))),
          '予定の削除に失敗しました。時間をおいて再試行してください。',
        );
      }
    },
  } satisfies SchedulesPort;
}
