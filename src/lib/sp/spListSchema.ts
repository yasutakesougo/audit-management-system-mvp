/**
 * SharePoint List — Schema & Metadata Operations
 *
 * List existence checks, field schema fetching, field cache, and ensure-list logic.
 * All functions accept `SpFetchFn` via explicit parameter injection.
 */

import { auditLog } from '@/lib/debugLogger';
import { readEnv } from '@/lib/env';

import {
    FIELDS_CACHE_TTL_MS,
    makeFieldsCacheKey,
    nowMs,
    resolveListPath,
    resolveInternalNamesDetailed,
    safeJsonParse,
    safeJsonStringify
} from './helpers';
import { trackGuidResolution } from '@/lib/telemetry/spTelemetry';
import type { SpFetchFn } from './spLists';
import { buildFieldSchema, trimGuidBraces } from './spSchema';
import type {
    EnsureListOptions,
    EnsureListResult,
    ExistingFieldShape,
    FailedFieldInfo,
    FailedFieldReason,
    FieldsCacheEntry,
    SharePointListMetadata,
    SpFieldDef,
} from './types';

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_LIST_TEMPLATE = 100;

// ── List metadata ───────────────────────────────────────────────────────────

/**
 * Attempt to fetch list metadata. Returns `null` if the list does not exist (404).
 */
export async function tryGetListMetadata(
  spFetch: SpFetchFn,
  listTitle: string,
  spOptions?: import('./types').SpRequestOptions,
): Promise<EnsureListResult | null> {
  const base = resolveListPath(listTitle);
  trackGuidResolution(listTitle, base);
  const path = `${base}?$select=Id,Title`;
  try {
    const res = await spFetch(path, { spOptions });
    const json = (await res.json().catch(() => ({}))) as SharePointListMetadata;
    const nested = json.d ?? {};
    const rawId =
      typeof json.Id === 'string' ? json.Id : typeof nested.Id === 'string' ? nested.Id : '';
    const rawTitle =
      typeof json.Title === 'string'
        ? json.Title
        : typeof nested.Title === 'string'
          ? nested.Title
          : '';
    return {
      listId: trimGuidBraces(rawId),
      title: rawTitle || listTitle,
    };
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error
      ? (error as { status?: number }).status
      : undefined;
    if (status === 404) {
      return null;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (
      /\b404\b/.test(message) ||
      /Not Found/i.test(message) ||
      /does not exist/i.test(message)
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch all existing list titles and IDs once to avoid redundant 404 probes.
 */
export async function getExistingListTitlesAndIds(
  spFetch: SpFetchFn,
): Promise<Set<string>> {
  const path = `lists?$select=Title,Id`;
  try {
    const res = await spFetch(path);
    const json = (await res.json().catch(() => ({ value: [] }))) as {
      value?: { Title: string; Id: string }[];
    };
    const identifiers = new Set<string>();
    for (const list of json.value ?? []) {
      if (list.Title) identifiers.add(list.Title);
      if (list.Id) identifiers.add(trimGuidBraces(list.Id));
    }
    return identifiers;
  } catch (error) {
    auditLog.warn('sp:metadata', 'bulk_check_failed', { error });
    return new Set();
  }
}

// ── Field schema ────────────────────────────────────────────────────────────

/**
 * Fetch the full field schema of a list (InternalName, TypeAsString, Required).
 */
export async function fetchExistingFields(
  spFetch: SpFetchFn,
  listTitle: string,
): Promise<Map<string, ExistingFieldShape>> {
  const base = resolveListPath(listTitle);
  // SharePoint fields endpoint is paged; without $top large lists can hide existing fields,
  // causing false negatives in ensureListExists() and duplicate-suffixed columns
  // (e.g. ApprovedBy0, ApprovedBy1 regrowth on Approval_Logs).
  const path = `${base}/fields?$select=InternalName,TypeAsString,Required&$top=5000`;
  const res = await spFetch(path);
  const json = (await res.json().catch(() => ({ value: [] }))) as {
    value?: ExistingFieldShape[];
  };
  const map = new Map<string, ExistingFieldShape>();
  for (const row of json.value ?? []) {
    if (!row || typeof row.InternalName !== 'string') continue;
    map.set(row.InternalName, row);
  }
  return map;
}

/**
 * Get a cached (sessionStorage, 20-min TTL) set of InternalName values for a list.
 */
export async function getListFieldInternalNames(
  spFetch: SpFetchFn,
  baseUrl: string,
  listTitle: string,
): Promise<Set<string>> {
  const debug = String(readEnv('VITE_AUDIT_DEBUG', '')) === '1';
  const siteUrl = baseUrl;
  const cacheKey = makeFieldsCacheKey(siteUrl, listTitle);

  // 1) Cache hit check
  if (typeof sessionStorage !== 'undefined') {
    const cached = safeJsonParse<FieldsCacheEntry>(sessionStorage.getItem(cacheKey));
    if (cached && cached.v === 1) {
      const age = nowMs() - cached.savedAt;
      const valid =
        cached.siteUrl === siteUrl &&
        cached.listTitle === listTitle &&
        age >= 0 &&
        age < FIELDS_CACHE_TTL_MS;

      if (valid && Array.isArray(cached.internalNames) && cached.internalNames.length > 0) {
        if (debug) {
          auditLog.debug('sp:fields', 'cache_hit', {
            listTitle,
            count: cached.internalNames.length,
            ageMs: age,
          });
        }
        return new Set(cached.internalNames);
      }

      // Stale / invalid → drop
      if (debug) {
        auditLog.debug('sp:fields', 'cache_stale', {
          listTitle,
          ageMs: age,
        });
      }
      sessionStorage.removeItem(cacheKey);
    } else if (cached) {
      sessionStorage.removeItem(cacheKey);
    }
  }

  // 2) Network fetch
  const base = resolveListPath(listTitle);
  const path = `${base}/fields?$select=InternalName&$top=5000`;

  try {
    const res = await spFetch(path);
    const json = (await res.json().catch(() => ({ value: [] }))) as {
      value?: { InternalName?: string }[];
    };
    const names = new Set<string>();
    for (const field of json.value ?? []) {
      if (field?.InternalName) {
        names.add(field.InternalName);
      }
    }

    // 3) Save cache (skip if empty)
    if (typeof sessionStorage !== 'undefined' && names.size > 0) {
      const entry: FieldsCacheEntry = {
        v: 1,
        savedAt: nowMs(),
        listTitle,
        siteUrl,
        internalNames: Array.from(names),
      };
      const s = safeJsonStringify(entry);
      if (s) {
        sessionStorage.setItem(cacheKey, s);
        if (debug) {
          auditLog.debug('sp:fields', 'cache_save', { listTitle, count: names.size });
        }
      }
    } else if (debug && names.size === 0) {
      auditLog.debug('sp:fields', 'cache_empty', { listTitle });
    }

    return names;
  } catch (e) {
    // 4) On failure, do not leave stale cache
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(cacheKey);
    }
    if (debug) {
      auditLog.warn('sp:fields', 'fetch_failed', { listTitle, error: e });
    }
    throw e;
  }
}

/**
 * Detects SharePoint 8KB row size limit errors.
 * Includes both English and Japanese error strings seen in production.
 */
/**
 * Detects SharePoint indexed-column-count limit errors.
 * Distinct from row-size limit: caused by exceeding the max number of indexed columns per list (~20).
 */
function isIndexedColumnLimitError(errText: string): boolean {
  return (
    errText.includes('indexed columns') && errText.includes('maximum') ||
    errText.includes('インデックス処理されている列の数が最大限') ||
    errText.includes('この列をインデックス処理できません')
  );
}

function classifyFieldError(errText: string): FailedFieldReason {
  if (isIndexedColumnLimitError(errText)) return 'indexed_column_limit';
  if (isRowSizeLimitError(errText)) return 'row_size_limit';
  return 'http_error';
}

function extractHttpStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error && 'status' in error) {
    const s = (error as { status?: unknown }).status;
    if (typeof s === 'number') return s;
  }
  return undefined;
}

function isRowSizeLimitError(errText: string): boolean {
  return (
    errText.includes('maximum for this list') ||
    errText.includes('reached the limit') ||
    errText.includes('合計サイズが制限を超えている') ||
    errText.includes('制限を超えているので、列を追加できません') ||
    errText.includes('まず、他の列をいくつか削除')
  );
}

export type AddFieldStatus = 'success' | 'limit_reached' | 'indexed_limit' | 'error';

export interface AddFieldResult {
  status: AddFieldStatus;
  reason?: FailedFieldReason;
  httpStatus?: number;
  detail?: string;
}

/**
 * Add a single field to a list using the CreateFieldAsXml endpoint.
 *
 * Note: `spFetch` raises on non-OK responses, so classification happens in the catch
 * block. The `if (!res.ok)` branch below is defensive in case spFetch is ever changed
 * to return without throwing.
 */
export async function addFieldToList(
  spFetch: SpFetchFn,
  listTitle: string,
  field: SpFieldDef,
): Promise<AddFieldResult> {
  const base = resolveListPath(listTitle);
  const schema = buildFieldSchema(field);
  const body = {
    parameters: {
      __metadata: { type: 'SP.XmlSchemaFieldCreationInformation' },
      SchemaXml: schema,
      Options: field.addToDefaultView ? 8 : 0,
    },
  };
  try {
    const res = await spFetch(`${base}/fields/createfieldasxml`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;odata=verbose',
        Accept: 'application/json;odata=verbose',
      },
      body: JSON.stringify(body),
      spOptions: { retries: 0 },
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const reason = classifyFieldError(errText);
      auditLog.warn('sp:fields', 'schema_provision_failed', {
        listTitle,
        field: field.internalName,
        status: res.status,
        reason,
        detail: errText.slice(0, 500),
      });
      return {
        status: reason === 'row_size_limit' ? 'limit_reached'
              : reason === 'indexed_column_limit' ? 'indexed_limit'
              : 'error',
        reason,
        httpStatus: res.status,
        detail: errText.slice(0, 500),
      };
    }
    return { status: 'success' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reason = classifyFieldError(message);
    const httpStatus = extractHttpStatus(error);
    auditLog.warn('sp:fields', 'schema_provision_failed', {
      listTitle,
      field: field.internalName,
      status: httpStatus,
      reason,
      detail: message.slice(0, 500),
    });
    return {
      status: reason === 'row_size_limit' ? 'limit_reached'
            : reason === 'indexed_column_limit' ? 'indexed_limit'
            : 'error',
      reason,
      httpStatus,
      detail: message.slice(0, 500),
    };
  }
}

/**
 * Update an existing field's properties (e.g., Indexed).
 */
export async function updateField(
  spFetch: SpFetchFn,
  listTitle: string,
  internalName: string,
  updates: { Indexed?: boolean }
): Promise<"success" | "error"> {
  const base = resolveListPath(listTitle);
  const path = `${base}/fields/getbyinternalnameortitle('${encodeURIComponent(internalName)}')`;
  
  const body = {
    __metadata: { type: 'SP.Field' },
    ...updates
  };

  try {
    const res = await spFetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;odata=verbose',
        Accept: 'application/json;odata=verbose',
        'X-HTTP-Method': 'MERGE',
        'If-Match': '*',
      },
      body: JSON.stringify(body),
      spOptions: { retries: 0 },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      auditLog.error('sp:fields', 'update_field_failed', { 
        listTitle, 
        internalName, 
        status: res.status,
        detail: errText.slice(0, 500)
      });
      return "error";
    }
    return "success";
  } catch (error) {
    console.error(`[updateField] Unexpected error updating field "${internalName}":`, error);
    return "error";
  }
}

// ── Ensure list ─────────────────────────────────────────────────────────────

// ── Ensure list ─────────────────────────────────────────────────────────────

/**
 * Ensure a list exists with the given fields.
 * Creates the list if absent, then reconciles field definitions.
 */
export async function ensureListExists(
  spFetch: SpFetchFn,
  listTitle: string,
  fields: SpFieldDef[],
  options: EnsureListOptions = {},
): Promise<EnsureListResult> {
  const baseTemplate = options.baseTemplate ?? DEFAULT_LIST_TEMPLATE;

  let ensured = await tryGetListMetadata(spFetch, listTitle);
  if (!ensured) {
    const createBody = {
      __metadata: { type: 'SP.List' },
      BaseTemplate: baseTemplate,
      Title: listTitle,
    };
    const res = await spFetch('/lists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;odata=verbose',
        Accept: 'application/json;odata=verbose',
      },
      body: JSON.stringify(createBody),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to create list "${listTitle}" (${res.status}): ${errText.slice(0, 300)}`);
    }
    const json = (await res.json().catch(() => ({}))) as SharePointListMetadata;
    const nested = json.d ?? {};
    const rawId =
      typeof json.Id === 'string' ? json.Id : typeof nested.Id === 'string' ? nested.Id : '';
    const rawTitle =
      typeof json.Title === 'string'
        ? json.Title
        : typeof nested.Title === 'string'
          ? nested.Title
          : '';
    ensured = {
      listId: trimGuidBraces(rawId),
      title: rawTitle || listTitle,
    };
  }

  if (options.preventPhysicalCreation === true && fields.length) {
    auditLog.warn('sp:fields', 'provisioning_blocked', { listTitle, reason: 'policy' });
    // Proceed to return ensuring list exists without adding fields
  }

  let isLimitReached = false;
  const failedFields: FailedFieldInfo[] = [];

  if (fields.length && !options.preventPhysicalCreation) {
    const existing = await fetchExistingFields(spFetch, listTitle);
    const available = new Set(existing.keys());

    for (const field of fields) {
      // 1. Exact match check
      const current = existing.get(field.internalName);
      if (current) {
        if (field.required && current.Required === false) {
          auditLog.warn('sp:fields', 'required_flag_mismatch', { field: field.internalName, currentRequired: current.Required });
        }
        continue;
      }

      // 2. Drift detection (Fuzzy check using candidates)
      const resolution = resolveInternalNamesDetailed(available, {
        [field.internalName]: field.candidates ? [...field.candidates] : [field.internalName]
      });

      const fieldResult = resolution.fieldStatus[field.internalName];
      if (fieldResult?.resolvedName) {
        // Drift detected! Use existing suffixed or truncated column instead of proliferating
        auditLog.warn('sp:fields', 'schema_drift_detected', {
          listTitle,
          expected: field.internalName,
          actual: fieldResult.resolvedName,
          driftType: fieldResult.driftType
        });
        continue;
      }

      const isRequired = Boolean(field.required || field.forceCreate);

      // 3. Physical creation (Only if truly unknown after drift check)
      if (!isRequired || isLimitReached) {
        auditLog.warn('sp:fields', 'provisioning_blocked', {
          listTitle,
          field: field.internalName,
          cause: isLimitReached ? 'row_limit' : 'optional_field',
        });
        if (isLimitReached && isRequired) {
          failedFields.push({
            internalName: field.internalName,
            required: true,
            reason: 'row_size_limit',
            detail: 'Skipped because a prior field in the same list hit the row-size limit.',
          });
        }
        continue;
      }

      const result = await addFieldToList(spFetch, listTitle, field);
      if (result.status === 'success') continue;

      if (result.status === 'limit_reached') {
        isLimitReached = true;
      }
      failedFields.push({
        internalName: field.internalName,
        required: isRequired,
        reason: result.reason ?? 'unknown',
        status: result.httpStatus,
        detail: result.detail,
      });
    }
  }

  const base = ensured ?? { listId: '', title: listTitle };
  return failedFields.length ? { ...base, failedFields } : base;
}
