import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildDefaultActiveFilter, useUsersApi } from './api';
import type { IUserMaster, IUserMasterCreateDto } from './types';

type IUserMasterUpdateDto = Partial<IUserMasterCreateDto>;

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

type UsersHookReturn = {
  data: IUserMaster[];
  status: AsyncStatus;
  error: unknown;
  refresh: () => Promise<void>;
  create: (payload: IUserMasterCreateDto) => Promise<IUserMaster>;
  update: (id: number | string, payload: IUserMasterUpdateDto) => Promise<IUserMaster>;
  remove: (id: number | string) => Promise<void>;
};

type UserHookReturn = {
  data: IUserMaster | null;
  status: AsyncStatus;
  error: unknown;
  refresh: () => Promise<void>;
  update: (payload: IUserMasterUpdateDto) => Promise<IUserMaster>;
};

export function useUsers(initialFilter?: string): UsersHookReturn {
  const api = useUsersApi();
  const [data, setData] = useState<IUserMaster[]>([]);
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [error, setError] = useState<unknown>(null);
  const hasLoadedRef = useRef(false);

  const filter = useMemo(
    () => initialFilter ?? buildDefaultActiveFilter(),
    [initialFilter]
  );

  const lastSnapshot = useRef<string>('');

  const setDataIfChanged = useCallback((rows: IUserMaster[]) => {
    const snapshot = JSON.stringify(rows);
    if (snapshot !== lastSnapshot.current) {
      lastSnapshot.current = snapshot;
      setData(rows);
    }
  }, []);

  const updateData = useCallback((updater: (prev: IUserMaster[]) => IUserMaster[]) => {
    setData(prev => {
      const next = updater(prev);
      lastSnapshot.current = JSON.stringify(next);
      return next;
    });
  }, []);

  const fetchList = useCallback(async (signal?: AbortSignal) => {
    console.log('[useUsers] fetchList called, setting status to loading');
    setStatus('loading');
    setError(null);
    try {
      console.log('[useUsers] Calling api.getUsers with filter:', filter);
      const rows = await api.getUsers(filter, { signal });
      if (signal?.aborted) return;
      console.log('[useUsers] Received rows:', rows?.length, 'items');
      setDataIfChanged(rows);
      console.log('[useUsers] Setting status to success');
      setStatus('success');
    } catch (e) {
      if (signal?.aborted) return;
      console.log('[useUsers] Error occurred:', e);
      setError(e);
      setStatus('error');
    }
  }, [api, filter, setDataIfChanged]);

  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;
    const controller = new AbortController();
    void fetchList(controller.signal);
    return () => controller.abort();
  }, [fetchList]);

  const create = useCallback(async (payload: IUserMasterCreateDto) => {
    setStatus('loading');
    setError(null);
    try {
      const created = await api.createUser(payload);
      updateData(prev => [created, ...prev]);
      setStatus('success');
      return created;
    } catch (e) {
      setError(e);
      setStatus('error');
      throw e;
    }
  }, [api, updateData]);

  const update = useCallback(async (id: number | string, payload: IUserMasterUpdateDto) => {
    setStatus('loading');
    setError(null);
    try {
      const updated = await api.updateUser(Number(id), payload);
      const numericId = Number(id);
      updateData(prev => prev.map(item => (item.Id === numericId ? updated : item)));
      setStatus('success');
      return updated;
    } catch (e) {
      setError(e);
      setStatus('error');
      throw e;
    }
  }, [api, updateData]);

  const remove = useCallback(async (id: number | string) => {
    setStatus('loading');
    setError(null);
    try {
      await api.deleteUser(Number(id));
      const numericId = Number(id);
      updateData(prev => prev.filter(item => item.Id !== numericId));
      setStatus('success');
    } catch (e) {
      setError(e);
      setStatus('error');
      throw e;
    }
  }, [api, updateData]);

  const refresh = useCallback(async () => {
    await fetchList();
  }, [fetchList]);

  const result = useMemo(
    () => ({ data, status, error, refresh, create, update, remove }),
    [create, data, error, refresh, remove, status, update]
  );

  console.log('[useUsers] Returning result:', {
    dataCount: result.data?.length,
    status: result.status,
    hasError: !!result.error
  });

  return result;
}

export function useUser(id?: number | string): UserHookReturn {
  const api = useUsersApi();
  const [data, setData] = useState<IUserMaster | null>(null);
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [error, setError] = useState<unknown>(null);

  const numericId = id !== undefined ? Number(id) : undefined;

  const load = useCallback(async () => {
    if (numericId == null || Number.isNaN(numericId)) {
      setData(null);
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const row = await api.getUserById(numericId);
      setData(row);
      setStatus('success');
    } catch (e) {
      setError(e);
      setStatus('error');
    }
  }, [api, numericId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const update = useCallback(async (payload: IUserMasterUpdateDto) => {
    if (numericId == null || Number.isNaN(numericId)) {
      throw new Error('User ID is required to update.');
    }
    const updated = await api.updateUser(numericId, payload);
    setData(updated);
    return updated;
  }, [api, numericId]);

  return useMemo(() => ({ data, status, error, refresh, update }), [data, error, refresh, status, update]);
}
