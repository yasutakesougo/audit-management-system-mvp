import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { isSharePointThrottleError, SpThrottleRedirectError } from '@/lib/sp';
import type { UserRepositoryListParams } from '../domain/UserRepository';
import { useUserRepository } from '../repositoryFactory';
import type { IUserMaster } from '../types';
import type { AsyncStatus, UsersHookParams } from '../useUsers';

const USERS_LIST_QUERY_KEY = 'users:list';

let usersQueryThrottleCooldownUntil = 0;

export const __clearUsersQueryCooldownForTests = (): void => {
  usersQueryThrottleCooldownUntil = 0;
};

const toUsersQueryKey = (params?: UsersHookParams) =>
  [
    USERS_LIST_QUERY_KEY,
    params?.filters?.keyword ?? '',
    params?.filters?.isActive ?? null,
    params?.top ?? null,
    params?.selectMode ?? null,
  ] as const;

export type UseUsersQueryReturn = {
  data: IUserMaster[];
  status: AsyncStatus;
  error: unknown;
  refresh: () => Promise<void>;
};

const EMPTY_ARRAY: IUserMaster[] = [];

/**
 * useUsersQuery — users 読み取り専用 of the shared Query Hook
 *
 * /today 系の複数 consumer から同一 key で購読して、
 * Users_Master の重複取得を圧縮する。
 */
export function useUsersQuery(params?: UsersHookParams): UseUsersQueryReturn {
  const repository = useUserRepository();
  const queryKey = useMemo(
    () => toUsersQueryKey(params),
    [params?.filters?.keyword, params?.filters?.isActive, params?.top, params?.selectMode],
  );

  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      if (Date.now() < usersQueryThrottleCooldownUntil) {
        console.warn('[useUsersQuery] Suppressed request due to active throttle cooldown');
        throw new SpThrottleRedirectError('cooldown');
      }
      const listParams: UserRepositoryListParams = params
        ? { ...params, signal }
        : { signal };
      try {
        return await repository.getAll(listParams);
      } catch (error) {
        if (isSharePointThrottleError(error)) {
          usersQueryThrottleCooldownUntil = Date.now() + 15000;
        }
        throw error;
      }
    },
    staleTime: 60_000,
    retry: (_failureCount, error) => !isSharePointThrottleError(error),
  });

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query.refetch]);

  const status: AsyncStatus =
    query.status === 'pending'
      ? 'loading'
      : query.status === 'error'
        ? 'error'
        : 'success';

  return useMemo(
    () => ({
      data: query.data ?? EMPTY_ARRAY,
      status,
      error: query.error,
      refresh,
    }),
    [query.data, status, query.error, refresh],
  );
}
