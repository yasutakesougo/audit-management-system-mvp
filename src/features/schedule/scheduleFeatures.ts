import { SCHEDULES_BASE_FIELDS, SCHEDULES_COMMON_OPTIONAL_FIELDS, SCHEDULES_SELECT_FIELDS, SCHEDULES_STAFF_TEXT_FIELDS } from '@/sharepoint/fields';
import { readEnv, isDevMode } from '@/lib/env';

const isDevRuntime = isDevMode();

const normalizeFlag = (value: unknown, fallback: '0' | '1' = '1'): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed.length) {
      return fallback === '1';
    }
    return trimmed === '1' || trimmed === 'true' || trimmed === 'yes';
  }
  return fallback === '1';
};

const initialStaffTextColumns = normalizeFlag(readEnv('VITE_FEATURE_SCHEDULE_STAFF_TEXT_COLUMNS', '1'), '1');
let staffTextColumnsEnabled = initialStaffTextColumns;

const STAFF_TEXT_FIELDS = new Set<string>(SCHEDULES_STAFF_TEXT_FIELDS as readonly string[]);
const STAFF_TEXT_FIELD_TOKENS = new Set<string>(
  Array.from(STAFF_TEXT_FIELDS, (value) => value.toLowerCase())
);

export const isScheduleStaffTextColumnsEnabled = (): boolean => staffTextColumnsEnabled;

export const disableScheduleStaffTextColumns = (reason?: string): boolean => {
  if (!staffTextColumnsEnabled) {
    return false;
  }
  staffTextColumnsEnabled = false;
  if (isDevRuntime) {
    console.warn('[schedule] Falling back to legacy StaffIdId column due to missing fields.', reason ?? '');
  }
  return true;
};

export const buildScheduleSelectFields = (): string[] => {
  const fields = [...SCHEDULES_BASE_FIELDS, ...SCHEDULES_COMMON_OPTIONAL_FIELDS] as string[];
  if (staffTextColumnsEnabled) {
    fields.push(...SCHEDULES_STAFF_TEXT_FIELDS);
  }
  if (!fields.includes('@odata.etag')) {
    fields.push('@odata.etag');
  }
  return fields;
};

export const buildScheduleSelectClause = (): string => {
  const fields = buildScheduleSelectFields();
  const canonicalMatches =
    fields.length === SCHEDULES_BASE_FIELDS.length &&
    fields.every((field, index) => field === SCHEDULES_BASE_FIELDS[index]);
  if (canonicalMatches) {
    return SCHEDULES_SELECT_FIELDS;
  }
  return fields.join(',');
};

export const handleScheduleOptionalFieldError = (error: unknown): boolean => {
  if (!staffTextColumnsEnabled) {
    return false;
  }
  if (!(error instanceof Error) || typeof error.message !== 'string') {
    return false;
  }
  const message = error.message;
  const normalized = message.toLowerCase();
  for (const field of STAFF_TEXT_FIELDS) {
    if (message.includes(`'${field}'`) || message.includes(field)) {
      disableScheduleStaffTextColumns(message);
      return true;
    }
  }
  for (const token of STAFF_TEXT_FIELD_TOKENS) {
    if (normalized.includes(token)) {
      disableScheduleStaffTextColumns(message);
      return true;
    }
  }
  if (normalized.includes('cr014_staff')) {
    disableScheduleStaffTextColumns(message);
    return true;
  }
  return false;
};
