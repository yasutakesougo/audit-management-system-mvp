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
import { evaluateQueryRisk, enforceQueryPolicy } from './queryGuard';
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
  const buildPath = (sel?: string[]) => {
    const params = new URLSearchParams();
    if (sel?.length) params.append('$select', sel.join(','));
    if (filter) params.append('$filter', filter);
    if (orderby) params.append('$orderby', orderby);
    params.append('$top', String(top));
    return `/lists/getbytitle('${encodeURIComponent(listTitle)}')/items?${params.toString()}`;
  };

  try {
    const res = await spFetch(buildPath(select), signal ? { signal } : undefined);
    const data = await res.json();
    return data.value || [];
  } catch (error) {
    // 400 (Bad Request) または 500 (Internal Server Error) の場合は列名のドリフトや行サイズ制限を疑い、再試行
    const spError = error as { status?: number; message?: string };
    const status = spError?.status;
    
    if (status === 400 || status === 500) {
      auditLog.warn('sp:read', `getListItemsByTitle fallback: retrying due to ${status}`, {
        listTitle,
        error: spError.message,
      });

      try {
        // まずは $select なしで試行 (SharePoint 側の自動解決に期待)
        const retryRes = await spFetch(buildPath(undefined), signal ? { signal } : undefined);
        const retryData = await retryRes.json();
        return retryData.value || [];
      } catch (retryError) {
        const spRetryError = retryError as { status?: number; message?: string };
        const retryStatus = spRetryError?.status;

        // 再試行も失敗なら、絶対に必要な最小限のシステム列のみで試行
        if (retryStatus === 400 || retryStatus === 500) {
          auditLog.error('sp:read', `getListItemsByTitle fallback: second retry with minimal fields due to ${retryStatus}`, {
            listTitle,
            error: spRetryError.message,
          });
          const minimalRes = await spFetch(
            buildPath(['Id', 'Title']),
            signal ? { signal } : undefined,
          );
          const minimalData = await minimalRes.json();
          return minimalData.value || [];
        }
        throw retryError;
      }
    }
    throw error;
  }
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
  
  // 1. Evaluate Query Risk
  const evaluation = evaluateQueryRisk({
    listName: listIdentifier,
    queryKind: 'list',
    top: options.top,
    select: options.select,
    expand: options.expand ? options.expand.split(',') : undefined,
    orderBy: options.orderby,
    filter: options.filter
  });

  // 2. Enforce Policy (Phase 1.5: log high risk, but don't strictly throw yet)
  const guardResult = enforceQueryPolicy(evaluation, {
    throwOnHighRisk: false 
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
      signal?.throwIfAborted();
      if (AUDIT_DEBUG) {
        auditLog.debug('sp:read', 'list_items_page', { path: nextPath });
      }
      attemptCount += 1;
      let res: Response;
      try {
        res = await spFetch(nextPath, signal ? { signal } : {});
      } catch (error) {
        // 400 (Bad Request) または 500 (Internal Server Error) の場合は列名のドリフトや行サイズ制限を疑う
        const spError = error as { status?: number; message?: string };
        const status = spError?.status;

        // すでに最小限のフィールドを取得している場合は再試行しない
        if ((status === 400 || status === 500) && (sanitized.select && sanitized.select.length > 2)) {
          auditLog.warn('sp:read', `listItems fallback: retrying with minimal fields due to ${status}`, {
            listIdentifier,
            error: spError.message,
          });

          // 最小限のフィールドで再構築
          const fallbackParams = new URLSearchParams();
          fallbackParams.append('$select', 'Id,Title');
          if (sanitized.filter) fallbackParams.append('$filter', sanitized.filter);
          fallbackParams.append('$top', String(sanitized.top));
          
          const fallbackPath = `${basePath}/items?${fallbackParams.toString()}`;
          res = await spFetch(fallbackPath, signal ? { signal } : {});
        } else {
          throw error;
        }
      }
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
