import { readBool } from '@/lib/env';

export type ListItem = Record<string, unknown>;

export interface SharePointListApi {
  addItemByTitle: (listTitle: string, payload: ListItem) => Promise<{ id: number }>;
  updateItemById: (listTitle: string, id: number, payload: ListItem) => Promise<void>;
  findOne: (options: { listTitle: string; filter: string; select?: string[]; top?: number }) => Promise<{ id: number } | null>;
  mode: 'sharepoint' | 'stub';
}

export type HttpishError = Error & {
  status?: number;
  retryAfterMs?: number;
};

const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);

const extractId = (value: unknown): number | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = record.id ?? record.Id ?? record.ID;
  return typeof id === 'number' ? id : null;
};

const parseCollection = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).value)) {
    return (value as { value: unknown[] }).value;
  }
  return [];
};

const parseRetryAfterMs = (headers: Headers): number | undefined => {
  const token = headers.get('Retry-After');
  if (!token) return undefined;
  const asNumber = Number(token);
  if (!Number.isNaN(asNumber)) {
    return Math.max(0, asNumber * 1000);
  }
  const asDate = Date.parse(token);
  if (Number.isNaN(asDate)) return undefined;
  return Math.max(0, asDate - Date.now());
};

const formatMessage = (status: number, body: unknown): string => {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const odata = record['odata.error'];
    if (odata && typeof odata === 'object') {
      const message = (odata as Record<string, unknown>).message;
      if (message && typeof message === 'object') {
        const value = (message as Record<string, unknown>).value;
        if (typeof value === 'string') {
          return value;
        }
      }
    }
    const errorBlock = record.error;
    if (errorBlock && typeof errorBlock === 'object') {
      const nestedMessage = (errorBlock as Record<string, unknown>).message;
      if (nestedMessage && typeof nestedMessage === 'object') {
        const value = (nestedMessage as Record<string, unknown>).value;
        if (typeof value === 'string') {
          return value;
        }
      } else if (typeof nestedMessage === 'string') {
        return nestedMessage;
      }
    }
    const directMessage = record.message;
    if (typeof directMessage === 'string') {
      return directMessage;
    }
  }
  if (typeof body === 'string') {
    return body.slice(0, 500);
  }
  return `HTTP ${status}`;
};

const computeBackoff = (baseMs: number, attempt: number) => {
  const jitter = Math.floor(Math.random() * 200);
  return baseMs * 2 ** attempt + jitter;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function resilientFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  maxAttempts = 4,
  baseDelayMs = 600,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(input, init);
      if (response.ok) {
        return response;
      }

      let body: unknown;
      const contentType = response.headers.get('content-type') ?? '';
      try {
        body = contentType.includes('json') ? await response.json() : await response.text();
      } catch {
        body = undefined;
      }
      const retryAfterMs = parseRetryAfterMs(response.headers);
      const status = response.status;
      const message = formatMessage(status, body);

      if (TRANSIENT_STATUS.has(status) && attempt < maxAttempts - 1) {
        await wait(retryAfterMs ?? computeBackoff(baseDelayMs, attempt));
        continue;
      }

      const error = new Error(message) as HttpishError;
      error.status = status;
      if (retryAfterMs != null) {
        error.retryAfterMs = retryAfterMs;
      }
      throw error;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        await wait(computeBackoff(baseDelayMs, attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('resilientFetch exhausted');
}

const useSharePointClient = () => readBool('VITE_NURSE_SYNC_SP', false);

const stubApi: SharePointListApi = {
  mode: 'stub',
  async addItemByTitle() {
    return { id: Date.now() };
  },
  async updateItemById() {
    /* noop */
  },
  async findOne() {
    return null;
  },
};

export function makeSharePointListApi(): SharePointListApi {
  if (!useSharePointClient()) {
    return stubApi;
  }

  const doFetch = async (path: string, init?: RequestInit) => resilientFetch(path, init);

  return {
    mode: 'sharepoint',
    async addItemByTitle(listTitle, payload) {
      const response = await doFetch(`/api/sp/lists/${encodeURIComponent(listTitle)}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => undefined);
      const id = extractId(data);
      if (id == null) {
        const error = new Error('SharePoint add response missing id') as HttpishError;
        error.status = 502;
        throw error;
      }
      return { id };
    },

    async updateItemById(listTitle, id, payload) {
      await doFetch(`/api/sp/lists/${encodeURIComponent(listTitle)}/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },

    async findOne({ listTitle, filter, select = ['Id'], top = 1 }) {
      const query = new URLSearchParams({
        $filter: filter,
        $select: select.join(','),
        $top: String(top),
      });
      const response = await doFetch(`/api/sp/lists/${encodeURIComponent(listTitle)}/items?${query}`);
      const data = await response.json().catch(() => undefined);
      const collection = parseCollection(data);
      const first = collection[0];
      const id = extractId(first);
      return id == null ? null : { id };
    },
  };
}
