/**
 * SharePoint List — Write Operations (Create / Update / Delete)
 *
 * All functions accept `SpFetchFn` via explicit parameter injection.
 */

import { SharePointItemNotFoundError, SharePointMissingEtagError } from '@/lib/errors';

import { buildItemPath } from './helpers';
import type { SpFetchFn } from './spLists';

// ── Private helper: coerce Response to typed JSON ───────────────────────────

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

// ── Create ──────────────────────────────────────────────────────────────────

/**
 * Create a new item by list title (legacy name kept for backward compat).
 */
export async function addListItemByTitle<TBody extends object, TResult = unknown>(
  spFetch: SpFetchFn,
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
export async function createItem<TBody extends object, TResult = unknown>(
  spFetch: SpFetchFn,
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

// ── Update ──────────────────────────────────────────────────────────────────

/**
 * Low-level PATCH (actually POST + X-HTTP-Method: MERGE for SPO stability).
 * Handles ETag conflict retry automatically.
 */
export async function patchListItem<TBody extends object>(
  spFetch: SpFetchFn,
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
export async function updateItemByTitle<TBody extends object, TResult = unknown>(
  spFetch: SpFetchFn,
  listTitle: string,
  id: number,
  body: TBody,
  options?: { ifMatch?: string },
): Promise<TResult> {
  const res = await patchListItem<TBody>(spFetch, listTitle, id, body, options?.ifMatch);
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
  options?: { ifMatch?: string },
): Promise<TResult> {
  const res = await patchListItem<TBody>(spFetch, listIdentifier, id, body, options?.ifMatch);
  return coerceResult<TResult>(res);
}

// ── Delete ──────────────────────────────────────────────────────────────────

/**
 * Delete an item by list title.
 */
export async function deleteItemByTitle(
  spFetch: SpFetchFn,
  listTitle: string,
  id: number,
): Promise<void> {
  const path = buildItemPath(listTitle, id);
  await spFetch(path, {
    method: 'DELETE',
    headers: { 'If-Match': '*' },
  });
}

/**
 * Delete an item (generic — resolves list by title or GUID).
 */
export async function deleteItem(
  spFetch: SpFetchFn,
  listIdentifier: string,
  id: number,
): Promise<void> {
  const path = buildItemPath(listIdentifier, id);
  await spFetch(path, {
    method: 'DELETE',
    headers: { 'If-Match': '*' },
  });
}
