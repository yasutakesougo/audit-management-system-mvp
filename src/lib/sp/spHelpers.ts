/**
 * SharePoint Client — Pure helper functions
 * Extracted from spClient.ts for single-responsibility.
 */

import { trimGuidBraces } from './spSchema';
import type { RetryReason, StaffIdentifier } from './spTypes';

// ── Constants ──
export const DEFAULT_LIST_TEMPLATE = 100;
export const FIELDS_CACHE_TTL_MS = 20 * 60 * 1000; // 20分

export const DEFAULT_USERS_LIST_TITLE = 'Users_Master';
export const DEFAULT_STAFF_LIST_TITLE = 'Staff_Master';

export const USERS_BASE_FIELDS = ['Id', 'UserID', 'FullName', 'ContractDate', 'IsHighIntensitySupportTarget', 'ServiceStartDate', 'ServiceEndDate'] as const;
export const USERS_OPTIONAL_FIELDS = ['FullNameKana', 'Furigana', 'Email', 'Phone', 'BirthDate'] as const;

export const STAFF_BASE_FIELDS = ['Id', 'StaffID', 'StaffName', 'Role', 'Phone', 'Email'] as const;
export const STAFF_OPTIONAL_FIELDS = ['StaffID', 'AttendanceDays', 'Certifications', 'Department', 'Notes'] as const;

// ── Env sanitization ──
export const sanitizeEnvValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// ── Retry classification ──
export const classifyRetry = (status: number): RetryReason | null => {
  if (status === 408) return 'timeout';
  if (status === 429) return 'throttle';
  if ([500, 502, 503, 504].includes(status)) return 'server';
  return null;
};

// ── GUID helpers ──
export const normalizeGuidCandidate = (value: string): string => trimGuidBraces(value.replace(/^guid:/i, ''));

// ── List path builders ──
export const resolveListPath = (identifier: string): string => {
  const raw = (identifier ?? '').trim();
  if (!raw) {
    throw new Error('SharePoint list identifier is required');
  }
  if (/^\//.test(raw)) {
    return raw;
  }
  if (/^(lists|web)\//i.test(raw) || /^lists\(/i.test(raw)) {
    return `/${raw}`;
  }
  const guidCandidate = normalizeGuidCandidate(raw);
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(guidCandidate)) {
    return `/lists(guid'${guidCandidate}')`;
  }
  return `/lists/getbytitle('${encodeURIComponent(raw)}')`;
};

export const buildItemPath = (identifier: string, id?: number, select?: string[]): string => {
  const base = resolveListPath(identifier);
  const suffix = typeof id === 'number' ? `/items(${id})` : '/items';
  const params = new URLSearchParams();
  if (select?.length) {
    params.append('$select', select.join(','));
  }
  const query = params.toString();
  return query ? `${base}${suffix}?${query}` : `${base}${suffix}`;
};

export const buildListItemsPath = (listTitle: string, select: string[], top: number): string => {
  const queryParts: string[] = [];
  if (select.length) queryParts.push(`$select=${select.join(',')}`);
  if (Number.isFinite(top) && top > 0) queryParts.push(`$top=${top}`);
  const query = queryParts.length ? `?${queryParts.join('&')}` : '';
  const guidCandidate = normalizeGuidCandidate(listTitle);
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(guidCandidate)) {
    return `/lists(guid'${guidCandidate}')/items${query}`;
  }
  return `/lists/getbytitle('${encodeURIComponent(listTitle)}')/items${query}`;
};

// ── Staff identifier resolver ──
export const resolveStaffListIdentifier = (titleOverride: string, guidOverride: string): StaffIdentifier => {
  const normalizedGuid = trimGuidBraces(guidOverride);
  if (normalizedGuid) {
    return { type: 'guid', value: normalizedGuid };
  }
  const trimmedTitle = titleOverride.trim();
  if (/^guid:/i.test(trimmedTitle)) {
    const candidate = trimGuidBraces(trimmedTitle.replace(/^guid:/i, ''));
    if (candidate) return { type: 'guid', value: candidate };
  }
  if (trimmedTitle) {
    return { type: 'title', value: trimmedTitle };
  }
  return { type: 'title', value: DEFAULT_STAFF_LIST_TITLE };
};

// ── Missing optional fields cache ──
const missingOptionalFieldsCache = new Map<string, Set<string>>();

export const getMissingSet = (listTitle: string): Set<string> => {
  let current = missingOptionalFieldsCache.get(listTitle);
  if (!current) {
    current = new Set<string>();
    missingOptionalFieldsCache.set(listTitle, current);
  }
  return current;
};

export const markOptionalMissing = (listTitle: string, field: string): void => {
  if (!field) return;
  getMissingSet(listTitle).add(field);
};

export const extractMissingField = (message: string): string | null => {
  const match = message.match(/'([^']+)'/);
  return (match && match[1]) ? match[1] : null;
};

export const buildSelectFields = (baseFields: readonly string[], optionalFields: readonly string[], missing: Set<string>): string[] => {
  const base = baseFields.filter((field) => !missing.has(field));
  const optional = optionalFields.filter((field) => !missing.has(field));
  const merged = [...base, ...optional];
  return Array.from(new Set(merged));
};

// ── Fields cache session storage helpers ──
export const nowMs = (): number => Date.now();

export function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function safeJsonStringify(obj: unknown): string | null {
  try {
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

export const makeFieldsCacheKey = (siteUrl: string, listTitle: string): string =>
  `sp.fieldsCache.v1::${siteUrl}::${listTitle}`;

// ── Top clamper ──
export const clampTop = (value: number | undefined): number => {
  if (!Number.isFinite(value)) return 100;
  const numeric = Number(value);
  if (!numeric || numeric < 1) return 1;
  if (numeric > 5000) return 5000;
  return Math.floor(numeric);
};

// ── Error payload reader ──
export const readErrorPayload = async (res: Response): Promise<string> => {
  const text = await res.text().catch(() => '');
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
      text
    );
  } catch {
    return text;
  }
};

// ── Reset for tests ──
export const resetMissingOptionalFieldsCache = (): void => {
  missingOptionalFieldsCache.clear();
};
