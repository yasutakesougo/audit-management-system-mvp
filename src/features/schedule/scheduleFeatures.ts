import { isDevMode, readEnv } from '@/lib/env';
import {
  SCHEDULES_BASE_FIELDS,
  SCHEDULES_COMMON_OPTIONAL_FIELDS,
  SCHEDULES_MINIMAL_FIELDS,
  SCHEDULES_SELECT_FIELDS,
  SCHEDULES_STAFF_TEXT_FIELDS,
  SCHEDULE_FIELD_CATEGORY,
  SCHEDULE_FIELD_STATUS,
  SCHEDULE_FIELD_PERSON_ID,
  SCHEDULE_FIELD_PERSON_NAME,
  SCHEDULE_FIELD_PERSON_TYPE,
  SCHEDULE_FIELD_SERVICE_TYPE,
} from '@/sharepoint/fields';

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

// Iron-clad fallback: SharePoint built-in columns only (guaranteed to exist on all lists)
const SCHEDULES_IRON_CLAD_FIELDS = [
  'Id',
  'Title',
  'EventDate',
  'EndDate',
  'AllDay',
  'Created',
  'Modified',
  '@odata.etag',
] as const;

// Safe fallback: minimal columns that exist on all schedule lists (avoids 400 when optional columns are gone)
const SCHEDULES_SAFE_FALLBACK_FIELDS = [
  'Id',
  'Title',
  'EventDate',
  'EndDate',
  'AllDay',
  SCHEDULE_FIELD_CATEGORY,
  SCHEDULE_FIELD_SERVICE_TYPE,
  SCHEDULE_FIELD_PERSON_TYPE,
  SCHEDULE_FIELD_PERSON_ID,
  SCHEDULE_FIELD_PERSON_NAME,
  SCHEDULE_FIELD_STATUS,
  'Created',
  'Modified',
  '@odata.etag',
] as const;

let scheduleSelectFieldsOverride: readonly string[] | null = null;
let fallbackTier: 'none' | 'safe' | 'ironclad' = 'none';

// Force safe select set for E2E smoke (bypasses tenant-specific columns to avoid 400s in mocks)
const forceE2eSafeSelect = normalizeFlag(readEnv('VITE_E2E_SCHEDULE_SAFE_SELECT', '0'), '0');
const forcePreviewSafeSelect = normalizeFlag(readEnv('PW_USE_PREVIEW', '0'), '0');
if (forceE2eSafeSelect || forcePreviewSafeSelect) {
  scheduleSelectFieldsOverride = [...SCHEDULES_SAFE_FALLBACK_FIELDS];
  fallbackTier = 'safe';
  if (isDevRuntime) {
    console.info('[schedule] Safe select forced for E2E/preview (VITE_E2E_SCHEDULE_SAFE_SELECT or PW_USE_PREVIEW)');
  }
}

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
  if (scheduleSelectFieldsOverride) {
    return [...scheduleSelectFieldsOverride];
  }

  // 開発環境ではURL制限回避のために最小限のフィールドセットを使用
  const useMinimalFields =
    typeof window !== 'undefined' && window.location?.hostname === 'localhost' &&
    !(typeof process !== 'undefined' && process.env?.VITEST === 'true');
  const baseFields = useMinimalFields ? SCHEDULES_MINIMAL_FIELDS : SCHEDULES_BASE_FIELDS;

  const fields = [...baseFields, ...SCHEDULES_COMMON_OPTIONAL_FIELDS] as string[];
  if (staffTextColumnsEnabled) {
    fields.push(...SCHEDULES_STAFF_TEXT_FIELDS);
  }
  if (!fields.includes('@odata.etag')) {
    fields.push('@odata.etag');
  }
  return fields;
};

const enableScheduleSafeFallback = (reason?: string): boolean => {
  if (fallbackTier === 'ironclad') {
    // Already at the most restrictive tier
    return false;
  }
  
  if (fallbackTier === 'none') {
    // First fallback: try safe fields (business-relevant columns)
    scheduleSelectFieldsOverride = [...SCHEDULES_SAFE_FALLBACK_FIELDS];
    fallbackTier = 'safe';
    if (isDevRuntime) {
      console.warn('[schedule] Falling back to safe select fields (tier 1).', reason ?? '');
    }
    return true;
  }
  
  if (fallbackTier === 'safe') {
    // Second fallback: drop to iron-clad fields (SharePoint built-ins only)
    scheduleSelectFieldsOverride = [...SCHEDULES_IRON_CLAD_FIELDS];
    fallbackTier = 'ironclad';
    if (isDevRuntime) {
      console.warn('[schedule] Falling back to iron-clad select fields (tier 2 - SharePoint built-ins only).', reason ?? '');
    }
    return true;
  }
  
  return false;
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

const getHttpStatus = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } };
  const pick = [candidate.status, candidate.statusCode, candidate.response?.status].find((v) => typeof v === 'number');
  return typeof pick === 'number' ? pick : null;
};

const isMissingFieldMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('the field') && normalized.includes('does not exist') ||
    normalized.includes('cannot find field') ||
    normalized.includes('存在しません')
  );
};

export const handleScheduleOptionalFieldError = (error: unknown): boolean => {
  if (!(error instanceof Error) || typeof error.message !== 'string') {
    return false;
  }

  const message = error.message;
  const status = getHttpStatus(error);

  // Missing column (main culprit after list schema changes) — only fallback when clearly 400 + missing-field phrase
  if (status === 400 && isMissingFieldMessage(message)) {
    return enableScheduleSafeFallback(message);
  }

  // Staff text columns are optional; drop them and retry
  if (staffTextColumnsEnabled) {
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
  }

  return false;
};

/**
 * Wrapper for Schedule API calls: catches 400 errors with missing field, applies fallback, and retries.
 * Supports 2-tier fallback: safe fields (tier 1) -> iron-clad fields (tier 2).
 * @param fn - Async function that performs the Schedule API call
 * @returns Result from fn(), or retry result after fallback application
 */
export const withScheduleFieldFallback = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    // Check if this is a field-not-found error that we can recover from
    if (handleScheduleOptionalFieldError(error)) {
      if (isDevRuntime) {
        console.info(`[schedule] Retrying with fallback select fields (tier: ${fallbackTier})`);
      }
      // Retry with fallback fields now in effect
      try {
        return await fn();
      } catch (retryError) {
        // If still failing, try one more tier down
        if (handleScheduleOptionalFieldError(retryError)) {
          if (isDevRuntime) {
            console.info(`[schedule] Second retry with fallback select fields (tier: ${fallbackTier})`);
          }
          return await fn();
        }
        throw retryError;
      }
    }
    // Not a recoverable error, re-throw
    throw error;
  }
};
