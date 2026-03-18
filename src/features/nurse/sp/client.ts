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

export function makeSharePointListApi(
  spFetch?: (path: string, init?: RequestInit) => Promise<Response>
): SharePointListApi {
  if (!useSharePointClient()) {
    return stubApi;
  }
  if (!spFetch) {
    throw new Error('makeSharePointListApi requires spFetch when SharePoint is enabled');
  }

  return {
    mode: 'sharepoint',
    async addItemByTitle(listTitle, payload) {
      const response = await spFetch(`/lists/getbytitle('${encodeURIComponent(listTitle)}')/items`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json;odata=verbose',
          'Accept': 'application/json;odata=nometadata'
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = new Error(`SharePoint add failed: ${response.status} ${await response.text().catch(() => '')}`) as HttpishError;
        error.status = response.status;
        throw error;
      }
      const data = await response.json().catch(() => undefined);
      const id = extractId(data?.d ?? data);
      if (id == null) {
        const error = new Error('SharePoint add response missing id') as HttpishError;
        error.status = 502;
        throw error;
      }
      return { id };
    },

    async updateItemById(listTitle, id, payload) {
      const response = await spFetch(`/lists/getbytitle('${encodeURIComponent(listTitle)}')/items(${id})`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json;odata=verbose',
          'X-HTTP-Method': 'MERGE',
          'If-Match': '*',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok && response.status !== 204) {
        const error = new Error(`SharePoint update failed: ${response.status} ${await response.text().catch(() => '')}`) as HttpishError;
        error.status = response.status;
        throw error;
      }
    },

    async findOne({ listTitle, filter, select = ['Id'], top = 1 }) {
      const query = new URLSearchParams({
        $filter: filter,
        $select: select.join(','),
        $top: String(top),
      });
      const response = await spFetch(`/lists/getbytitle('${encodeURIComponent(listTitle)}')/items?${query}`, {
        headers: {
          'Accept': 'application/json;odata=nometadata'
        }
      });
      if (!response.ok) {
        return null;
      }
      const data = await response.json().catch(() => undefined);
      const collection = parseCollection(data);
      const first = collection[0];
      const id = extractId(first);
      return id == null ? null : { id };
    },
  };
}
