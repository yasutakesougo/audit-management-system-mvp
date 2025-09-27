import * as React from 'react';
import { vi } from 'vitest';
import type { IUserMaster, IUserMasterCreateDto } from '../types';

export type MockUser = IUserMaster;

let items: MockUser[] = [];
let counter = 1;
const subscribers = new Set<() => void>();

const snapshot = () => items;
const subscribe = (listener: () => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};

const emit = () => {
  for (const listener of subscribers) {
    listener();
  }
};

const resetStore = (initial: MockUser[] = []) => {
  items = initial.map((item) => ({ ...item }));
  counter = initial.length ? Math.max(...initial.map((u) => u.Id)) + 1 : 1;
  emit();
};

const createEntity = (dto: IUserMasterCreateDto): MockUser => ({
  Id: counter++,
  UserID: dto.UserID,
  FullName: dto.FullName,
  ContractDate: dto.ContractDate ?? undefined,
  IsHighIntensitySupportTarget: dto.IsHighIntensitySupportTarget ?? false,
  ServiceStartDate: dto.ServiceStartDate ?? undefined,
  ServiceEndDate: dto.ServiceEndDate ?? null,
});

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

vi.mock('../useUsers', () => {

  function useUsers() {
    const data = React.useSyncExternalStore(subscribe, snapshot, snapshot);
    const [status, setStatus] = React.useState<AsyncStatus>('success');
    const error = null;

    const create = React.useCallback(async (dto: IUserMasterCreateDto) => {
      setStatus('loading');
      try {
        const entity = createEntity(dto);
        items = [entity, ...items];
        emit();
        return entity;
      } finally {
        setStatus('success');
      }
    }, []);

    const update = React.useCallback(async (id: number | string, patch: Partial<IUserMasterCreateDto>) => {
      setStatus('loading');
      try {
        const numericId = Number(id);
        items = items.map((item) => (item.Id === numericId ? { ...item, ...patch } : item));
        emit();
        const updated = items.find((item) => item.Id === numericId);
        if (!updated) {
          throw new Error(`User with id ${numericId} not found`);
        }
        return updated;
      } finally {
        setStatus('success');
      }
    }, []);

    const remove = React.useCallback(async (id: number | string) => {
      setStatus('loading');
      try {
        const numericId = Number(id);
        items = items.filter((item) => item.Id !== numericId);
        emit();
      } finally {
        setStatus('success');
      }
    }, []);

    const refresh = React.useCallback(async () => {
      setStatus('loading');
      try {
        emit();
      } finally {
        setStatus('success');
      }
    }, []);

    return React.useMemo(
      () => ({
        data,
        status,
        error,
        create,
        update,
        remove,
        refresh,
      }),
      [create, data, error, refresh, remove, status, update],
    );
  }

  return {
    useUsers,
    __usersStore: {
      reset: resetStore,
    },
  };
});

export const usersStoreMock = {
  reset: resetStore,
};
