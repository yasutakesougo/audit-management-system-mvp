/**
 * SharePoint Client — Helper Functions (Single Source of Truth)
 *
 * Consolidated from former helpers.ts + spHelpers.ts.
 * Pure functions for path building, error handling, cache management, etc.
 */
import { auditLog } from '@/lib/debugLogger';
import { getAppConfig } from '@/lib/env';
export interface ResolutionResult<T extends string> {
  resolved: Record<T, string | undefined>;
  missing: T[];
  fieldStatus: Record<T, { resolvedName?: string; candidates: string[]; isDrifted: boolean }>;
}

export type RetryReason = 'timeout' | 'throttle' | 'server' | 'auth';

export interface StaffIdentifier {
  type: 'guid' | 'title';
  value: string;
}

import { trimGuidBraces } from './spSchema';

// ── Constants ───────────────────────────────────────────────────────────────

export const DEFAULT_LIST_TEMPLATE = 100;
export const FIELDS_CACHE_TTL_MS = 20 * 60 * 1000; // 20分

export const DEFAULT_USERS_LIST_TITLE = 'Users_Master';
export const DEFAULT_STAFF_LIST_TITLE = 'Staff_Master';

export const USERS_BASE_FIELDS = [
  'Id', 'UserID', 'FullName', 'ContractDate',
  'IsHighIntensitySupportTarget', 'ServiceStartDate', 'ServiceEndDate',
] as const;
export const USERS_OPTIONAL_FIELDS = [
  'FullNameKana', 'Furigana', 'Email', 'Phone', 'BirthDate',
] as const;

export const STAFF_BASE_FIELDS = [
  'Id', 'StaffID', 'StaffName', 'Role', 'Phone', 'Email',
] as const;
export const STAFF_OPTIONAL_FIELDS = [
  'StaffID', 'AttendanceDays', 'Certifications', 'Department', 'Notes',
] as const;

// ── GUID regex ──────────────────────────────────────────────────────────────

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// ── Env sanitization ────────────────────────────────────────────────────────

export const sanitizeEnvValue = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

// ── Retry classification ────────────────────────────────────────────────────

export const classifyRetry = (status: number): RetryReason | null => {
  if (status === 408) return 'timeout';
  if (status === 429) return 'throttle';
  if ([500, 502, 503, 504].includes(status)) return 'server';
  return null;
};

// ── GUID / Path helpers ─────────────────────────────────────────────────────

export const normalizeGuidCandidate = (value: string): string =>
  trimGuidBraces(value.replace(/^guid:/i, ''));

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
  if (GUID_REGEX.test(guidCandidate)) {
    return `/lists(guid'${guidCandidate}')`;
  }
  return `/lists/getbytitle('${encodeURIComponent(raw)}')`;
};

export const buildItemPath = (
  identifier: string,
  id?: number,
  select?: string[],
): string => {
  const base = resolveListPath(identifier);
  const suffix = typeof id === 'number' ? `/items(${id})` : '/items';
  const params = new URLSearchParams();
  if (select?.length) {
    params.append('$select', select.join(','));
  }
  const query = params.toString();
  return query ? `${base}${suffix}?${query}` : `${base}${suffix}`;
};

export const buildListItemsPath = (
  listTitle: string,
  select: string[],
  top: number,
): string => {
  const queryParts: string[] = [];
  if (select.length) queryParts.push(`$select=${select.join(',')}`);
  if (Number.isFinite(top) && top > 0) queryParts.push(`$top=${top}`);
  const query = queryParts.length ? `?${queryParts.join('&')}` : '';
  const guidCandidate = normalizeGuidCandidate(listTitle);
  if (GUID_REGEX.test(guidCandidate)) {
    return `/lists(guid'${guidCandidate}')/items${query}`;
  }
  return `/lists/getbytitle('${encodeURIComponent(listTitle)}')/items${query}`;
};

// ── Staff identifier resolver ───────────────────────────────────────────────

export const resolveStaffListIdentifier = (
  titleOverride: string,
  guidOverride: string,
): StaffIdentifier => {
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

// ── Missing optional fields cache (in-memory) ──────────────────────────────

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
  return match?.[1] ?? null;
};

export const buildSelectFields = (
  baseFields: readonly string[],
  optionalFields: readonly string[],
  missing: Set<string>,
): string[] => {
  const base = baseFields.filter((field) => !missing.has(field));
  const optional = optionalFields.filter((field) => !missing.has(field));
  const merged = [...base, ...optional];
  return Array.from(new Set(merged));
};

// ── Fields cache session storage helpers ────────────────────────────────────

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

// ── Top clamper ─────────────────────────────────────────────────────────────

export const clampTop = (value: number | undefined): number => {
  if (!Number.isFinite(value)) return 100;
  const numeric = Number(value);
  if (!numeric || numeric < 1) return 1;
  if (numeric > 5000) return 5000;
  return Math.floor(numeric);
};

// ── Error response parsing ──────────────────────────────────────────────────

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

export const raiseHttpError = async (
  res: Response,
  options: { 
    url?: string; 
    method?: string; 
    spOptions?: { quietStatuses?: number[]; silent?: boolean };
  } = {},
): Promise<never> => {
  const detail = await readErrorPayload(res);
  const AUDIT_DEBUG = getAppConfig().VITE_AUDIT_DEBUG;
  const { quietStatuses, silent } = options.spOptions || {};

  // Skip logging if silent or quiet status match
  const shouldLog = !silent && !(quietStatuses && quietStatuses.includes(res.status));

  if (shouldLog) {
    // 重要なエラーのみログに残す
    auditLog.error('sp', 'http_error', {
      status: res.status,
      statusText: res.statusText,
      method: options.method,
      url: options.url ? options.url.split('?')[0] : undefined,
    });

    if (AUDIT_DEBUG) {
      auditLog.debug('sp', 'http_error_detail', {
        status: res.status,
        statusText: res.statusText,
        method: options.method,
        url: options.url,
        detailPreview: typeof detail === 'string' ? detail.slice(0, 800) : detail,
      });
    }
  }

  const base = `APIリクエストに失敗しました (${res.status} ${res.statusText ?? ''})`;
  const error: Error & { status?: number; statusText?: string } = new Error(detail || base);
  error.status = res.status;
  if (res.statusText) {
    error.statusText = res.statusText;
  }
  throw error;
};

// ── Reset for tests ─────────────────────────────────────────────────────────

export const resetMissingOptionalFieldsCache = (): void => {
  missingOptionalFieldsCache.clear();
};

// ── Cache clear utilities (debug / admin) ───────────────────────────────────

/**
 * Fields キャッシュを手動クリア（デバッグ用）
 */
export function clearFieldsCacheFor(listTitle: string, siteUrl: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const key = makeFieldsCacheKey(siteUrl, listTitle);
  sessionStorage.removeItem(key);
  auditLog.info('sp:fields', 'cache_cleared', { listTitle });
}

/**
 * 全 Fields キャッシュをクリア
 */
export function clearAllFieldsCache(): void {
  if (typeof sessionStorage === 'undefined') return;
  const prefix = 'sp.fieldsCache.v1::';
  let count = 0;
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(prefix)) {
      sessionStorage.removeItem(key);
      count++;
    }
  }
  auditLog.info('sp:fields', 'cache_cleared_all', { count });
}
/**
 * 実在するフィールド名 (available) の中から、候補 (candidates) に合致するものを詳細に解決する
 */
export function resolveInternalNamesDetailed<T extends string>(
  available: Set<string>,
  candidates: Record<T, string[]>
): ResolutionResult<T> {
  const resolved = {} as Record<T, string | undefined>;
  const fieldStatus = {} as Record<T, { resolvedName?: string; candidates: string[]; isDrifted: boolean }>;
  const missing: T[] = [];
  
  // Case-insensitive lookup map for available fields
  const availableMap = new Map<string, string>();
  for (const name of available) {
    availableMap.set(name.toLowerCase(), name);
  }
  
  for (const key in candidates) {
    if (Object.prototype.hasOwnProperty.call(candidates, key)) {
      // 1. First Pass: Exact match (case-insensitive)
      const exactMatch = candidates[key].find(f => availableMap.has(f.toLowerCase()));
      let foundCandidate = exactMatch ? availableMap.get(exactMatch.toLowerCase()) : undefined;
      
      // 2. Second Pass: Fuzzy match (handle SharePoint automatic suffix like '0', '1', etc. & _x0020_ encoding)
      if (!foundCandidate) {
        for (const base of candidates[key]) {
          const lowerBase = base.toLowerCase();
          
          // Strategy A: Suffix check (0-9)
          for (let i = 0; i < 10; i++) {
            const suffixCandidate = `${lowerBase}${i}`;
            if (availableMap.has(suffixCandidate)) {
              foundCandidate = availableMap.get(suffixCandidate);
              break;
            }
          }
          if (foundCandidate) break;

          // Strategy B: Encode space to _x0020_
          const encoded = lowerBase.replace(/ /g, '_x0020_');
          if (availableMap.has(encoded)) {
            foundCandidate = availableMap.get(encoded);
            break;
          }

          // Strategy C: Check all available names by stripping _x0020_ and suffixes
          for (const [availableLow, actual] of availableMap.entries()) {
            const stripped = availableLow.replace(/_x0020_/g, '').replace(/[0-9]+$/, '');
            if (stripped === lowerBase) {
              foundCandidate = actual;
              break;
            }
          }
          if (foundCandidate) break;
        }
      }

      const resolvedName = foundCandidate;
      const isExactMatch = !!exactMatch && foundCandidate === availableMap.get(exactMatch.toLowerCase());
      const isDrifted = !!resolvedName && !isExactMatch;
      
      resolved[key] = resolvedName;
      fieldStatus[key] = {
        resolvedName: resolvedName,
        candidates: candidates[key],
        isDrifted
      };
      if (!resolvedName) {
        missing.push(key);
      }
    }
  }
  
  return { resolved, missing, fieldStatus };
}

/**
 * SharePoint 内部名の動的解決ユーティリティ
 */
export function resolveInternalNames<T extends string>(
  available: Set<string>,
  candidates: Record<T, string[]>
): Record<T, string | undefined> {
  return resolveInternalNamesDetailed(available, candidates).resolved;
}

/**
 * 必須フィールドがすべて解決されているかチェックする
 */
export function areEssentialFieldsResolved<T extends string>(
  resolved: Record<T, string | undefined>,
  essentials: T[]
): boolean {
  return essentials.every(key => !!resolved[key]);
}
