import { toSafeError } from '@/lib/errors';
import { fetchSp } from '@/lib/fetchSp';
import { withUserMessage } from '@/lib/notice';
import { ensureConfig } from '@/lib/spClient';
import { SCHEDULES_DEBUG } from '../debug';
import { makeSharePointScheduleCreator } from './createAdapters';
import type { DateRange, SchedItem, SchedulesPort } from './port';
import { mapSpRowToSchedule, parseSpScheduleRows } from './spRowSchema';
import { SCHEDULES_FIELDS, SCHEDULES_LIST_TITLE } from './spSchema';

type ListRangeFn = (range: DateRange) => Promise<SchedItem[]>;

type SharePointSchedulesPortOptions = {
  acquireToken?: () => Promise<string | null>;
  listRange?: ListRangeFn;
  create?: SchedulesPort['create'];
};

type SharePointResponse<T> = {
  value?: T[];
};

const REQUIRED_SELECT = ['Id', SCHEDULES_FIELDS.title, SCHEDULES_FIELDS.start, SCHEDULES_FIELDS.end] as const;
const OPTIONAL_SELECT = [
  SCHEDULES_FIELDS.personId,
  SCHEDULES_FIELDS.personName,
  SCHEDULES_FIELDS.targetUserId,
  SCHEDULES_FIELDS.legacyUserCode,
  SCHEDULES_FIELDS.legacyCrUserCode,
  SCHEDULES_FIELDS.serviceType,
  SCHEDULES_FIELDS.locationName,
  SCHEDULES_FIELDS.notes,
  SCHEDULES_FIELDS.assignedStaff,
  SCHEDULES_FIELDS.vehicle,
  SCHEDULES_FIELDS.status,
  SCHEDULES_FIELDS.entryHash,
  'Created',
  'Modified',
] as const;

const defaultListRange: ListRangeFn = async (range) => {
  const fullSelect = mergeSelectFields(false);
  try {
    const rows = await fetchRange(range, fullSelect);
    return sortByStart(rows.map(mapSpRowToSchedule).filter((item): item is SchedItem => Boolean(item)));
  } catch (error) {
    if (!isMissingFieldError(error)) {
      throw error;
    }
    if (SCHEDULES_DEBUG) {
      console.warn('[schedules] SharePoint list missing optional field, retrying with minimal select.', error);
    }
    const fallbackRows = await fetchRange(range, mergeSelectFields(true));
    return sortByStart(fallbackRows.map(mapSpRowToSchedule).filter((item): item is SchedItem => Boolean(item)));
  }
};

const mergeSelectFields = (fallbackOnly: boolean): readonly string[] =>
  fallbackOnly ? [...REQUIRED_SELECT] : [...new Set([...REQUIRED_SELECT, ...OPTIONAL_SELECT])];

const fetchRange = async (range: DateRange, select: readonly string[]): Promise<ReturnType<typeof parseSpScheduleRows>> => {
  const { baseUrl } = ensureConfig();
  const listPath = `${baseUrl}/lists/getbytitle('${escapeListTitle(SCHEDULES_LIST_TITLE)}')/items`;
  const params = new URLSearchParams();
  params.set('$top', '500');
  params.set('$orderby', `${SCHEDULES_FIELDS.start} asc,Id asc`);
  params.set('$filter', buildRangeFilter(range));
  params.set('$select', select.join(','));

  const response = await fetchSp(`${listPath}?${params.toString()}`);
  const payload = (await response.json()) as SharePointResponse<unknown>;
  return parseSpScheduleRows(payload.value ?? []);
};

const escapeListTitle = (value: string): string => value.replace(/'/g, "''");

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
  return /does not exist|cannot find field/i.test(error.message ?? '');
};

const sortByStart = (items: SchedItem[]): SchedItem[] =>
  [...items].sort((a, b) => a.start.localeCompare(b.start));

export const makeSharePointSchedulesPort = (options?: SharePointSchedulesPortOptions): SchedulesPort => {
  const listImpl = options?.listRange ?? defaultListRange;
  const createImpl =
    options?.create ??
    (() => {
      if (!options?.acquireToken) {
        throw new Error('SharePoint schedules port requires acquireToken when create handler is not provided.');
      }
      return makeSharePointScheduleCreator({ acquireToken: options.acquireToken });
    })();

  return {
    async list(range) {
      try {
        return await listImpl(range);
      } catch (error) {
        throw withUserMessage(
          toSafeError(error instanceof Error ? error : new Error(String(error))),
          '予定の取得に失敗しました。時間をおいて再試行してください。',
        );
      }
    },
    create: (input) => createImpl(input),
  } satisfies SchedulesPort;
};
