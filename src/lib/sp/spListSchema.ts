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
    safeJsonParse,
    safeJsonStringify
} from './helpers';
import type { SpFetchFn } from './spLists';
import { buildFieldSchema, trimGuidBraces } from './spSchema';
import type {
    EnsureListOptions,
    EnsureListResult,
    ExistingFieldShape,
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
): Promise<EnsureListResult | null> {
  const encoded = encodeURIComponent(listTitle);
  const path = `/lists/getbytitle('${encoded}')?$select=Id,Title`;
  try {
    const res = await spFetch(path);
    // 404 or other non-ok → list does not exist
    if (!res.ok) {
      return null;
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
    return {
      listId: trimGuidBraces(rawId),
      title: rawTitle || listTitle,
    };
  } catch (error) {
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

// ── Field schema ────────────────────────────────────────────────────────────

/**
 * Fetch the full field schema of a list (InternalName, TypeAsString, Required).
 */
export async function fetchExistingFields(
  spFetch: SpFetchFn,
  listTitle: string,
): Promise<Map<string, ExistingFieldShape>> {
  const encoded = encodeURIComponent(listTitle);
  const path = `/lists/getbytitle('${encoded}')/fields?$select=InternalName,TypeAsString,Required`;
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
  const encoded = encodeURIComponent(listTitle);
  const path = `/lists/getbytitle('${encoded}')/fields?$select=InternalName&$top=500`;

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
 * Add a single field to a list using the CreateFieldAsXml endpoint.
 */
export async function addFieldToList(
  spFetch: SpFetchFn,
  listTitle: string,
  field: SpFieldDef,
): Promise<void> {
  const encoded = encodeURIComponent(listTitle);
  const schema = buildFieldSchema(field);
  const body = {
    parameters: {
      __metadata: { type: 'SP.XmlSchemaFieldCreationInformation' },
      SchemaXml: schema,
      Options: field.addToDefaultView ? 8 : 0,
    },
  };
  const res = await spFetch(`/lists/getbytitle('${encoded}')/fields/createfieldasxml`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;odata=verbose',
      Accept: 'application/json;odata=verbose',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.warn(
      `[addFieldToList] Failed to add "${field.internalName}" to "${listTitle}" (${res.status}): ${errText.slice(0, 300)}`,
    );
    // Do not throw — continue adding remaining fields
    return;
  }
}

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

  if (fields.length) {
    const existing = await fetchExistingFields(spFetch, listTitle);
    for (const field of fields) {
      const current = existing.get(field.internalName);
      if (current) {
        if (field.required && current.Required === false) {
          auditLog.warn('sp:fields', 'required_flag_mismatch', { field: field.internalName, currentRequired: current.Required });
        }
        continue;
      }
      await addFieldToList(spFetch, listTitle, field);
    }
  }

  return ensured ?? { listId: '', title: listTitle };
}
