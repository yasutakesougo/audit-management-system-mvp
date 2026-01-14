import { toSafeError } from '@/lib/errors';
import { fetchSp } from '@/lib/fetchSp';
import { AuthRequiredError } from '@/lib/errors';
import { withUserMessage } from '@/lib/notice';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { SCHEDULES_DEBUG } from '../debug';
import { makeSharePointScheduleCreator, toSharePointPayload } from './createAdapters';
import type { DateRange, SchedItem, SchedulesPort, UpdateScheduleEventInput } from './port';
import { mapSpRowToSchedule, parseSpScheduleRows } from './spRowSchema';
import { SCHEDULES_FIELDS, SCHEDULES_LIST_TITLE, buildSchedulesListPath } from './spSchema';

type ListRangeFn = (range: DateRange) => Promise<SchedItem[]>;

type SharePointSchedulesPortOptions = {
  acquireToken?: () => Promise<string | null>;
  listRange?: ListRangeFn;
  create?: SchedulesPort['create'];
  update?: SchedulesPort['update'];
  remove?: SchedulesPort['remove'];
};

type SharePointResponse<T> = {
  value?: T[];
};

const REQUIRED_SELECT = ['Id', SCHEDULES_FIELDS.title, SCHEDULES_FIELDS.start, SCHEDULES_FIELDS.end] as const;
const OPTIONAL_SELECT = [
  SCHEDULES_FIELDS.targetUserId,
  SCHEDULES_FIELDS.legacyUserCode,
  SCHEDULES_FIELDS.serviceType,
  SCHEDULES_FIELDS.locationName,
  SCHEDULES_FIELDS.notes,
  SCHEDULES_FIELDS.acceptedOn,
  SCHEDULES_FIELDS.acceptedBy,
  SCHEDULES_FIELDS.acceptedNote,
  SCHEDULES_FIELDS.assignedStaff,
  SCHEDULES_FIELDS.vehicle,
  SCHEDULES_FIELDS.status,
  SCHEDULES_FIELDS.entryHash,
  'Created',
  'Modified',
] as const;

const mergeSelectFields = (fallbackOnly: boolean): readonly string[] =>
  fallbackOnly ? [...REQUIRED_SELECT] : [...new Set([...REQUIRED_SELECT, ...OPTIONAL_SELECT])];

const ESSENTIAL_SERVICE_SELECT = [
  ...REQUIRED_SELECT,
  SCHEDULES_FIELDS.serviceType,
] as const;

const SELECT_VARIANTS = [mergeSelectFields(false), ESSENTIAL_SERVICE_SELECT, mergeSelectFields(true)] as const;

const defaultListRange: ListRangeFn = async (range) => {
  for (let index = 0; index < SELECT_VARIANTS.length; index += 1) {
    const select = SELECT_VARIANTS[index];
    try {
      const rows = await fetchRange(range, select);
      return sortByStart(rows.map(mapSpRowToSchedule).filter((item): item is SchedItem => Boolean(item)));
    } catch (error) {
      const isLastAttempt = index === SELECT_VARIANTS.length - 1;
      if (!isMissingFieldError(error) || isLastAttempt) {
        throw error;
      }
      if (SCHEDULES_DEBUG) {
        console.warn('[schedules] SharePoint list missing optional field, retrying with alternate select.', select, error);
      }
    }
  }

  return [];
};

const fetchRange = async (range: DateRange, select: readonly string[]): Promise<ReturnType<typeof parseSpScheduleRows>> => {
  const { baseUrl } = ensureConfig();
  const listPath = buildSchedulesListPath(baseUrl);
  const params = new URLSearchParams();
  params.set('$top', '500');
  params.set('$orderby', `${SCHEDULES_FIELDS.start} asc,Id asc`);
  params.set('$filter', buildRangeFilter(range));
  params.set('$select', select.join(','));

  const response = await fetchSp(`${listPath}?${params.toString()}`);
  const payload = (await response.json()) as SharePointResponse<unknown>;
  return parseSpScheduleRows(payload.value ?? []);
};

const buildRangeFilter = (range: DateRange): string => {
  const fromLiteral = encodeDateLiteral(range.from);
  const toLiteral = encodeDateLiteral(range.to);
  return `(${SCHEDULES_FIELDS.start} lt ${toLiteral}) and (${SCHEDULES_FIELDS.end} ge ${fromLiteral})`;
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

const fetchItemById = async (id: number): Promise<SchedItem> => {
  const { baseUrl } = ensureConfig();
  const listPath = buildSchedulesListPath(baseUrl);

  for (let index = 0; index < SELECT_VARIANTS.length; index += 1) {
    const select = SELECT_VARIANTS[index];
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
      const isLastAttempt = index === SELECT_VARIANTS.length - 1;
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

const makeSharePointScheduleUpdater = (acquireToken: () => Promise<string | null>): SchedulesPort['update'] => {
  const { baseUrl } = ensureConfig();
  const client = createSpClient(acquireToken, baseUrl);

  return async (input: UpdateScheduleEventInput) => {
    const idNum = Number.parseInt(input.id, 10);
    if (!Number.isFinite(idNum)) {
      throw new Error(`Invalid schedule id for SharePoint update: ${input.id}`);
    }

    const payload = toSharePointPayload(input);
    if (input.status) {
      payload.body[SCHEDULES_FIELDS.status] = input.status;
    }

    await client.updateItemByTitle(SCHEDULES_LIST_TITLE, idNum, payload.body);
    return fetchItemById(idNum);
  };
};

const makeSharePointScheduleRemover = (acquireToken: () => Promise<string | null>): SchedulesPort['remove'] => {
  const { baseUrl } = ensureConfig();
  const client = createSpClient(acquireToken, baseUrl);

  return async (eventId: string): Promise<void> => {
    const idNum = Number.parseInt(eventId, 10);
    if (!Number.isFinite(idNum)) {
      throw new Error(`Invalid schedule id for SharePoint delete: ${eventId}`);
    }

    await client.deleteItemByTitle(SCHEDULES_LIST_TITLE, idNum);
  };
};

export const makeSharePointSchedulesPort = (options?: SharePointSchedulesPortOptions): SchedulesPort => {
  const listImpl = options?.listRange ?? defaultListRange;
  const createImpl = options?.create ??
    (options?.acquireToken ? makeSharePointScheduleCreator({ acquireToken: options.acquireToken }) : undefined);
  const updateImpl = options?.update ??
    (options?.acquireToken ? makeSharePointScheduleUpdater(options.acquireToken) : undefined);

  const removeImpl = ((): SchedulesPort['remove'] => {
    if (options?.remove) {
      return options.remove;
    }
    if (options?.acquireToken) {
      return makeSharePointScheduleRemover(options.acquireToken);
    }
    return async () => {
      throw new Error('No token available for delete');
    };
  })();

  return {
    async list(range) {
      try {
        return await listImpl(range);
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
      if (!createImpl) {
        throw new Error('Schedule create is not configured for this environment.');
      }
      return createImpl(input);
    },
    async update(input) {
      if (!updateImpl) {
        throw new Error('Schedule update is not configured for this environment.');
      }
      try {
        return await updateImpl(input);
      } catch (error) {
        throw withUserMessage(
          toSafeError(error instanceof Error ? error : new Error(String(error))),
          '予定の更新に失敗しました。時間をおいて再試行してください。',
        );
      }
    },
    async remove(eventId: string): Promise<void> {
      try {
        await removeImpl!(eventId);
      } catch (error) {
        throw withUserMessage(
          toSafeError(error instanceof Error ? error : new Error(String(error))),
          '予定の削除に失敗しました。時間をおいて再試行してください。',
        );
      }
    },
  } satisfies SchedulesPort;
};
