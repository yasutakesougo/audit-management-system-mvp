import { buildItemPath, coerceResult, resolveListPath } from './helpers';
import { SharePointItemNotFoundError, SharePointMissingEtagError } from '@/lib/errors';
import type { SpFetchFn } from './spLists';

/**
 * Patch an item (MERGE) — returns the Response.
 * Implements a single retry on 412 Precondition Failed to handle ETag conflicts.
 */
export async function patchListItem<TBody extends object>(
  spFetch: SpFetchFn,
  listIdentifier: string,
  id: number,
  body: TBody,
  ifMatch?: string,
  options?: { signal?: AbortSignal; spOptions?: import('./types').SpRequestOptions },
): Promise<Response> {
  const signal = options?.signal;
  const spOptions = options?.spOptions;
  const itemPath = buildItemPath(listIdentifier, id);
  const payload = JSON.stringify(body);

  try {
    // Attempt 1: Try with provided (or star) ETag
    return await spFetch(itemPath, {
      method: 'POST',
      headers: {
        Accept: 'application/json;odata=nometadata',
        'OData-Version': '3.0',
        'X-HTTP-Method': 'MERGE',
        'If-Match': ifMatch ?? '*',
        'Content-Type': 'application/json;odata=nometadata',
      },
      body: payload,
      signal,
      spOptions: { ...spOptions, skipRetry: true },
    });
  } catch (err) {
    // If NOT a 412 conflict, rethrow immediately
    const error = err as { status?: number };
    if (error.status !== 412) throw err;

    // Conflict detected: Refresh the ETag via GET
    let latestResponse: Response;
    try {
      latestResponse = await spFetch(buildItemPath(listIdentifier, id, ['Id']), { method: 'GET', signal });
    } catch (refreshErr) {
      // If item was deleted between Attempt 1 and refresh, 404 is valid
      if ((refreshErr as { status?: number }).status === 404) throw new SharePointItemNotFoundError();
      throw refreshErr;
    }

    const refreshedEtag = latestResponse.headers.get('ETag');
    if (!refreshedEtag) {
      throw new SharePointMissingEtagError();
    }

    // Attempt 2: Retry with the fresh ETag
    try {
      return await spFetch(itemPath, {
        method: 'POST',
        headers: {
          Accept: 'application/json;odata=nometadata',
          'OData-Version': '3.0',
          'X-HTTP-Method': 'MERGE',
          'If-Match': refreshedEtag,
          'Content-Type': 'application/json;odata=nometadata',
        },
        body: payload,
        signal,
        spOptions,
      });
    } catch (secondErr) {
      // If it STILL fails with 412, don't infinite retry — throw specialized error
      if ((secondErr as { status?: number }).status === 412) {
        throw new SharePointMissingEtagError('SharePoint returned 412 after refreshing ETag');
      }
      throw secondErr;
    }
  }
}

/**
 * Update an item by list title (returns parsed result).
 */
export async function updateItemByTitle<TBody extends object, TResult = unknown>(
  spFetch: SpFetchFn,
  listTitle: string,
  id: number,
  body: TBody,
  options?: import('./types').UpdateItemOptions,
): Promise<TResult> {
  const res = await patchListItem<TBody>(spFetch, listTitle, id, body, options?.ifMatch, options);
  return coerceResult<TResult>(res);
}

/**
 * Update an item (generic — resolves list by title or GUID).
 */
export async function updateItem<TBody extends object, TResult = unknown>(
  spFetch: SpFetchFn,
  listIdentifier: string,
  id: number,
  body: TBody,
  options?: import('./types').UpdateItemOptions,
): Promise<TResult> {
  const res = await patchListItem<TBody>(spFetch, listIdentifier, id, body, options?.ifMatch, options);
  return coerceResult<TResult>(res);
}

/**
 * Update a field metadata (e.g. for Indexing).
 */
export async function updateField(
  spFetch: SpFetchFn,
  listTitle: string,
  fieldInternalName: string,
  properties: Record<string, unknown>,
  options?: import('./types').WriteItemOptions
): Promise<void> {
  const path = `${resolveListPath(listTitle)}/fields/getbyinternalnameortitle('${fieldInternalName}')`;
  await spFetch(path, {
    method: 'POST',
    headers: {
      'X-HTTP-Method': 'MERGE',
      'Content-Type': 'application/json;odata=nometadata',
    },
    body: JSON.stringify(properties),
    signal: options?.signal,
    spOptions: options?.spOptions,
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────

export async function deleteItemByTitle(
  spFetch: SpFetchFn,
  listTitle: string,
  id: number,
  options?: import('./types').WriteItemOptions,
): Promise<void> {
  const path = buildItemPath(listTitle, id);
  await spFetch(path, {
    method: 'DELETE',
    headers: { 'If-Match': '*' },
    signal: options?.signal,
    spOptions: options?.spOptions,
  });
}

export async function deleteItem(
  spFetch: SpFetchFn,
  listIdentifier: string,
  id: number,
  options?: import('./types').WriteItemOptions,
): Promise<void> {
  const path = buildItemPath(listIdentifier, id);
  await spFetch(path, {
    method: 'DELETE',
    headers: { 'If-Match': '*' },
    signal: options?.signal,
    spOptions: options?.spOptions,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function addListItemByTitle<TBody extends object, TResult = unknown>(
  spFetch: SpFetchFn,
  listTitle: string,
  body: TBody,
  options?: import('./types').WriteItemOptions,
): Promise<TResult> {
  const path = `/lists/getbytitle('${listTitle}')/items`;
  const res = await spFetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;odata=nometadata',
    },
    body: JSON.stringify(body),
    signal: options?.signal,
    spOptions: options?.spOptions,
  });
  return coerceResult<TResult>(res);
}

export async function createItem<TBody extends object, TResult = unknown>(
  spFetch: SpFetchFn,
  listIdentifier: string,
  body: TBody,
  options?: import('./types').WriteItemOptions,
): Promise<TResult> {
  const path = `${resolveListPath(listIdentifier)}/items`;
  const res = await spFetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;odata=nometadata',
    },
    body: JSON.stringify(body),
    signal: options?.signal,
    spOptions: options?.spOptions,
  });
  return coerceResult<TResult>(res);
}
