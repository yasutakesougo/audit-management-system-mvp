import { formatInTimeZone } from '@/lib/tz';
import type { SpScheduleItem } from '@/types';
import {
  SCHEDULE_FIELD_CATEGORY,
  SCHEDULE_FIELD_SERVICE_TYPE,
  SCHEDULE_FIELD_PERSON_TYPE,
  SCHEDULE_FIELD_PERSON_ID,
  SCHEDULE_FIELD_PERSON_NAME,
  SCHEDULE_FIELD_EXTERNAL_NAME,
  SCHEDULE_FIELD_EXTERNAL_ORG,
  SCHEDULE_FIELD_EXTERNAL_CONTACT,
  SCHEDULE_FIELD_STAFF_IDS,
  SCHEDULE_FIELD_STAFF_NAMES,
  SCHEDULE_FIELD_DAY_KEY,
  SCHEDULE_FIELD_FISCAL_YEAR,
  SCHEDULE_FIELD_SUB_TYPE,
  SCHEDULE_FIELD_ORG_AUDIENCE,
  SCHEDULE_FIELD_ORG_RESOURCE_ID,
  SCHEDULE_FIELD_ORG_EXTERNAL_NAME,
  SCHEDULE_FIELD_DAY_PART,
} from '@/sharepoint/fields';
import {
  BaseSchedule,
  Category,
  PersonType,
  DayPart,
  Schedule,
  ScheduleOrg,
  ScheduleStaff,
  ScheduleUserCare,
  ServiceType,
} from './types';
import { validateUserCare } from './validation';
import { isScheduleStaffTextColumnsEnabled } from './scheduleFeatures';
import { detectAllDay, toLocalRange } from '@/lib/mappers';
import { normalizeStatus, toSharePointStatus } from './statusDictionary';

const SCHEDULE_TIME_ZONE = 'Asia/Tokyo';

const CATEGORY_VALUES: readonly Category[] = ['Org', 'User', 'Staff'];
const PERSON_TYPE_VALUES: readonly PersonType[] = ['Internal', 'External'];
const SERVICE_TYPE_VALUES: readonly ServiceType[] = ['一時ケア', 'ショートステイ'];
const ORG_SUBTYPE_VALUES: readonly ScheduleOrg['subType'][] = ['会議', '研修', '監査', '余暇イベント', '外部団体利用'];
const STAFF_SUBTYPE_VALUES: readonly ScheduleStaff['subType'][] = ['会議', '研修', '来客対応', '年休'];
const DAY_PART_VALUES: readonly DayPart[] = ['Full', 'AM', 'PM'];

const toUtcIso = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed.length) return undefined;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

const computeDayKey = (iso?: string): string | undefined => {
  if (!iso) return undefined;
  try {
    return formatInTimeZone(new Date(iso), SCHEDULE_TIME_ZONE, 'yyyyMMdd');
  } catch {
    return undefined;
  }
};

const computeFiscalYear = (iso?: string): string | undefined => {
  if (!iso) return undefined;
  try {
    const local = formatInTimeZone(new Date(iso), SCHEDULE_TIME_ZONE, 'yyyy-MM-dd');
    const [yearRaw, monthRaw] = local.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return undefined;
    return String(month >= 4 ? year : year - 1);
  } catch {
    return undefined;
  }
};

const normalizeCategory = (value: unknown): Category => {
  if (typeof value !== 'string') return 'User';
  const candidate = value.trim();
  return (CATEGORY_VALUES as readonly string[]).includes(candidate) ? (candidate as Category) : 'User';
};

const normalizePersonType = (value: unknown): PersonType => {
  if (typeof value !== 'string') return 'Internal';
  const candidate = value.trim();
  return (PERSON_TYPE_VALUES as readonly string[]).includes(candidate) ? (candidate as PersonType) : 'Internal';
};

const normalizeServiceType = (value: unknown): ServiceType => {
  if (typeof value !== 'string') return '一時ケア';
  const candidate = value.trim();
  return (SERVICE_TYPE_VALUES as readonly string[]).includes(candidate) ? (candidate as ServiceType) : '一時ケア';
};

const normalizeOrgSubType = (value: unknown): ScheduleOrg['subType'] => {
  if (typeof value !== 'string') return '会議';
  const candidate = value.trim();
  if ((ORG_SUBTYPE_VALUES as readonly string[]).includes(candidate)) {
    return candidate as ScheduleOrg['subType'];
  }
  switch (candidate.toLowerCase()) {
    case 'meeting':
    case 'all-hands':
      return '会議';
    case 'training':
    case 'seminar':
      return '研修';
    case 'audit':
    case 'inspection':
      return '監査';
    case 'recreation':
    case 'event':
    case 'leisure':
      return '余暇イベント';
    case 'external':
    case 'externalgroup':
    case 'external-group':
      return '外部団体利用';
    default:
      return '会議';
  }
};

const normalizeStaffSubType = (value: unknown): ScheduleStaff['subType'] => {
  if (typeof value !== 'string') return '会議';
  const candidate = value.trim();
  if ((STAFF_SUBTYPE_VALUES as readonly string[]).includes(candidate)) {
    return candidate as ScheduleStaff['subType'];
  }
  switch (candidate.toLowerCase()) {
    case 'meeting':
    case 'all-hands':
      return '会議';
    case 'training':
    case 'seminar':
      return '研修';
    case 'visitor':
    case 'guest':
    case 'reception':
      return '来客対応';
    case 'vacation':
    case 'pto':
    case 'leave':
      return '年休';
    default:
      return '会議';
  }
};

const normalizeDayPart = (value: unknown): DayPart => {
  if (typeof value !== 'string') return 'Full';
  const candidate = value.trim();
  if ((DAY_PART_VALUES as readonly string[]).includes(candidate as DayPart)) {
    return candidate as DayPart;
  }
  switch (candidate.toLowerCase()) {
    case 'am':
    case 'morning':
    case '午前':
      return 'AM';
    case 'pm':
    case 'afternoon':
    case '午後':
      return 'PM';
    default:
      return 'Full';
  }
};

const toNullableString = (value: unknown): string | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const parseStringList = (value: unknown): string[] => {
  const coerce = (input: unknown): string[] => {
    if (Array.isArray(input)) {
      return input
        .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '')).trim())
        .filter((item) => item.length > 0);
    }
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed.length) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return coerce(parsed);
        }
      } catch {
        // fall through to delimiter-based parsing
      }
      return trimmed
        .split(/[,;\n\r\u3001\uFF0C]+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    }
    return [];
  };

  const unique = Array.from(new Set(coerce(value)));
  return unique;
};

const stringifyStringList = (values: readonly string[]): string | null => {
  const unique = Array.from(new Set(values.map((item) => item.trim()).filter((item) => item.length > 0)));
  return unique.length ? JSON.stringify(unique) : null;
};

const deriveStaffLookupValue = (ids: readonly string[]): number | null => {
  for (const raw of ids) {
    const trimmed = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
    if (!trimmed.length) {
      continue;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
};

const buildStaffAssignmentPayload = (schedule: { staffIds: readonly string[]; staffNames?: readonly string[] | undefined }): Record<string, unknown> => {
  const includeTextColumns = isScheduleStaffTextColumnsEnabled();
  const lookupValue = deriveStaffLookupValue(schedule.staffIds) ?? null;
  const payload: Record<string, unknown> = {
    StaffIdId: lookupValue,
  };
  if (includeTextColumns) {
    payload[SCHEDULE_FIELD_STAFF_IDS] = stringifyStringList(schedule.staffIds);
    payload[SCHEDULE_FIELD_STAFF_NAMES] = schedule.staffNames?.length ? stringifyStringList(schedule.staffNames) : null;
  }
  return payload;
};

const toLookupArray = (input: unknown): unknown[] => {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object' && Array.isArray((input as { results?: unknown[] }).results)) {
    return ((input as { results?: unknown[] }).results ?? []) as unknown[];
  }
  return [];
};

const parseLookupIdList = (value: unknown): string[] => {
  const entries = toLookupArray(value);
  const collected: string[] = [];

  for (const entry of entries) {
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      collected.push(String(entry));
      continue;
    }
    if (typeof entry === 'string') {
      const trimmed = entry.trim();
      if (!trimmed.length) continue;
      const parsed = parseStringList(trimmed);
      if (parsed.length > 1) {
        collected.push(...parsed);
      } else {
        collected.push(parsed[0] ?? trimmed);
      }
      continue;
    }
    if (entry && typeof entry === 'object') {
      const candidate = (entry as { Id?: number | string }).Id;
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        collected.push(String(candidate));
        continue;
      }
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed.length) {
          const parsed = parseStringList(trimmed);
          if (parsed.length > 1) {
            collected.push(...parsed);
          } else {
            collected.push(parsed[0] ?? trimmed);
          }
        }
      }
    }
  }

  return Array.from(new Set(collected.filter((id) => id.length > 0)));
};

const extractLookupTitles = (value: unknown): string[] => {
  const entries = toLookupArray(value);
  const titles = entries
    .map((entry) => {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        return trimmed.length ? trimmed : undefined;
      }
      if (entry && typeof entry === 'object') {
        const record = entry as { Title?: string; FullName?: string; StaffID?: string };
        const candidate = record.Title ?? record.FullName ?? record.StaffID;
        if (typeof candidate === 'string') {
          const trimmed = candidate.trim();
          if (trimmed.length) {
            return trimmed;
          }
        }
      }
      return undefined;
    })
    .filter((name): name is string => typeof name === 'string' && name.length > 0);
  return Array.from(new Set(titles));
};

const buildBaseSchedule = (item: SpScheduleItem): BaseSchedule => {
  const startUtcRaw = toUtcIso(item.EventDate);
  const endUtcRaw = toUtcIso(item.EndDate ?? item.EventDate) ?? startUtcRaw;
  const range = toLocalRange(startUtcRaw ?? null, endUtcRaw ?? null);
  const allDay = detectAllDay(item.AllDay, startUtcRaw ?? null, endUtcRaw ?? null, range);

  const title = toNullableString(item.Title) ?? '';
  const status = normalizeStatus(item.Status);
  const notes = toNullableString(item.Notes);
  const location = toNullableString(item.Location);
  const recurrenceRule = toNullableString(item.RRule ?? item.RecurrenceData ?? null);

  return {
    id: String(item.Id ?? ''),
    etag: toNullableString(item['@odata.etag']) ?? '',
    category: normalizeCategory(item.cr014_category),
    title,
    start: startUtcRaw ?? '',
    end: endUtcRaw ?? (startUtcRaw ?? ''),
    allDay,
    status,
    location,
    notes,
    recurrenceRule: recurrenceRule ?? undefined,
    dayKey: toNullableString(item.cr014_dayKey) ?? computeDayKey(startUtcRaw ?? undefined),
    fiscalYear: toNullableString(item.cr014_fiscalYear) ?? computeFiscalYear(startUtcRaw ?? undefined),
  } satisfies BaseSchedule;
};

const hydrateUserCare = (item: SpScheduleItem, base: BaseSchedule): ScheduleUserCare => {
  const personType = normalizePersonType(item.cr014_personType);
  const rawStaffIds = parseStringList(item.cr014_staffIds);
  const staffIds = rawStaffIds.length ? rawStaffIds : (() => {
    const fallback = toNullableString(item.StaffIdId);
    return fallback ? [fallback] : [];
  })();

  const candidate: Partial<ScheduleUserCare> = {
    ...base,
    category: 'User',
    serviceType: normalizeServiceType(item.cr014_serviceType),
    personType,
    personId: toNullableString(item.cr014_personId) ?? toNullableString(item.UserIdId),
    personName: toNullableString(item.cr014_personName) ?? toNullableString(item.Title),
    externalPersonName: toNullableString(item.cr014_externalPersonName) ?? undefined,
    externalPersonOrg: toNullableString(item.cr014_externalPersonOrg) ?? undefined,
    externalPersonContact: toNullableString(item.cr014_externalPersonContact) ?? undefined,
    staffIds,
    staffNames: (() => {
      const parsed = parseStringList(item.cr014_staffNames);
      return parsed.length ? parsed : undefined;
    })(),
  };

  validateUserCare(candidate);
  return candidate as ScheduleUserCare;
};

const hydrateOrgSchedule = (item: SpScheduleItem, base: BaseSchedule): ScheduleOrg => {
  const audience = parseStringList(item.cr014_orgAudience);
  const resourceId = toNullableString(item.cr014_resourceId);
  const externalOrgName = toNullableString(item.ExternalOrgName);

  return {
    ...base,
    category: 'Org',
    subType: normalizeOrgSubType(item.SubType),
    audience: audience.length ? audience : undefined,
    resourceId: resourceId ?? undefined,
    externalOrgName: externalOrgName ?? undefined,
  } satisfies ScheduleOrg;
};

const hydrateStaffSchedule = (item: SpScheduleItem, base: BaseSchedule): ScheduleStaff => {
  const staffIdsFromField = parseStringList(item.cr014_staffIds);
  const staffIdsFromLookup = parseLookupIdList(item.StaffLookupId);
  const staffIdFallback = toNullableString(item.StaffIdId);
  const subType = normalizeStaffSubType(item.SubType);

  const staffIds = (() => {
    if (staffIdsFromField.length) return staffIdsFromField;
    if (staffIdsFromLookup.length) return staffIdsFromLookup;
    return staffIdFallback ? [staffIdFallback] : [];
  })();

  const staffNamesField = parseStringList(item.cr014_staffNames);
  const staffNamesLookup = extractLookupTitles(item.StaffLookup);
  const staffNames = staffNamesField.length
    ? staffNamesField
    : staffNamesLookup.length
      ? staffNamesLookup
      : undefined;

  return {
    ...base,
    category: 'Staff',
    subType,
    staffIds,
    staffNames,
    dayPart: (() => {
      if (subType !== '年休') {
        return undefined;
      }
      return normalizeDayPart(item.DayPart);
    })(),
  } satisfies ScheduleStaff;
};

/** Hydrate a SharePoint schedule list item into the domain model. */
export const fromSpSchedule = (item: SpScheduleItem): Schedule => {
  const base = buildBaseSchedule(item);
  switch (base.category) {
    case 'User':
      return hydrateUserCare(item, base);
    case 'Org':
      return hydrateOrgSchedule(item, base);
    case 'Staff':
      return hydrateStaffSchedule(item, base);
    default:
      throw new Error(`Unsupported schedule category: ${base.category}`);
  }
};

const normalizeRecurrenceField = (schedule: Schedule): Record<string, unknown> => {
  if (!schedule.recurrenceRule) {
    return {
      RecurrenceJson: null,
      RRule: null,
      RecurrenceData: null,
    };
  }
  return {
    RecurrenceJson: schedule.recurrenceRule,
    RRule: schedule.recurrenceRule,
    RecurrenceData: schedule.recurrenceRule,
  };
};

/** Convert a domain schedule into SharePoint field payload */
export const toSpScheduleFields = (schedule: Schedule): Record<string, unknown> => {
  const base: Record<string, unknown> = {
    Title: schedule.title,
    EventDate: schedule.start,
    EndDate: schedule.end,
    AllDay: Boolean(schedule.allDay),
    Location: schedule.location ?? null,
  Status: toSharePointStatus(schedule.status),
    Notes: schedule.notes ?? null,
    [SCHEDULE_FIELD_CATEGORY]: schedule.category,
    [SCHEDULE_FIELD_DAY_KEY]: schedule.dayKey ?? computeDayKey(schedule.start) ?? null,
    [SCHEDULE_FIELD_FISCAL_YEAR]: schedule.fiscalYear ?? computeFiscalYear(schedule.start) ?? null,
  };

  const recurrence = normalizeRecurrenceField(schedule);

  if (schedule.category === 'User') {
    validateUserCare(schedule);
    return {
      ...base,
      [SCHEDULE_FIELD_SERVICE_TYPE]: schedule.serviceType,
      [SCHEDULE_FIELD_PERSON_TYPE]: schedule.personType,
      [SCHEDULE_FIELD_PERSON_ID]: schedule.personType === 'Internal' ? schedule.personId ?? '' : null,
      [SCHEDULE_FIELD_PERSON_NAME]: schedule.personType === 'Internal' ? schedule.personName ?? '' : null,
      [SCHEDULE_FIELD_EXTERNAL_NAME]: schedule.personType === 'External' ? schedule.externalPersonName ?? '' : null,
      [SCHEDULE_FIELD_EXTERNAL_ORG]: schedule.personType === 'External' ? schedule.externalPersonOrg ?? null : null,
      [SCHEDULE_FIELD_EXTERNAL_CONTACT]: schedule.personType === 'External' ? schedule.externalPersonContact ?? null : null,
  ...buildStaffAssignmentPayload(schedule),
      [SCHEDULE_FIELD_SUB_TYPE]: null,
      [SCHEDULE_FIELD_ORG_AUDIENCE]: null,
      [SCHEDULE_FIELD_ORG_RESOURCE_ID]: null,
      [SCHEDULE_FIELD_ORG_EXTERNAL_NAME]: null,
      [SCHEDULE_FIELD_DAY_PART]: null,
      ...recurrence,
    };
  }

  if (schedule.category === 'Org') {
    return {
      ...base,
      [SCHEDULE_FIELD_SERVICE_TYPE]: null,
      [SCHEDULE_FIELD_PERSON_TYPE]: null,
      [SCHEDULE_FIELD_PERSON_ID]: null,
      [SCHEDULE_FIELD_PERSON_NAME]: null,
      [SCHEDULE_FIELD_EXTERNAL_NAME]: null,
      [SCHEDULE_FIELD_EXTERNAL_ORG]: null,
      [SCHEDULE_FIELD_EXTERNAL_CONTACT]: null,
      ...(isScheduleStaffTextColumnsEnabled()
        ? {
            [SCHEDULE_FIELD_STAFF_IDS]: null,
            [SCHEDULE_FIELD_STAFF_NAMES]: null,
          }
        : {}),
      [SCHEDULE_FIELD_SUB_TYPE]: schedule.subType,
      [SCHEDULE_FIELD_ORG_AUDIENCE]: schedule.audience?.length ? stringifyStringList(schedule.audience) : null,
      [SCHEDULE_FIELD_ORG_RESOURCE_ID]: schedule.resourceId ?? null,
      [SCHEDULE_FIELD_ORG_EXTERNAL_NAME]: schedule.externalOrgName ?? null,
      [SCHEDULE_FIELD_DAY_PART]: null,
      ...recurrence,
    };
  }

  if (schedule.category === 'Staff') {
    return {
      ...base,
      [SCHEDULE_FIELD_SERVICE_TYPE]: null,
      [SCHEDULE_FIELD_PERSON_TYPE]: null,
      [SCHEDULE_FIELD_PERSON_ID]: null,
      [SCHEDULE_FIELD_PERSON_NAME]: null,
      [SCHEDULE_FIELD_EXTERNAL_NAME]: null,
      [SCHEDULE_FIELD_EXTERNAL_ORG]: null,
      [SCHEDULE_FIELD_EXTERNAL_CONTACT]: null,
      [SCHEDULE_FIELD_SUB_TYPE]: schedule.subType,
  ...buildStaffAssignmentPayload(schedule),
      [SCHEDULE_FIELD_ORG_AUDIENCE]: null,
      [SCHEDULE_FIELD_ORG_RESOURCE_ID]: null,
      [SCHEDULE_FIELD_ORG_EXTERNAL_NAME]: null,
      [SCHEDULE_FIELD_DAY_PART]: schedule.subType === '年休' ? (schedule.dayPart ?? 'Full') : null,
      ...recurrence,
    };
  }

  throw new Error(`Unsupported schedule category: ${(schedule as { category?: unknown })?.category}`);
};
