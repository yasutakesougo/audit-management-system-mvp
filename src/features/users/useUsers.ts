import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { UserSelectMode } from '@/sharepoint/fields';
import { useAutoRefreshOnRecovery } from '@/features/sp/health/useAutoRefreshOnRecovery';
import type {
    UserRepositoryListParams,
    UserRepositoryUpdateDto,
} from './domain/UserRepository';
import { useUserRepository } from './repositoryFactory';
import type { IUserMaster, IUserMasterCreateDto } from './types';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export type UsersHookParams = Omit<UserRepositoryListParams, 'signal'>;

type UsersHookReturn = {
  data: IUserMaster[];
  status: AsyncStatus;
  error: unknown;
  refresh: () => Promise<void>;
  create: (payload: IUserMasterCreateDto) => Promise<IUserMaster>;
  update: (id: number | string, payload: UserRepositoryUpdateDto) => Promise<IUserMaster>;
  terminate: (id: number | string) => Promise<IUserMaster>;
  remove: (id: number | string) => Promise<void>;
  byId: Map<number | string, IUserMaster>;
  isLoading: boolean;
  users: IUserMaster[]; // Compatibility alias
  load: () => Promise<void>; // Compatibility alias
};

type UserHookReturn = {
  data: IUserMaster | null;
  status: AsyncStatus;
  error: unknown;
  refresh: () => Promise<void>;
  update: (payload: UserRepositoryUpdateDto) => Promise<IUserMaster>;
};

const snapshotRows = (rows: IUserMaster[]): string => JSON.stringify(rows);

const coerceNumericId = (value?: number | string): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

export function useUsers(params?: UsersHookParams): UsersHookReturn {
  const repository = useUserRepository();
  const [data, setData] = useState<IUserMaster[]>([]);
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [error, setError] = useState<unknown>(null);
  const lastSnapshot = useRef<string>('');

  const paramsKey = JSON.stringify(params ?? null);
  const stableParams = useRef(params);
  stableParams.current = params;

  const setDataIfChanged = useCallback((rows: IUserMaster[]) => {
    const snapshot = snapshotRows(rows);
    if (snapshot !== lastSnapshot.current) {
      lastSnapshot.current = snapshot;
      setData(rows);
    }
  }, []);

  const updateData = useCallback((updater: (prev: IUserMaster[]) => IUserMaster[]) => {
    setData((prev) => {
      const next = updater(prev);
      lastSnapshot.current = snapshotRows(next);
      return next;
    });
  }, []);

  const fetchList = useCallback(async (signal?: AbortSignal) => {
    setStatus('loading');
    setError(null);
    try {
      const currentParams = stableParams.current;
      const listParams: UserRepositoryListParams = currentParams
        ? { ...currentParams, signal, selectMode: currentParams.selectMode ?? 'detail' }
        : { signal, selectMode: 'detail' };
      const rows = await repository.getAll(listParams);
      if (signal?.aborted) return;
      setDataIfChanged(rows);
      setStatus('success');
    } catch (err) {
      if (signal?.aborted) return;
      setError(err);
      setStatus('error');
    }
  }, [paramsKey, repository, setDataIfChanged]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchList(controller.signal);
    return () => controller.abort();
  }, [fetchList]);

  const refresh = useCallback(async () => {
    await fetchList();
  }, [fetchList]);

  // ── Recovery Linkage (Step 3) ───────────────────────────────────────────
  useAutoRefreshOnRecovery(fetchList);

  const create = useCallback(async (payload: IUserMasterCreateDto) => {
    setStatus('loading');
    setError(null);
    try {
      const created = await repository.create(payload);
      updateData((prev) => [created, ...prev]);
      setStatus('success');
      return created;
    } catch (err) {
      setError(err);
      setStatus('error');
      throw err;
    }
  }, [repository, updateData]);

  const update = useCallback(async (id: number | string, payload: UserRepositoryUpdateDto) => {
    setStatus('loading');
    setError(null);
    const numericId = coerceNumericId(id);
    if (numericId == null) {
      const err = new Error('Invalid user ID for update.');
      setError(err);
      setStatus('error');
      throw err;
    }
    try {
      const updated = await repository.update(numericId, payload);
      updateData((prev) => prev.map((item) => (item.Id === numericId ? updated : item)));
      setStatus('success');
      return updated;
    } catch (err) {
      setError(err);
      setStatus('error');
      throw err;
    }
  }, [repository, updateData]);

  const remove = useCallback(async (id: number | string) => {
    setStatus('loading');
    setError(null);
    const numericId = coerceNumericId(id);
    if (numericId == null) {
      const err = new Error('Invalid user ID for remove.');
      setError(err);
      setStatus('error');
      throw err;
    }
    try {
      await repository.remove(numericId);
      updateData((prev) => prev.filter((item) => item.Id !== numericId));
      setStatus('success');
    } catch (err) {
      setError(err);
      setStatus('error');
      throw err;
    }
  }, [repository, updateData]);

  const terminate = useCallback(async (id: number | string) => {
    setStatus('loading');
    setError(null);
    const numericId = coerceNumericId(id);
    if (numericId == null) {
      const err = new Error('Invalid user ID for terminate.');
      setError(err);
      setStatus('error');
      throw err;
    }
    try {
      const terminated = await repository.terminate(numericId);
      updateData((prev) => prev.map((item) => (item.Id === numericId ? terminated : item)));
      setStatus('success');
      return terminated;
    } catch (err) {
      setError(err);
      setStatus('error');
      throw err;
    }
  }, [repository, updateData]);

  const isLoading = status === 'loading' || status === 'idle';

  const byId = useMemo(() => {
    const map = new Map<number | string, IUserMaster>();
    data.forEach((user) => {
      const id = user.Id ?? (user as unknown as { id?: number | string }).id;
      if (id != null) map.set(id, user);
    });
    return map;
  }, [data]);

  return useMemo(
    () => ({ 
      data, 
      users: data, 
      status, 
      isLoading, 
      error, 
      refresh, 
      load: refresh, 
      create, 
      update, 
      terminate, 
      remove,
      byId 
    }),
    [create, data, error, refresh, remove, status, terminate, update, isLoading, byId],
  );
}

export function useUser(id?: number | string, options?: { selectMode?: UserSelectMode }): UserHookReturn {
  const repository = useUserRepository();
  const [data, setData] = useState<IUserMaster | null>(null);
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [error, setError] = useState<unknown>(null);
  const numericId = coerceNumericId(id);

  const fetchOne = useCallback(async (signal?: AbortSignal) => {
    if (numericId == null) {
      setData(null);
      setStatus('idle');
      setError(null);
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const row = await repository.getById(numericId, { signal, selectMode: options?.selectMode });
      if (signal?.aborted) return;
      setData(row);
      setStatus('success');
    } catch (err) {
      if (signal?.aborted) return;
      setError(err);
      setStatus('error');
    }
  }, [numericId, repository, options?.selectMode]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchOne(controller.signal);
    return () => controller.abort();
  }, [fetchOne]);

  const refresh = useCallback(async () => {
    await fetchOne();
  }, [fetchOne]);

  // ── Recovery Linkage (Step 3) ───────────────────────────────────────────
  useAutoRefreshOnRecovery(fetchOne);

  const update = useCallback(async (payload: UserRepositoryUpdateDto) => {
    if (numericId == null) {
      throw new Error('User ID is required to update.');
    }
    setStatus('loading');
    setError(null);
    try {
      const updated = await repository.update(numericId, payload);
      setData(updated);
      setStatus('success');
      return updated;
    } catch (err) {
      setError(err);
      setStatus('error');
      throw err;
    }
  }, [numericId, repository]);

  return useMemo(
    () => ({ data, status, error, refresh, update }),
    [data, error, refresh, status, update],
  );
}
