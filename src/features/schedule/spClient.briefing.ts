import type { UseSP } from '@/lib/spClient';
import { SCHEDULE_FIELD_CATEGORY, SCHEDULE_FIELD_DAY_PART } from '@/sharepoint/fields';
import { readEnv } from '@/lib/env';

const DEFAULT_LIST_TITLE = 'Schedules';
const LIST_TITLE = (() => {
  const override = readEnv('VITE_SP_LIST_SCHEDULES', '').trim();
  return override || DEFAULT_LIST_TITLE;
})();
const LIST_PATH = `/lists/getbytitle('${encodeURIComponent(LIST_TITLE)}')/items` as const;

const encodeODataDate = (iso: string): string => {
  const candidate = new Date(iso);
  if (Number.isNaN(candidate.getTime())) {
    throw new Error(`Invalid ISO datetime: ${iso}`);
  }
  return `datetime'${candidate.toISOString()}'`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const coerceRecordArray = <T extends Record<string, unknown>>(value: unknown): T[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(isRecord) as T[];
  }
  if (isRecord(value)) {
    return [value as T];
  }
  return [];
};

const extractItems = <T extends Record<string, unknown>>(payload: unknown): T[] => {
  if (!payload) return [];
  if (isRecord(payload)) {
    if ('value' in payload) {
      const value = (payload as { value?: unknown }).value;
      if (Array.isArray(value)) {
        return coerceRecordArray<T>(value);
      }
    }
    if ('d' in payload) {
      const data = (payload as { d?: unknown }).d;
      if (isRecord(data) && 'results' in data) {
        const results = (data as { results?: unknown }).results;
        if (Array.isArray(results)) {
          return coerceRecordArray<T>(results);
        }
      }
    }
    return coerceRecordArray<T>(payload);
  }
  return coerceRecordArray<T>(payload);
};

const hhmm = (iso?: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

type StaffLookupEntry = Array<string | Record<string, unknown>> | { results?: Array<string | Record<string, unknown>> } | null | undefined;

const toLookupArray = (input: StaffLookupEntry): Array<string | Record<string, unknown>> => {
  if (Array.isArray(input)) {
    return input;
  }
  if (input && typeof input === 'object' && Array.isArray(input.results)) {
    return input.results;
  }
  return [];
};

const fallbackNames = (input: StaffLookupEntry): string[] => {
  const entries = toLookupArray(input);
  return entries
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim();
      }
      if (entry && typeof entry === 'object') {
        const record = entry as { Title?: unknown; FullName?: unknown; StaffID?: unknown };
        const candidate = record.Title ?? record.FullName ?? record.StaffID;
        return typeof candidate === 'string' ? candidate.trim() : '';
      }
      return '';
    })
    .filter((name) => name.length > 0);
};

type OrgBriefingRow = {
  Title?: string | null;
  SubType?: string | null;
  EventDate?: string | null;
  EndDate?: string | null;
  AllDay?: boolean | null;
  Location?: string | null;
  ExternalOrgName?: string | null;
};

type StaffBriefingRow = OrgBriefingRow & {
  StaffLookup?: StaffLookupEntry;
} & Partial<Record<typeof SCHEDULE_FIELD_DAY_PART, string | null>>;

export async function getOrgBriefingLines(sp: UseSP, startIso: string, endIso: string): Promise<string[]> {
  const params = new URLSearchParams();
  params.set('$select', [
    'Id',
    'Title',
    'SubType',
    'EventDate',
    'EndDate',
    'AllDay',
    'Location',
    'ExternalOrgName',
    'RecurrenceRule',
  ].join(','));
  params.set('$filter', `(${SCHEDULE_FIELD_CATEGORY} eq 'Org') and ${overlapClause(startIso, endIso)}`);
  params.set('$orderby', 'EventDate asc,Id asc');
  params.set('$top', '200');

  const path = `${LIST_PATH}?${params.toString()}`;
  const res = await sp.spFetch(path);
  const payload = await res.json();
  const rows = extractItems<OrgBriefingRow>(payload);

  return rows.map((row) => {
    const title = typeof row.Title === 'string' && row.Title.trim().length ? row.Title.trim() : '予定';
    const subType = typeof row.SubType === 'string' && row.SubType.trim().length ? row.SubType.trim() : '';
    const head = typeof row.ExternalOrgName === 'string' && row.ExternalOrgName.trim().length
      ? row.ExternalOrgName.trim()
      : subType;
    const allDay = Boolean(row.AllDay);
    const time = allDay ? '終日' : `${hhmm(row.EventDate)}–${hhmm(row.EndDate)}`;
    const location = typeof row.Location === 'string' && row.Location.trim().length ? ` @${row.Location.trim()}` : '';
    const prefix = head ? `${head}：` : '';
    return `${prefix}${title} ${time}${location}`.trim();
  });
}

export async function getStaffBriefingLines(sp: UseSP, startIso: string, endIso: string): Promise<string[]> {
  const params = new URLSearchParams();
  params.set('$select', [
    'Id',
    'Title',
    'SubType',
    'EventDate',
    'EndDate',
    'AllDay',
    'Location',
    'StaffLookup/Title',
    SCHEDULE_FIELD_DAY_PART,
  ].join(','));
  params.set('$expand', 'StaffLookup');
  params.set('$filter', `(${SCHEDULE_FIELD_CATEGORY} eq 'Staff') and ${overlapClause(startIso, endIso)}`);
  params.set('$orderby', 'EventDate asc,Id asc');
  params.set('$top', '200');

  const path = `${LIST_PATH}?${params.toString()}`;
  const res = await sp.spFetch(path);
  const payload = await res.json();
  const rows = extractItems<StaffBriefingRow>(payload);

  return rows.map((row) => {
    const names = fallbackNames(row.StaffLookup).join('・');
    const label = names || '職員';
    const subType = typeof row.SubType === 'string' && row.SubType.trim().length ? row.SubType.trim() : '';
    const allDay = Boolean(row.AllDay);
    const dayPartRaw = typeof row[SCHEDULE_FIELD_DAY_PART] === 'string' ? row[SCHEDULE_FIELD_DAY_PART].trim() : '';
    const dayPart = normalizeDayPart(dayPartRaw);
    const halfDayLabel = dayPart ? (dayPart === 'AM' ? '午前休' : '午後休') : '';
    const time = dayPart ? halfDayLabel : allDay ? '終日' : `${hhmm(row.EventDate)}–${hhmm(row.EndDate)}`;
    const location = typeof row.Location === 'string' && row.Location.trim().length ? ` @${row.Location.trim()}` : '';
    const activityLabel = subType === '年休' && dayPart ? `${subType}（${halfDayLabel}）` : subType;
    const activity = activityLabel ? ` ${activityLabel}` : '';
    return `${label}${activity} ${time}${location}`.trim();
  });
}

const overlapClause = (startIso: string, endIso: string): string => {
  return `(EventDate lt ${encodeODataDate(endIso)}) and (EndDate gt ${encodeODataDate(startIso)})`;
};

const normalizeDayPart = (value: string): 'AM' | 'PM' | null => {
  const normalized = value.toUpperCase();
  if (normalized === 'AM' || normalized === '午前' || normalized === 'MORNING') {
    return 'AM';
  }
  if (normalized === 'PM' || normalized === '午後' || normalized === 'AFTERNOON') {
    return 'PM';
  }
  return null;
};
