/** SharePoint write (resilient) returning Result type */
export type WithStatusError = Error & { status?: number; code?: string; response?: Response };

export type SpWriteError = WithStatusError;

export type SpWriteResult<T = unknown> =
  | { ok: true; status: number; data?: T; etag?: string; raw: Response }
  | { ok: false; status?: number; statusText?: string; error: SpWriteError; raw?: Response };

export interface SpWriteOptions<T = unknown> {
  list: string;
  method: 'POST' | 'PATCH' | 'DELETE' | 'MERGE';
  fetcher: (path: string, init?: RequestInit) => Promise<Response>;
  itemId?: number;
  body?: Record<string, unknown> | null;
  ifMatch?: string;
  additionalHeaders?: Record<string, string>;
  urlBuilder?: (list: string, itemId?: number) => string;
  parse?: (response: Response) => Promise<T>;
  retries?: number;
}

const isTransient = (status: number): boolean => status === 429 || status === 503 || status === 504;

const defaultUrlBuilder = (list: string, itemId?: number): string => {
  const encoded = encodeURIComponent(list);
  if (typeof itemId === 'number') {
    return `/lists/getbytitle('${encoded}')/items(${itemId})`;
  }
  return `/lists/getbytitle('${encoded}')/items`;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

const buildErrorResult = (response: Response | undefined, message?: string): SpWriteResult<never> => {
  const status = response?.status;
  const error: SpWriteError = Object.assign(
    new Error(message ?? (status ? `SharePoint write failed (${status})` : 'SharePoint write failed')),
    {
      status,
      code: status ? String(status) : undefined,
      response,
    },
  );
  return {
    ok: false,
    status,
    statusText: response?.statusText,
    error,
    raw: response,
  };
};

export async function spWriteResilient<T = unknown>(options: SpWriteOptions<T>): Promise<SpWriteResult<T>> {
  const {
    list,
    method,
    fetcher,
    itemId,
    body,
    ifMatch,
    additionalHeaders,
    urlBuilder = defaultUrlBuilder,
    parse,
    retries = 1,
  } = options;

  if (typeof fetcher !== 'function') {
    throw new Error('SharePoint fetcher is required');
  }

  const totalRetries = Math.max(0, retries);
  let attempt = 0;
  let lastResponse: Response | undefined;

  while (attempt <= totalRetries) {
    const headers: Record<string, string> = {
      Accept: 'application/json;odata=verbose',
      'Content-Type': 'application/json;odata=verbose',
      ...additionalHeaders,
    };

    if (ifMatch) {
      headers['If-Match'] = ifMatch;
    }

    if (method === 'PATCH' || method === 'MERGE') {
      headers['X-HTTP-Method'] = 'MERGE';
    }

    const init: RequestInit = {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    };

    try {
      const response = await fetcher(urlBuilder(list, itemId), init);
      lastResponse = response;

      if (response.ok) {
        const data = (parse ? await parse(response) : ((await parseJsonSafe(response)) as T | undefined));
        const etag = response.headers.get('ETag') ?? undefined;
        return { ok: true, status: response.status, data, etag, raw: response };
      }

      if (response.status === 409 || response.status === 428 || response.status === 412) {
        return buildErrorResult(response);
      }

      if (isTransient(response.status) && attempt < totalRetries) {
        attempt += 1;
        await delay(300 * attempt);
        continue;
      }

      return buildErrorResult(response);
    } catch (error) {
      if (attempt >= totalRetries) {
        const fallback = error instanceof Error ? error : new Error('SharePoint write failed');
        const wrapped: SpWriteError = Object.assign(fallback, {
          status: lastResponse?.status,
          code: lastResponse?.status ? String(lastResponse.status) : undefined,
          response: lastResponse,
        });
        return {
          ok: false,
          status: lastResponse?.status,
          statusText: lastResponse?.statusText,
          error: wrapped,
          raw: lastResponse,
        };
      }

      attempt += 1;
      await delay(300 * attempt);
    }
  }

  return buildErrorResult(lastResponse, 'SharePoint write exhausted retries');
}
