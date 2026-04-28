/**
 * SharePoint Client — Helper Functions (Single Source of Truth)
 *
 * Consolidated from former helpers.ts + spHelpers.ts.
 * Pure functions for path building, error handling, cache management, etc.
 */
import { isDebugFlag } from '@/lib/debugFlag';
import { auditLog } from '@/lib/debugLogger';
import { getAppConfig } from '@/lib/env';
export type ResolutionResult<T extends string> = {
  resolved: Record<T, string | undefined>;
  missing: T[];
  fieldStatus: Record<T, {
    resolvedName?: string;
    candidates: string[];
    isDrifted: boolean;
    driftType?: string;
  }>;
};

export type RetryReason = 'timeout' | 'throttle' | 'server' | 'auth';

export interface StaffIdentifier {
  type: 'guid' | 'title';
  value: string;
}

import { trimGuidBraces } from './spSchema';
import { trackSpEvent } from '@/lib/telemetry/spTelemetry';

// ── Constants ───────────────────────────────────────────────────────────────

export const DEFAULT_LIST_TEMPLATE = 100;
export const FIELDS_CACHE_TTL_MS = 20 * 60 * 1000; // 20分


// SharePoint Internal List Titles (Defaults) - SSOT is spListRegistry.ts
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

// ── Pagination and Fallback Helpers ────────────────────────────────────────

const MAX_ITEMS_PER_REQUEST = 500;
const MAX_PAGES = 100; // Increase to allow more items in shared helper

export type SpFetch = (path: string, init?: RequestInit) => Promise<Response>;

/**
 * Fetch all raw items from a SharePoint list via REST API with pagination.
 */
export async function fetchRawItems(
  spFetch: SpFetch,
  listTitle: string,
  selectFields: readonly string[],
  options: { top?: number; maxPages?: number, signal?: AbortSignal } = {}
): Promise<{ items: unknown[]; isTruncated: boolean }> {
  const allItems: unknown[] = [];
  const select = selectFields.join(',');
  const top = options.top || MAX_ITEMS_PER_REQUEST;
  const maxPages = options.maxPages || MAX_PAGES;
  
  let path: string | null =
    `/lists/getbytitle('${encodeURIComponent(listTitle)}')/items?$select=${select}&$orderby=ID asc&$top=${top}`;

  for (let page = 0; page < maxPages && path; page++) {
    if (options.signal?.aborted) break;

    const response = await spFetch(path);
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errText.slice(0, 300)}`);
    }
    const payload = (await response.json()) as {
      value?: unknown[];
      'odata.nextLink'?: string;
    };

    if (payload.value) {
      allItems.push(...payload.value);
    }

    const next = payload['odata.nextLink'] ?? null;
    if (next && page === maxPages - 1) {
      return { items: allItems, isTruncated: true };
    }
    path = next;
  }

  return { items: allItems, isTruncated: false };
}

/**
 * Fetch with $select fallback: retries request by removing the unknown field if 400 occurs.
 */
export async function fetchRawItemsWithFieldFallback(
  spFetch: SpFetch,
  listTitle: string,
  selectFields: readonly string[],
  options: { signal?: AbortSignal } = {}
): Promise<{ items: unknown[]; isTruncated: boolean; skippedFields: string[] }> {
  const skippedFields: string[] = [];
  let fields = Array.from(selectFields);

  for (;;) {
    try {
      const result = await fetchRawItems(spFetch, listTitle, fields, { signal: options.signal });
      return { ...result, skippedFields };
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('HTTP 400:') && fields.length > 1) {
        const missing = extractMissingField(err.message);
        if (missing && fields.includes(missing)) {
          trackSpEvent('sp:fail_open_triggered', {
            listName: listTitle,
            error: `HTTP 400: Field '${missing}' missing. Falling back.`,
            details: { missingField: missing, remainingFields: fields.length - 1 }
          });
          skippedFields.push(missing);
          fields = fields.filter((f) => f !== missing);
          continue;
        }
      }
      throw err;
    }
  }
}

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

/**
 * Coerce a Response to a JSON object of type T, or undefined if non-JSON, empty, or 204.
 */
export const coerceResult = async <T>(res: Response): Promise<T> => {
  if (res.status === 204) return undefined as unknown as T;
  
  const text = await res.text().catch(() => '');
  const contentType = res.headers.get('Content-Type') || '';
  
  // Try to parse as JSON if explicitly told so, or if it looks like JSON
  const isLikelyJson = contentType.includes('application/json') || 
                       text.trim().startsWith('{') || 
                       text.trim().startsWith('[');

  if (isLikelyJson) {
    if (!text || text.trim() === '') return undefined as unknown as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      // JSON parse failed: if we were TOLD it was JSON, return text as fallback, 
      // otherwise fall through to text return.
      if (contentType.includes('application/json')) return (text as unknown) as T;
    }
  }
  
  // Non-JSON response - return undefined per legacy contract
  return undefined as unknown as T;
};

import { reportSpHealthEvent } from '@/features/sp/health/spHealthSignalStore';

export const raiseHttpError = async (
  res: Response,
  options: {
    url?: string;
    method?: string;
    spOptions?: { quietStatuses?: number[]; silent?: boolean };
  } = {},
): Promise<never> => {
  const detail = await readErrorPayload(res);
  const AUDIT_DEBUG = isDebugFlag(getAppConfig().VITE_AUDIT_DEBUG);
  const { quietStatuses, silent } = options.spOptions || {};

  // 1. Report to Global Health Store (Realtime Signal)
  if (res.status === 401 || res.status === 403) {
    reportSpHealthEvent({
      severity: 'critical',
      reasonCode: 'sp_auth_failed',
      message: 'SharePoint 認証に失敗しました。MSAL構成またはサイト権限を確認してください。',
      occurredAt: new Date().toISOString(),
      source: 'realtime',
    });
  } else if (res.status === 404) {
    reportSpHealthEvent({
      severity: 'action_required',
      reasonCode: 'sp_list_unreachable',
      message: 'リストまたはリソースが見つかりません。セットアップが未完了の可能性があります。',
      occurredAt: new Date().toISOString(),
      source: 'realtime',
    });
  }

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
  const error: Error & { status?: number; statusText?: string; sprequestguid?: string | null } = new Error(detail || base);
  error.status = res.status;
  if (res.statusText) {
    error.statusText = res.statusText;
  }
  // SharePoint specific correlation ID
  error.sprequestguid = res.headers.get('sprequestguid');

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
  candidates: Record<T, string[]>,
  options?: { 
    onDrift?: (fieldName: T, resolutionType: string, driftType: string) => void 
  }
): ResolutionResult<T> {
  const resolved = {} as Record<T, string | undefined>;
  const fieldStatus = {} as Record<T, { resolvedName?: string; candidates: string[]; isDrifted: boolean; driftType?: string }>;
  const missing: T[] = [];

  const availableMap = new Map<string, string>();
  for (const name of available) {
    availableMap.set(name.toLowerCase(), name);
  }

  const used = new Set<string>();

  for (const key in candidates) {
    if (Object.prototype.hasOwnProperty.call(candidates, key)) {
      let driftType: string | undefined = undefined;

      // 1. First Pass: Exact match (case-insensitive)
      const exactMatchName = candidates[key].find(f => {
        const actual = availableMap.get(f.toLowerCase());
        return actual && !used.has(actual);
      });
      let foundCandidate = exactMatchName ? availableMap.get(exactMatchName.toLowerCase()) : undefined;
      
      if (foundCandidate && foundCandidate !== candidates[key][0]) {
        // It matched one of the candidates, but maybe not the primary one, or case is different
        if (foundCandidate.toLowerCase() === candidates[key][0].toLowerCase()) {
          driftType = 'case_mismatch';
        } else {
          driftType = 'fallback'; // Matched a secondary candidate directly
        }
      }

      // 2. Second Pass: Fuzzy match (handle SharePoint automatic suffix like '0', '1', etc. & _x0020_ encoding)
      if (!foundCandidate) {
        for (const base of candidates[key]) {
          const lowerBase = base.toLowerCase();

          // Strategy A: Suffix check (v2: handles multi-digit suffixes 0-99, _Zombie, and encoded spaces)
          const encodedBase = lowerBase.replace(/ /g, '_x0020_');
          const suffixRegex = new RegExp(`^${encodedBase}(\\d+|_zombie)$`);
          
          for (const [availableLow, actual] of availableMap.entries()) {
            if (!used.has(actual) && suffixRegex.test(availableLow)) {
              foundCandidate = actual;
              driftType = 'suffix_mismatch';
              break;
            }
          }
          if (foundCandidate) break;

          // Strategy B: Encode space to _x0020_ (Exact match)
          const actualB = availableMap.get(encodedBase);
          if (actualB && !used.has(actualB)) {
            foundCandidate = actualB;
            driftType = 'fuzzy_match';
            break;
          }

          // Strategy C: Bitwise/Normalized comparison (Extreme drift protection)
          const sanitizedCandidate = lowerBase.replace(/_x[0-9a-f]{4}_/gi, '').replace(/[^a-z0-9]/g, '');
          for (const [availableLow, actual] of availableMap.entries()) {
            if (used.has(actual)) continue;
            const availSanitized = availableLow.replace(/_x[0-9a-f]{4}_/gi, '').replace(/[^a-z0-9]/g, '');
            // Check if stripped names match or if one is a truncated version of another
            if (availSanitized === sanitizedCandidate || 
               (availSanitized.length >= 28 && sanitizedCandidate.startsWith(availSanitized))) {
              foundCandidate = actual;
              driftType = 'fuzzy_match';
              break;
            }
          }
          if (foundCandidate) break;

          // Strategy D: SharePoint 32-character truncation check
          if (encodedBase.length >= 32) {
            const truncated = encodedBase.slice(0, 32);
            const actualD = availableMap.get(truncated);
            if (actualD && !used.has(actualD)) {
              foundCandidate = actualD;
              driftType = 'truncation';
              break;
            }
          }
          if (foundCandidate) break;

          // Strategy E: SharePoint specialized suffixes (like 'Id' for Person/Lookup)
          const lowerBaseNoId = lowerBase.replace(/id$/, '');
          for (const [availableLow, actual] of availableMap.entries()) {
            if (used.has(actual)) continue;
            const availNoId = availableLow.replace(/id$/, '');
            if (availNoId === lowerBaseNoId && availNoId.length > 3) {
              foundCandidate = actual;
              driftType = 'fuzzy_match';
              break;
            }
          }
          if (foundCandidate) break;
        }
      }

      const resolvedName = foundCandidate;
      // Drift if it's not exactly the primary candidate (first in the list)
      const primaryCandidate = candidates[key][0];
      const isPrimaryMatch = !!resolvedName && resolvedName === primaryCandidate;
      const isDrifted = !!resolvedName && !isPrimaryMatch;

      if (isDrifted && options?.onDrift) {
        options.onDrift(key as T, 'fuzzy_match', driftType || 'unknown');
      }

      if (resolvedName) {
        used.add(resolvedName);
      }
      resolved[key] = resolvedName;
      fieldStatus[key] = {
        resolvedName: resolvedName,
        candidates: candidates[key],
        isDrifted,
        driftType
      };
      if (!resolvedName) {
        missing.push(key as T);
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

/**
 * SharePoint の生データを「洗浄」し、Mappers が期待する第一候補名に値を詰め替える。
 * これにより、Mappers を大幅に変更することなく Schema Drift (0-9サフィックス等) に対応できる。
 * 
 * @param row SharePoint の生アイテム
 * @param candidates フィールド候補定義 (各レコードの最初の要素がプライマリ名)
 * @param resolved 解決された内部名のマッピング (key: candidates のキー, value: 実際の内部名)
 */
export function washRow<T extends Record<string, unknown>>(
  row: T,
  _candidates: Record<string, string[]>,
  resolved: Record<string, string | undefined>
): T {
  const washed = { ...row };
  for (const [key, resName] of Object.entries(resolved)) {
    if (resName && resName !== key) {
      // 実際の内部名(StartDate0等)の値を、マッピング用キー(startDate等)にコピーする
      const value = row[resName];
      if (value !== undefined) {
        (washed as Record<string, unknown>)[key] = value;
      }
    }
  }
  return washed;
}

/**
 * 複数の行を洗浄する (washRow の配列版)
 */
export function washRows<T extends Record<string, unknown>>(
  rows: T[],
  candidates: Record<string, string[]>,
  resolved: Record<string, string | undefined>
): T[] {
  return rows.map(row => washRow(row, candidates, resolved));
}
