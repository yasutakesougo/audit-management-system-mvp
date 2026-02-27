import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { UserSelectMode } from '@/sharepoint/fields';
import type {
    UserRepository,
    UserRepositoryListParams,
    UserRepositoryUpdateDto,
} from './domain/UserRepository';
import { getUserRepository } from './repositoryFactory';
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
  remove: (id: number | string) => Promise<void>;
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

const useUserRepository = (): UserRepository => {
  return useMemo(() => getUserRepository(), []);
};

export function useUsers(params?: UsersHookParams): UsersHookReturn {
  const repository = useUserRepository();
  const [data, setData] = useState<IUserMaster[]>([]);
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [error, setError] = useState<unknown>(null);
  const lastSnapshot = useRef<string>('');

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
      const listParams: UserRepositoryListParams = params
        ? { ...params, signal }
        : { signal };
      const rows = await repository.getAll(listParams);
      if (signal?.aborted) {
        return;
      }
      setDataIfChanged(rows);
      setStatus('success');
    } catch (err) {
      if (signal?.aborted) {
        return;
      }
      setError(err);
      setStatus('error');
    }
  }, [params, repository, setDataIfChanged]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchList(controller.signal);
    return () => controller.abort();
  }, [fetchList]);

  const refresh = useCallback(async () => {
    await fetchList();
  }, [fetchList]);

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

  return useMemo(
    () => ({ data, status, error, refresh, create, update, remove }),
    [create, data, error, refresh, remove, status, update],
  );
}

export function useUser(id?: number | string, options?: { selectMode?: UserSelectMode }): UserHookReturn {
  const repository = useUserRepository();
  const [data, setData] = useState<IUserMaster | null>(null);
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [error, setError] = useState<unknown>(null);
  const numericId = coerceNumericId(id);

  const load = useCallback(async (signal?: AbortSignal) => {
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
      if (signal?.aborted) {
        return;
      }
      setData(row);
      setStatus('success');
    } catch (err) {
      if (signal?.aborted) {
        return;
      }
      setError(err);
      setStatus('error');
    }
  }, [numericId, repository, options?.selectMode]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

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
