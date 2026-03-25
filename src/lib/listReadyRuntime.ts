type ListReadyScope = 'schedules';

type ListReadyStore = Partial<Record<ListReadyScope, Record<string, true>>>;

type SchedulesListReadyKeyInput = {
  baseUrl: string;
  listTitle: string;
  accountId?: string;
  tenantId?: string;
};

const getStore = (): ListReadyStore | null => {
  if (typeof window === 'undefined') return null;
  if (!window.__listReady) {
    window.__listReady = {};
  }
  return window.__listReady;
};

const getScopeStore = (scope: ListReadyScope): Record<string, true> | null => {
  const store = getStore();
  if (!store) return null;
  if (!store[scope]) {
    store[scope] = {};
  }
  return store[scope] ?? null;
};

export const buildSchedulesListReadyKey = ({
  baseUrl,
  listTitle,
  accountId,
  tenantId,
}: SchedulesListReadyKeyInput): string => {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/u, '');
  const normalizedListTitle = listTitle.trim().toLowerCase();
  const normalizedAccountId = (accountId ?? '').trim().toLowerCase();
  const normalizedTenantId = (tenantId ?? '').trim().toLowerCase();
  return [normalizedBaseUrl, normalizedListTitle, normalizedTenantId, normalizedAccountId].join('|');
};

export const isRuntimeListReady = (scope: ListReadyScope, key: string): boolean => {
  const scopeStore = getScopeStore(scope);
  if (!scopeStore) return false;
  return scopeStore[key] === true;
};

export const setRuntimeListReady = (scope: ListReadyScope, key: string, ready: boolean): void => {
  const scopeStore = getScopeStore(scope);
  if (!scopeStore) return;
  if (ready) {
    scopeStore[key] = true;
    return;
  }
  delete scopeStore[key];
};

export const clearRuntimeListReady = (scope?: ListReadyScope): void => {
  const store = getStore();
  if (!store) return;
  if (!scope) {
    window.__listReady = {};
    return;
  }
  delete store[scope];
};
