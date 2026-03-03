import type { SafeError } from '@/lib/errors';
import { useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { normalizeAttendanceDays } from './attendance';
import { DEMO_USERS } from './constants';
import type { IUserMaster, IUserMasterCreateDto } from './types';
import type { AsyncStatus } from './useUsers';
import { ensureUserId } from './utils/userId';

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

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

interface UsersDemoState {
  users: IUserMaster[];
  nextId: number;
}

function buildInitialState(initial: IUserMaster[]): UsersDemoState {
  const users = initial.map(cloneUser);
  const nextId = users.length ? Math.max(...users.map((u) => Number(u.Id) || 0)) + 1 : 1;
  return { users, nextId };
}

const useUsersDemoStore = create<UsersDemoState>()(() => buildInitialState(DEMO_USERS));

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const coerceId = (id: number | string): number => {
  const numeric = Number(id);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid user id: ${String(id)}`);
  }
  return numeric;
};

const fromDto = (dto: IUserMasterCreateDto, nextId: number): IUserMaster => {
  return {
    Id: nextId,
    UserID: ensureUserId(dto.UserID, nextId),
    FullName: dto.FullName,
    ContractDate: dto.ContractDate ?? undefined,
    IsHighIntensitySupportTarget: dto.IsHighIntensitySupportTarget ?? false,
    ServiceStartDate: dto.ServiceStartDate ?? undefined,
    ServiceEndDate: dto.ServiceEndDate ?? null,
    AttendanceDays: normalizeAttendanceDays(dto.AttendanceDays),
  };
};

// ---------------------------------------------------------------------------
// Exported actions (backward-compatible)
// ---------------------------------------------------------------------------

export function seedDemoUsers(initial: IUserMaster[] = DEMO_USERS): void {
  useUsersDemoStore.setState(buildInitialState(initial));
}

export function resetDemoUsers(): void {
  useUsersDemoStore.setState(buildInitialState(DEMO_USERS));
}

// ---------------------------------------------------------------------------
// React Hook (backward-compatible)
// ---------------------------------------------------------------------------

export function useUsersDemo(): UsersHookReturn {
  const data = useUsersDemoStore((s) => s.users);

  const refresh = useCallback(async () => {
    // Trigger re-render by touching state
    useUsersDemoStore.setState((s) => ({ ...s }));
  }, []);

  const create = useCallback(async (payload: IUserMasterCreateDto) => {
    let record: IUserMaster | null = null;
    useUsersDemoStore.setState((s) => {
      record = fromDto(payload, s.nextId);
      return {
        users: [record, ...s.users],
        nextId: s.nextId + 1,
      };
    });
    return record!;
  }, []);

  const update = useCallback(async (id: number | string, payload: Partial<IUserMasterCreateDto>) => {
    const numericId = coerceId(id);
    let updated: IUserMaster | null = null;

    useUsersDemoStore.setState((s) => {
      const users = s.users.map((row) => {
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

      return { users };
    });

    return updated!;
  }, []);

  const remove = useCallback(async (id: number | string) => {
    const numericId = coerceId(id);
    useUsersDemoStore.setState((s) => ({
      users: s.users.filter((row) => row.Id !== numericId),
    }));
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
