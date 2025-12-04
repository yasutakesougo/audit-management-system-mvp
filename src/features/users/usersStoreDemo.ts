import type { SafeError } from '@/lib/errors';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { normalizeAttendanceDays } from './attendance';
import { DEMO_USERS } from './constants';
import type { IUserMaster, IUserMasterCreateDto } from './types';
import { ensureUserId } from './utils/userId';
import type { AsyncStatus } from './useUsers';

type UsersHookReturn = {
  data: IUserMaster[];
  status: AsyncStatus;
  error: SafeError | null;
  refresh: () => Promise<void>;
  create: (payload: IUserMasterCreateDto) => Promise<IUserMaster>;
  update: (id: number | string, payload: Partial<IUserMasterCreateDto>) => Promise<IUserMaster>;
  remove: (id: number | string) => Promise<void>;
};

const cloneUser = (user: IUserMaster): IUserMaster => ({
  ...user,
  AttendanceDays: normalizeAttendanceDays(user.AttendanceDays),
});

const initializeUsers = (initial: IUserMaster[]): void => {
  users = initial.map(cloneUser);
  nextId = users.length ? Math.max(...users.map((u) => Number(u.Id) || 0)) + 1 : 1;
};

let users: IUserMaster[] = [];
let nextId = 1;

initializeUsers(DEMO_USERS);

const listeners = new Set<() => void>();

const snapshot = () => users;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emit = () => {
  for (const listener of listeners) {
    listener();
  }
};

const coerceId = (id: number | string): number => {
  const numeric = Number(id);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid user id: ${String(id)}`);
  }
  return numeric;
};

const fromDto = (dto: IUserMasterCreateDto): IUserMaster => {
  const id = nextId++;
  return {
    Id: id,
    UserID: ensureUserId(dto.UserID, id),
    FullName: dto.FullName,
    ContractDate: dto.ContractDate ?? undefined,
    IsHighIntensitySupportTarget: dto.IsHighIntensitySupportTarget ?? false,
    ServiceStartDate: dto.ServiceStartDate ?? undefined,
    ServiceEndDate: dto.ServiceEndDate ?? null,
    AttendanceDays: normalizeAttendanceDays(dto.AttendanceDays),
  };
};

export function seedDemoUsers(initial: IUserMaster[] = DEMO_USERS): void {
  initializeUsers(initial);
  emit();
}

export function resetDemoUsers(): void {
  initializeUsers(DEMO_USERS);
  emit();
}

export function useUsersDemo(): UsersHookReturn {
  const data = useSyncExternalStore(subscribe, snapshot, snapshot);

  const refresh = useCallback(async () => {
    emit();
  }, []);

  const create = useCallback(async (payload: IUserMasterCreateDto) => {
    const record = fromDto(payload);
    users = [record, ...users];
    emit();
    return record;
  }, []);

  const update = useCallback(async (id: number | string, payload: Partial<IUserMasterCreateDto>) => {
    const numericId = coerceId(id);
    let updated: IUserMaster | null = null;
    users = users.map((row) => {
      if (row.Id === numericId) {
        updated = {
          ...row,
          ...payload,
        } as IUserMaster;
        if (payload.AttendanceDays !== undefined) {
          updated.AttendanceDays = normalizeAttendanceDays(payload.AttendanceDays);
        }
        return updated;
      }
      return row;
    });

    if (!updated) {
      throw new Error(`User with id ${numericId} not found`);
    }
    const ensured = updated as IUserMaster;
    ensured.AttendanceDays = normalizeAttendanceDays(ensured.AttendanceDays);

    emit();
    return ensured;
  }, []);

  const remove = useCallback(async (id: number | string) => {
    const numericId = coerceId(id);
    users = users.filter((row) => row.Id !== numericId);
    emit();
  }, []);

  return useMemo(
    () => ({
      data,
      status: 'success' as AsyncStatus,
      error: null,
      refresh,
      create,
      update,
      remove,
    }),
    [create, data, refresh, remove, update],
  );
}
