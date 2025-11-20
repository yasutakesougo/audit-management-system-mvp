/**
 * SharePoint Daily Records Mapping Layer
 *
 * This module provides a clean boundary between SharePoint list items and domain objects.
 *
 * Key responsibilities:
 * 1. Field name standardization (DAILY_FIELD_* constants)
 * 2. SP → Domain conversion (fromSpItem) with robust error handling
 * 3. Domain → SP conversion (toSpFields) with JSON serialization safety
 *
 * Error handling strategy:
 * - Status normalization: English/Japanese synonyms → Zod validation → fallback to '未作成'
 * - JSON serialization: Size limits + custom error types for troubleshooting
 * - Person/Reporter resolution: Multiple fallback chains to prevent "unknown" records
 * - Type coercion: Safe parsing with sensible defaults throughout
 */

import type { SpDailyItem } from '../../types';
import { AnyDailyZ, AxisDaily, AxisDailyZ, DailyADataZ, DailyBDataZ, DailyFilter, DailyStatusZ, DraftMetaZ, PersonDaily, PersonDailyZ, type AnyDaily } from './types';

const DAILY_FIELD_PERSON_ID = 'cr013_personId' as const;
const DAILY_FIELD_DATE = 'cr013_date' as const;
const DAILY_FIELD_STATUS = 'cr013_status' as const;
const DAILY_FIELD_REPORTER_NAME = 'cr013_reporterName' as const;
const DAILY_FIELD_REPORTER_ID = 'cr013_reporterId' as const;
const DAILY_FIELD_DRAFT = 'cr013_draftJson' as const;
const DAILY_FIELD_PAYLOAD = 'cr013_payload' as const;
const DAILY_FIELD_KIND = 'cr013_kind' as const;
const DAILY_FIELD_GROUP = 'cr013_group' as const;

const DAILY_BASE_FIELDS = [
  'Id',
  'Title',
  DAILY_FIELD_PERSON_ID,
  DAILY_FIELD_DATE,
  DAILY_FIELD_STATUS,
  DAILY_FIELD_REPORTER_NAME,
  DAILY_FIELD_REPORTER_ID,
  DAILY_FIELD_DRAFT,
  DAILY_FIELD_PAYLOAD,
  DAILY_FIELD_KIND,
  DAILY_FIELD_GROUP,
  'Modified',
  'Created',
] as const;

export const DAILY_SELECT_FIELDS = DAILY_BASE_FIELDS;
export const DAILY_SELECT_QS = `$select=${DAILY_SELECT_FIELDS.join(',')}`;
export type { SpDailyItem };

const MAX_JSON_FIELD_LENGTH = 60_000;

const STATUS_SYNONYMS: Record<string, PersonDaily['status']> = {
  // English variants
  draft: '作成中',
  pending: '作成中',
  inprogress: '作成中',
  'in-progress': '作成中',
  submitted: '完了',
  completed: '完了',
  finished: '完了',
  done: '完了',

  // Japanese variants
  下書き: '作成中',
  作業中: '作成中',
  進行中: '作成中',
  提出済み: '完了',
  完成: '完了',
  終了: '完了',
};

const cloneObject = <T>(value: unknown): T => {
  if (value == null || typeof value !== 'object') {
    throw new TypeError('Cannot clone non-object value');
  }
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value) as T;
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

class DailySerializationError extends Error {
  constructor(field: string, message: string) {
    super(`[daily] ${field} serialization failed: ${message}`);
    this.name = 'DailySerializationError';
  }
}

/**
 * Safely stringify values for SharePoint JSON fields with size limits.
 *
 * @param field - Field name for error context
 * @param value - Value to serialize
 * @returns JSON string within safe length limits
 * @throws {DailySerializationError} With detailed context for troubleshooting
 */
const safeStringify = (field: string, value: unknown): string => {
  let serialized: string;
  try {
    serialized = JSON.stringify(value ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DailySerializationError(field, message);
  }

  if (serialized.length > MAX_JSON_FIELD_LENGTH) {
    throw new DailySerializationError(field, `length ${serialized.length} exceeds safe limit of ${MAX_JSON_FIELD_LENGTH}. Split the entry or reduce content.`);
  }

  return serialized;
};

const asIsoString = (value: unknown): string | undefined => {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' && value.trim().length ? value : undefined;
};

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value == null) return fallback;
  if (typeof value === 'string' && value.trim().length) {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object') {
    try {
      return cloneObject<T>(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

/**
 * Normalize status values with comprehensive fallback strategy.
 *
 * Handles:
 * - English synonyms (draft, pending, submitted)
 * - Japanese variants (下書き, etc.)
 * - Case-insensitive matching
 * - Zod schema validation as final gate
 *
 * @param status - Raw status value from SharePoint
 * @returns Normalized status or '未作成' fallback
 */
const coerceStatus = (status: unknown): PersonDaily['status'] => {
  if (typeof status !== 'string') return '未作成';
  const trimmed = status.trim();
  if (!trimmed.length) return '未作成';

  // Try both original and lowercase versions for synonym lookup
  const synonym = STATUS_SYNONYMS[trimmed] ?? STATUS_SYNONYMS[trimmed.toLowerCase()];
  if (synonym) return synonym;

  const parsed = DailyStatusZ.safeParse(trimmed);
  return parsed.success ? parsed.data : '未作成';
};

const coerceDraft = (value: unknown) => {
  const parsed = DraftMetaZ.safeParse(parseJson<unknown>(value, {}));
  return parsed.success ? parsed.data : DraftMetaZ.parse({});
};

const coerceReporter = (item: SpDailyItem) => {
  const reportedName =
    typeof item[DAILY_FIELD_REPORTER_NAME] === 'string' ? item[DAILY_FIELD_REPORTER_NAME].trim() : '';
  const fallbackName = typeof item.Title === 'string' ? item.Title.trim() : '';
  const name = reportedName || fallbackName || '記録作成者不明';
  const id = typeof item[DAILY_FIELD_REPORTER_ID] === 'string' && item[DAILY_FIELD_REPORTER_ID] ? item[DAILY_FIELD_REPORTER_ID] : undefined;
  return { name, ...(id ? { id } : {}) };
};

const coercePerson = (item: SpDailyItem) => {
  const id = typeof item[DAILY_FIELD_PERSON_ID] === 'string' && item[DAILY_FIELD_PERSON_ID] ? item[DAILY_FIELD_PERSON_ID].trim() : '';
  const name = typeof item.Title === 'string' && item.Title ? item.Title.trim() : '';
  return { id, name };
};

const coercePersonName = (item: SpDailyItem) => {
  const name = typeof item.Title === 'string' && item.Title ? item.Title.trim() : '';
  return name || coerceReporter(item).name;
};

const parseDataA = (value: unknown) => {
  const parsed = DailyADataZ.safeParse(parseJson(value, {}));
  return parsed.success ? parsed.data : DailyADataZ.parse({});
};

const parseDataB = (value: unknown) => {
  const parsed = DailyBDataZ.safeParse(parseJson(value, {}));
  return parsed.success ? parsed.data : DailyBDataZ.parse({});
};

/**
 * Convert SharePoint daily item to domain object with robust error handling.
 *
 * Conversion flow:
 * 1. Determine kind (A/B) from stored value or fallback to argKind
 * 2. Extract and coerce all base fields with fallbacks
 * 3. Parse kind-specific data payload
 * 4. Final Zod validation for type safety
 *
 * @param item - Raw SharePoint list item
 * @param argKind - Fallback kind when not specified in item
 * @returns Typed domain object (PersonDaily | AxisDaily)
 */
export const fromSpItem = (item: SpDailyItem, argKind: 'A' | 'B'): AnyDaily => {
  const storedKind = typeof item[DAILY_FIELD_KIND] === 'string' ? item[DAILY_FIELD_KIND] : undefined;
  const kind: 'A' | 'B' = storedKind === 'A' || storedKind === 'B' ? storedKind : argKind;

  const person = coercePerson(item);

  const base = {
    id: typeof item.Id === 'number' ? item.Id : Number(item.Id ?? 0) || 0,
    personId: person.id,
    personName: coercePersonName(item),
    date: typeof item[DAILY_FIELD_DATE] === 'string' ? item[DAILY_FIELD_DATE] : '',
    status: coerceStatus(item[DAILY_FIELD_STATUS]),
    reporter: coerceReporter(item),
    draft: coerceDraft(item[DAILY_FIELD_DRAFT]),
    createdAt: asIsoString(item.Created),
    updatedAt: asIsoString(item.Modified),
  } satisfies Partial<PersonDaily>;

  if (kind === 'A') {
    const candidate: PersonDaily = PersonDailyZ.parse({
      ...base,
      kind: 'A',
      data: parseDataA(item[DAILY_FIELD_PAYLOAD]),
    });
    return candidate;
  }

  const candidate: AxisDaily = AxisDailyZ.parse({
    ...base,
    kind: 'B',
    data: parseDataB(item[DAILY_FIELD_PAYLOAD]),
  });
  return candidate;
};

/**
 * Convert domain object to SharePoint field mappings.
 *
 * Ensures:
 * - Input validation through AnyDailyZ parsing
 * - Safe JSON serialization of complex fields
 * - Proper null handling for optional reporter ID
 * - Title field population from personName
 *
 * @param daily - Validated domain object
 * @returns SharePoint field mapping ready for SP operations
 */
export const toSpFields = (daily: AnyDaily): Record<string, unknown> => {
  const parsed = AnyDailyZ.parse(daily);
  const reporterId = 'reporter' in parsed && parsed.reporter && 'id' in parsed.reporter ? parsed.reporter.id : undefined;
  const reporterName = parsed.reporter?.name ?? '';
  return {
    Title: parsed.personName,
    [DAILY_FIELD_PERSON_ID]: parsed.personId,
    [DAILY_FIELD_DATE]: parsed.date,
    [DAILY_FIELD_STATUS]: parsed.status,
    [DAILY_FIELD_REPORTER_NAME]: reporterName,
    [DAILY_FIELD_REPORTER_ID]: reporterId ?? null,
    [DAILY_FIELD_DRAFT]: safeStringify('draft', parsed.draft ?? {}),
    [DAILY_FIELD_PAYLOAD]: safeStringify('payload', parsed.data ?? {}),
    [DAILY_FIELD_KIND]: parsed.kind,
  } satisfies Record<string, unknown>;
};

export const extractPersonFromItem = (item: SpDailyItem) => {
  const { id, name } = coercePerson(item);
  return {
    personId: id,
    personName: name,
    group: typeof item[DAILY_FIELD_GROUP] === 'string' && item[DAILY_FIELD_GROUP] ? item[DAILY_FIELD_GROUP] : undefined,
  };
};

export const getFieldNames = () => ({
  personId: DAILY_FIELD_PERSON_ID,
  date: DAILY_FIELD_DATE,
  status: DAILY_FIELD_STATUS,
  group: DAILY_FIELD_GROUP,
});

export type DailyFilterState = DailyFilter;
