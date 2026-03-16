/**
 * graphFetch — Microsoft Graph API 専用の最下層 fetch クライアント
 *
 * ## 責務
 * - アクセストークン付与 (`Authorization: Bearer ...`)
 * - `Accept: application/json` ヘッダー
 * - 429 / 5xx の限定リトライ（Retry-After ヘッダー対応）
 * - 401 / 403 / 404 / 409 のエラー整形
 * - JSON レスポンスの標準処理
 *
 * ## 責務外
 * - UI通知（toast等）
 * - 業務判断
 * - 画面固有のメッセージ文言
 * - Graph 上位APIの意味解釈
 *
 * @example
 * ```ts
 * const client = createGraphClient(() => getToken());
 * const me = await client.fetchJson<{ displayName: string }>('/me');
 * const groups = await client.fetchAllPages<{ id: string }>('/me/memberOf?$select=id');
 * ```
 */

import { getAppConfig } from '@/lib/env';
import { startFetchSpan } from '@/telemetry/fetchSpan';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export type GetToken = () => Promise<string | null>;

export type GraphFetchOptions = {
  /** 追加ヘッダー（Prefer 等） */
  headers?: Record<string, string>;
  /** HTTP メソッド（デフォルト GET） */
  method?: string;
  /** リクエストボディ（POST/PATCH 用） */
  body?: BodyInit;
  /** AbortSignal */
  signal?: AbortSignal;
  /** 個別にリトライ上限を上書き（デフォルトは env の graphRetryMax） */
  retryMax?: number;
};

export class GraphApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: string;

  constructor(status: number, statusText: string, body: string) {
    super(`Graph API ${status}: ${body.slice(0, 300)}`);
    this.name = 'GraphApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export class GraphAuthError extends Error {
  constructor(message = 'Graph API token is not available') {
    super(message);
    this.name = 'GraphAuthError';
  }
}

// ---------------------------------------------------------------------------
// OData ページネーション型
// ---------------------------------------------------------------------------

type ODataPage<T> = {
  value?: T[];
  '@odata.nextLink'?: string;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) =>
  ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

const parseRetryAfter = (value: string | null): number | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const absolute = Date.parse(trimmed);
  if (!Number.isNaN(absolute)) {
    const delta = absolute - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
};

const readRetryAfter = (response: Response): string | null => {
  try {
    return response.headers?.get?.('retry-after') ?? null;
  } catch {
    return null;
  }
};

const computeDelay = (
  attempt: number,
  retryAfter: string | null,
  retryBase: number,
  retryCap: number,
): number => {
  const headerDelay = parseRetryAfter(retryAfter);
  if (headerDelay !== null) {
    const desired = headerDelay < retryBase ? retryBase : headerDelay;
    return retryCap > 0 ? Math.min(retryCap, desired) : desired;
  }
  if (retryBase <= 0) return 0;
  const backoff = retryBase * Math.pow(2, attempt);
  return retryCap > 0 ? Math.min(retryCap, backoff) : backoff;
};

const isRetryable = (status: number): boolean =>
  status === 429 || (status >= 500 && status < 600);

const isAbortError = (e: unknown): e is DOMException =>
  e instanceof DOMException && e.name === 'AbortError';

// ---------------------------------------------------------------------------
// resolveUrl: Graph 相対パスを絶対 URL に解決
// ---------------------------------------------------------------------------

const resolveUrl = (path: string): string => {
  if (path.startsWith('https://')) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${GRAPH_BASE}${normalizedPath}`;
};

// ---------------------------------------------------------------------------
// createGraphClient
// ---------------------------------------------------------------------------

export type GraphClient = {
  /**
   * Graph API に fetch し、Response をそのまま返す。
   * リトライ・認証ヘッダー付与済み。
   */
  fetchRaw: (path: string, options?: GraphFetchOptions) => Promise<Response>;

  /**
   * Graph API に fetch し、JSON パースして返す。
   * リトライ・認証ヘッダー・Accept: application/json 付与済み。
   */
  fetchJson: <T>(path: string, options?: GraphFetchOptions) => Promise<T>;

  /**
   * OData ページネーションを自動走査して全件取得。
   * `@odata.nextLink` を自動追跡する。
   */
  fetchAllPages: <T>(path: string, options?: Omit<GraphFetchOptions, 'method' | 'body'>) => Promise<T[]>;
};

export const createGraphClient = (getToken: GetToken): GraphClient => {
  const config = getAppConfig();
  const retryMaxDefault = Math.max(0, config.graphRetryMax);
  const retryBase = Math.max(0, config.graphRetryBaseMs);
  const retryCap = Math.max(retryBase, config.graphRetryCapMs);

  const fetchRaw = async (
    path: string,
    options: GraphFetchOptions = {},
  ): Promise<Response> => {
    const token = await getToken();
    if (!token) {
      throw new GraphAuthError();
    }

    const method = (options.method ?? 'GET').toUpperCase();
    const url = resolveUrl(path);
    const retryMax = options.retryMax ?? retryMaxDefault;
    const mergedHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...options.headers,
    };

    const span = startFetchSpan({ layer: 'graph', method, path });
    let attempt = 0;

    while (attempt <= retryMax) {
      let response: Response;
      try {
        // eslint-disable-next-line no-restricted-globals -- graphFetch SSOT: Graph API 最下層の唯一の出口
        response = await fetch(url, {
          method,
          headers: mergedHeaders,
          body: options.body,
          signal: options.signal,
        });
      } catch (e) {
        if (isAbortError(e)) {
          span.error('AbortError', attempt);
          throw e;
        }
        // ネットワーク障害 — リトライ可能なら続行
        if (attempt < retryMax) {
          const delay = computeDelay(attempt, null, retryBase, retryCap);
          attempt += 1;
          await sleep(delay);
          continue;
        }
        span.error(e instanceof Error ? e.name : 'NetworkError', attempt);
        throw e;
      }

      if (response.ok) {
        span.succeed(response.status, attempt);
        return response;
      }

      // リトライ不可 or 最終試行
      if (!isRetryable(response.status) || attempt >= retryMax) {
        const body = await response.text().catch(() => '');
        span.fail(response.status, 'GraphApiError', attempt);
        throw new GraphApiError(response.status, response.statusText, body);
      }

      const delay = computeDelay(attempt, readRetryAfter(response), retryBase, retryCap);
      attempt += 1;
      if (delay > 0) {
        await sleep(delay);
      }
    }

    // ここには到達しないが TypeScript の型を満たすため
    span.fail(0, 'MaxRetries');
    throw new GraphApiError(0, 'MaxRetries', 'Maximum retry attempts exceeded');
  };

  const fetchJson = async <T>(
    path: string,
    options: GraphFetchOptions = {},
  ): Promise<T> => {
    const response = await fetchRaw(path, options);
    return (await response.json()) as T;
  };

  const fetchAllPages = async <T>(
    path: string,
    options: Omit<GraphFetchOptions, 'method' | 'body'> = {},
  ): Promise<T[]> => {
    const items: T[] = [];
    let nextUrl: string | undefined = resolveUrl(path);

    while (nextUrl) {
      const page: ODataPage<T> = await fetchJson<ODataPage<T>>(nextUrl, options);
      if (Array.isArray(page.value)) {
        items.push(...page.value);
      }
      nextUrl = page['@odata.nextLink'];
    }

    return items;
  };

  return { fetchRaw, fetchJson, fetchAllPages };
};
