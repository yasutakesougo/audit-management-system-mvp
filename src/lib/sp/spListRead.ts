/**
 * SharePoint List — Read Operations
 *
 * Paginated / single-item read helpers.
 * All functions accept `SpFetchFn` + `NormalizePathFn` via closure injection.
 */

import { auditLog } from '@/lib/debugLogger';
import { readEnv } from '@/lib/env';

import { buildItemPath, resolveListPath } from './helpers';
import type { NormalizePathFn, SpFetchFn } from './spLists';
import type { JsonRecord, ListItemsOptions } from './types';
import { guardSharePointQuery } from './queryGuard';
import { beginSpQueryTelemetry, endSpQueryTelemetry } from './telemetry';

// ── Read helpers ────────────────────────────────────────────────────────────

/**
 * Fetch all items from a list by its display title (legacy API).
 * Prefer `listItems` for new code — it supports GUID identifiers and paging.
 */
export async function getListItemsByTitle<T>(
  spFetch: SpFetchFn,
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
export async function listItems<TRow = JsonRecord>(
  spFetch: SpFetchFn,
  normalizePath: NormalizePathFn,
  listIdentifier: string,
  options: ListItemsOptions = {},
): Promise<TRow[]> {
  const { pageCap, signal } = options;
  
  // 1. Guard Query
  const guardResult = guardSharePointQuery({
    listName: listIdentifier,
    queryKind: 'list',
    top: options.top,
    select: options.select,
    expand: options.expand ? options.expand.split(',') : undefined,
    orderBy: options.orderby,
    filter: options.filter
  });

  const sanitized = guardResult.sanitized;
  const telemetryPayload = beginSpQueryTelemetry(sanitized, guardResult.riskLevel, guardResult.warningCodes);

  const params = new URLSearchParams();
  if (sanitized.select?.length) params.append('$select', sanitized.select.join(','));
  if (sanitized.filter) params.append('$filter', sanitized.filter);
  if (sanitized.orderBy) params.append('$orderby', sanitized.orderBy);
  if (sanitized.expand?.length) params.append('$expand', sanitized.expand.join(','));
  params.append('$top', String(sanitized.top));

  const basePath = resolveListPath(listIdentifier);
  const query = params.toString();
  const initialPath = query ? `${basePath}/items?${query}` : `${basePath}/items`;

  const AUDIT_DEBUG = String(readEnv('VITE_AUDIT_DEBUG', '')) === '1';
  if (AUDIT_DEBUG) {
    auditLog.debug('sp:read', 'list_items_start', { path: initialPath });
  }

  const rows: TRow[] = [];
  let nextPath: string | null = initialPath;
  let pages = 0;
  const maxPages =
    typeof pageCap === 'number' && pageCap > 0
      ? Math.floor(pageCap)
      : Number.POSITIVE_INFINITY;

  let finalResponse: Response | undefined;
  let finalError: Error | unknown;
  let attemptCount = 0; // spFetch actually retries internally, this just shows higher level req count

  try {
    while (nextPath && pages < maxPages) {
      if (AUDIT_DEBUG) {
        auditLog.debug('sp:read', 'list_items_page', { path: nextPath });
      }
      attemptCount += 1;
      const res = await spFetch(nextPath, signal ? { signal } : {});
      finalResponse = res;
      
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
  } catch (err) {
    finalError = err;
    throw err;
  } finally {
    // 2. End Telemetry
    endSpQueryTelemetry({
      payload: telemetryPayload,
      response: finalResponse,
      error: finalError,
      retryCount: Math.max(0, attemptCount - 1), 
      resultCount: rows.length
    });
  }

  return rows;
}

/**
 * Fetch a single item by numeric ID.
 */
export async function getItemById<T>(
  spFetch: SpFetchFn,
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
export async function getItemByIdWithEtag<T>(
  spFetch: SpFetchFn,
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
