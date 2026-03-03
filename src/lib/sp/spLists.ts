/**
 * SharePoint Client — List CRUD Operations
 * Extracted from spClient.ts for single-responsibility.
 *
 * All functions are factory-style closures that accept a `SpFetchFn`
 * (the authenticated fetch wrapper) and `normalizePath` from the
 * client core, so they can be wired in without circular deps.
 */

import { readEnv } from '@/lib/env';
import { SharePointItemNotFoundError, SharePointMissingEtagError } from '@/lib/errors';

import {
    buildItemPath,
    FIELDS_CACHE_TTL_MS,
    makeFieldsCacheKey,
    nowMs,
    resolveListPath,
    safeJsonParse,
    safeJsonStringify,
} from './spHelpers';
import { buildFieldSchema, trimGuidBraces } from './spSchema';
import type {
    EnsureListOptions,
    EnsureListResult,
    ExistingFieldShape,
    FieldsCacheEntry,
    JsonRecord,
    ListItemsOptions,
    SharePointListMetadata,
    SpFieldDef,
} from './spTypes';

// ── Dependency interfaces ──────────────────────────────────────────────────
// These thin signatures decouple list operations from the full spClient.

/** Authenticated fetch wrapper returned by `createSpClient`. */
export type SpFetchFn = (path: string, init?: RequestInit) => Promise<Response>;

/** Path normalizer from spClient core. */
export type NormalizePathFn = (value: string) => string;

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_LIST_TEMPLATE = 100;

// ── Response coercion (private helper) ─────────────────────────────────────

/**
 * Safely extract a typed JSON body from a Response.
 * Handles 204 No-Content, empty bodies, and non-JSON content types.
 */
async function coerceResult<TResult>(res: Response): Promise<TResult> {
  if (res.status === 204) {
    return undefined as unknown as TResult;
  }
  const contentLength = res.headers.get('Content-Length');
  if (contentLength === '0') {
    return undefined as unknown as TResult;
  }
  const contentType = res.headers.get('Content-Type') ?? '';
  if (!/json/i.test(contentType)) {
    return undefined as unknown as TResult;
  }
  const text = await res.text();
  if (!text) {
    return undefined as unknown as TResult;
  }
  try {
    return JSON.parse(text) as TResult;
  } catch {
    return undefined as unknown as TResult;
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Create list-level CRUD helpers bound to an authenticated `spFetch` wrapper.
 *
 * @example
 * ```ts
 * const lists = createListOperations(spFetch, normalizePath, baseUrl);
 * const items = await lists.listItems('MyList', { top: 50 });
 * ```
 */
export function createListOperations(
  spFetch: SpFetchFn,
  normalizePath: NormalizePathFn,
  baseUrl: string,
) {
  // ── Read ────────────────────────────────────────────────────────────────

  /**
   * Fetch all items from a list by its display title (legacy API).
   * Prefer `listItems` for new code — it supports GUID identifiers and paging.
   */
  async function getListItemsByTitle<T>(
    listTitle: string,
    select?: string[],
    filter?: string,
    orderby?: string,
    top: number = 500,
    signal?: AbortSignal,
  ): Promise<T[]> {
    const params = new URLSearchParams();
    if (select?.length) params.append('$select', select.join(','));
    if (filter) params.append('$filter', filter);
    if (orderby) params.append('$orderby', orderby);
    params.append('$top', String(top));
    const path = `/lists/getbytitle('${encodeURIComponent(listTitle)}')/items?${params.toString()}`;
    const res = await spFetch(path, signal ? { signal } : undefined);
    const data = await res.json();
    return data.value || [];
  }

  /**
   * Paginated item fetcher with support for GUID & title identifiers,
   * `$expand`, `$orderby`, `$filter`, and a page cap.
   */
  async function listItems<TRow = JsonRecord>(
    listIdentifier: string,
    options: ListItemsOptions = {},
  ): Promise<TRow[]> {
    const { select, filter, orderby, expand, top = 100, pageCap, signal } = options;
    const params = new URLSearchParams();
    if (select?.length) params.append('$select', select.join(','));
    if (filter) params.append('$filter', filter);
    if (orderby) params.append('$orderby', orderby);
    if (expand) params.append('$expand', expand);
    params.append('$top', String(top));

    const basePath = resolveListPath(listIdentifier);
    const query = params.toString();
    const initialPath = query ? `${basePath}/items?${query}` : `${basePath}/items`;

    const AUDIT_DEBUG = String(readEnv('VITE_AUDIT_DEBUG', '')) === '1';
    if (AUDIT_DEBUG) {
      console.log('[spLists.listItems] 🚀 initialPath=', initialPath);
    }

    const rows: TRow[] = [];
    let nextPath: string | null = initialPath;
    let pages = 0;
    const maxPages =
      typeof pageCap === 'number' && pageCap > 0
        ? Math.floor(pageCap)
        : Number.POSITIVE_INFINITY;

    while (nextPath && pages < maxPages) {
      if (AUDIT_DEBUG) {
        console.log('[spLists.listItems] 📡 spFetch call with path=', nextPath);
      }
      const res = await spFetch(nextPath, signal ? { signal } : {});
      const payload = (await res.json().catch(() => ({}) as Record<string, unknown>)) as {
        value?: unknown[];
        '@odata.nextLink'?: string;
        nextLink?: string;
      };
      const batch = (Array.isArray(payload.value) ? payload.value : []) as TRow[];
      rows.push(...batch);
      pages += 1;

      const nextLinkRaw =
        typeof payload['@odata.nextLink'] === 'string'
          ? payload['@odata.nextLink']
          : typeof payload.nextLink === 'string'
            ? payload.nextLink
            : null;
      if (!nextLinkRaw) {
        nextPath = null;
        continue;
      }
      nextPath = normalizePath(nextLinkRaw);
    }

    return rows;
  }

  /**
   * Fetch a single item by numeric ID.
   */
  async function getItemById<T>(
    listTitle: string,
    id: number,
    select: string[] = [],
    signal?: AbortSignal,
  ): Promise<T> {
    const path = buildItemPath(listTitle, id, select);
    const res = await spFetch(path, signal ? { signal } : undefined);
    return (await res.json()) as T;
  }

  /**
   * Fetch a single item by numeric ID together with its ETag (for optimistic concurrency).
   */
  async function getItemByIdWithEtag<T>(
    listTitle: string,
    id: number,
    select: string[] = [],
    signal?: AbortSignal,
  ): Promise<{ item: T; etag: string | null }> {
    const path = buildItemPath(listTitle, id, select);
    const res = await spFetch(path, signal ? { signal } : undefined);
    const item = (await res.json()) as T;
    const etag = res.headers.get('ETag');
    return { item, etag };
  }

  // ── Create ──────────────────────────────────────────────────────────────

  /**
   * Create a new item by list title (legacy name kept for backward compat).
   */
  async function addListItemByTitle<TBody extends object, TResult = unknown>(
    listTitle: string,
    body: TBody,
  ): Promise<TResult> {
    const path = `/lists/getbytitle('${encodeURIComponent(listTitle)}')/items`;
    const res = await spFetch(path, { method: 'POST', body: JSON.stringify(body) });
    return (await res.json()) as TResult;
  }

  /**
   * Create a new item (generic — resolves list by title or GUID).
   */
  async function createItem<TBody extends object, TResult = unknown>(
    listTitle: string,
    body: TBody,
  ): Promise<TResult> {
    const path = buildItemPath(listTitle);
    const res = await spFetch(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return coerceResult<TResult>(res);
  }

  // ── Update ──────────────────────────────────────────────────────────────

  /**
   * Low-level PATCH (actually POST + X-HTTP-Method: MERGE for SPO stability).
   * Handles ETag conflict retry automatically.
   */
  async function patchListItem<TBody extends object>(
    listIdentifier: string,
    id: number,
    body: TBody,
    ifMatch?: string,
  ): Promise<Response> {
    const itemPath = buildItemPath(listIdentifier, id);
    const payload = JSON.stringify(body);

    const attempt = async (etag: string | undefined): Promise<Response | null> => {
      try {
        return await spFetch(itemPath, {
          method: 'POST',
          headers: {
            Accept: 'application/json;odata=nometadata',
            'X-HTTP-Method': 'MERGE',
            'If-Match': etag ?? '*',
            'OData-Version': '4.0',
            'Content-Type': 'application/json;odata=nometadata',
          },
          body: payload,
        });
      } catch (error) {
        if ((error as { status?: number }).status === 412) {
          return null;
        }
        throw error;
      }
    };

    const first = await attempt(ifMatch);
    if (first) return first;

    // 412 Precondition Failed — refresh ETag and retry once
    let latest: Response;
    try {
      latest = await spFetch(buildItemPath(listIdentifier, id, ['Id']), { method: 'GET' });
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        throw new SharePointItemNotFoundError();
      }
      throw error;
    }
    const refreshedEtag = latest.headers.get('ETag');
    if (!refreshedEtag) {
      throw new SharePointMissingEtagError();
    }

    const second = await attempt(refreshedEtag);
    if (second) return second;
    throw new SharePointMissingEtagError('SharePoint returned 412 after refreshing ETag');
  }

  /**
   * Update an item by list title (returns parsed result).
   */
  async function updateItemByTitle<TBody extends object, TResult = unknown>(
    listTitle: string,
    id: number,
    body: TBody,
    options?: { ifMatch?: string },
  ): Promise<TResult> {
    const res = await patchListItem<TBody>(listTitle, id, body, options?.ifMatch);
    return coerceResult<TResult>(res);
  }

  /**
   * Update an item (generic — resolves list by title or GUID).
   */
  async function updateItem<TBody extends object, TResult = unknown>(
    listIdentifier: string,
    id: number,
    body: TBody,
    options?: { ifMatch?: string },
  ): Promise<TResult> {
    const res = await patchListItem<TBody>(listIdentifier, id, body, options?.ifMatch);
    return coerceResult<TResult>(res);
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  /**
   * Delete an item by list title.
   */
  async function deleteItemByTitle(listTitle: string, id: number): Promise<void> {
    const path = buildItemPath(listTitle, id);
    await spFetch(path, {
      method: 'DELETE',
      headers: { 'If-Match': '*' },
    });
  }

  /**
   * Delete an item (generic — resolves list by title or GUID).
   */
  async function deleteItem(listIdentifier: string, id: number): Promise<void> {
    const path = buildItemPath(listIdentifier, id);
    await spFetch(path, {
      method: 'DELETE',
      headers: { 'If-Match': '*' },
    });
  }

  // ── List metadata / schema ──────────────────────────────────────────────

  /**
   * Attempt to fetch list metadata. Returns `null` if the list does not exist (404).
   */
  async function tryGetListMetadata(listTitle: string): Promise<EnsureListResult | null> {
    const encoded = encodeURIComponent(listTitle);
    const path = `/lists/getbytitle('${encoded}')?$select=Id,Title`;
    try {
      const res = await spFetch(path);
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

  /**
   * Fetch the full field schema of a list (InternalName, TypeAsString, Required).
   */
  async function fetchExistingFields(
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
  async function getListFieldInternalNames(listTitle: string): Promise<Set<string>> {
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
            console.log('[spLists][fieldsCache] ✅ hit', {
              listTitle,
              count: cached.internalNames.length,
              ageMs: age,
            });
          }
          return new Set(cached.internalNames);
        }

        // Stale / invalid → drop
        if (debug) {
          console.log('[spLists][fieldsCache] ⏰ stale/invalid -> drop', {
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
            console.log('[spLists][fieldsCache] 💾 save', { listTitle, count: names.size });
          }
        }
      } else if (debug && names.size === 0) {
        console.log('[spLists][fieldsCache] ⚠️ fetched empty (not cached)', { listTitle });
      }

      return names;
    } catch (e) {
      // 4) On failure, do not leave stale cache
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(cacheKey);
      }
      if (debug) {
        console.warn('[spLists][fieldsCache] ❌ fetch failed', { listTitle, error: e });
      }
      throw e;
    }
  }

  /**
   * Add a single field to a list using the CreateFieldAsXml endpoint.
   */
  async function addFieldToList(listTitle: string, field: SpFieldDef): Promise<void> {
    const encoded = encodeURIComponent(listTitle);
    const schema = buildFieldSchema(field);
    const body = {
      parameters: {
        SchemaXml: schema,
        AddToDefaultView: field.addToDefaultView ?? false,
      },
    };
    await spFetch(`/lists/getbytitle('${encoded}')/fields/createfieldasxml`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Ensure a list exists with the given fields.
   * Creates the list if absent, then reconciles field definitions.
   */
  async function ensureListExists(
    listTitle: string,
    fields: SpFieldDef[],
    options: EnsureListOptions = {},
  ): Promise<EnsureListResult> {
    const baseTemplate = options.baseTemplate ?? DEFAULT_LIST_TEMPLATE;

    let ensured = await tryGetListMetadata(listTitle);
    if (!ensured) {
      const createBody = {
        __metadata: { type: 'SP.List' },
        BaseTemplate: baseTemplate,
        Title: listTitle,
      };
      const res = await spFetch('/lists', { method: 'POST', body: JSON.stringify(createBody) });
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
      const existing = await fetchExistingFields(listTitle);
      for (const field of fields) {
        const current = existing.get(field.internalName);
        if (current) {
          if (field.required && current.Required === false) {
            const currentLabel = current.Required ? 'TRUE' : 'FALSE';
            console.warn(
              `[spLists] Field "${field.internalName}" required flag differs (current=${currentLabel}).`,
            );
          }
          continue;
        }
        await addFieldToList(listTitle, field);
      }
    }

    return ensured ?? { listId: '', title: listTitle };
  }

  // ── Public API ──────────────────────────────────────────────────────────

  return {
    // Read
    getListItemsByTitle,
    listItems,
    getItemById,
    getItemByIdWithEtag,
    // Create
    addListItemByTitle,
    /** @deprecated Use `addListItemByTitle`. Kept for backward compatibility. */
    addItemByTitle: addListItemByTitle,
    createItem,
    // Update
    patchListItem,
    updateItemByTitle,
    updateItem,
    // Delete
    deleteItemByTitle,
    deleteItem,
    // List schema / metadata
    tryGetListMetadata,
    fetchExistingFields,
    getListFieldInternalNames,
    addFieldToList,
    ensureListExists,
  };
}

// ── Re-export factory return type for external typing ──────────────────────

export type SpListOperations = ReturnType<typeof createListOperations>;
