import { useEffect, useCallback } from 'react';
import { getAppConfig } from '@/lib/env';
import { useDataProvider } from '@/lib/data/useDataProvider';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import type { IUserMaster } from './types';

export const USERS_MASTER_STORAGE_KEY = 'users.master.dev.v1';

type UsersMasterSeed = {
  users?: unknown;
};

const isValidUser = (value: unknown): value is IUserMaster => (
  !!value && typeof value === 'object' && 'Id' in value
);

const normalizeUsers = (payload: unknown): IUserMaster[] | null => {
  if (!payload || typeof payload !== 'object') return null;
  const cast = payload as UsersMasterSeed;
  if (!Array.isArray(cast.users) || cast.users.length === 0) {
    return null;
  }
  const ensured = cast.users.filter(isValidUser) as IUserMaster[];
  return ensured.length ? ensured : null;
};

let lastSeedSnapshot: string | null = null;
const { isDev: isDevEnv } = getAppConfig();

const seedUsersFromStorage = async (provider: IDataProvider): Promise<void> => {
  if (!isDevEnv) return;
  if (typeof window === 'undefined') return;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(USERS_MASTER_STORAGE_KEY);
  } catch (error) {
    console.warn('[useUsersDemoSeed] Failed to read seed from localStorage', error);
    return;
  }

  if (!raw || raw === lastSeedSnapshot) {
    return;
  }

  try {
    const parsed = JSON.parse(raw) as UsersMasterSeed;
    const users = normalizeUsers(parsed);
    if (!users) return;

    // provider が seed メソッドを持っている場合（InMemoryDataProvider 等）のみ実行
    if (provider.seed) {
      await provider.seed('Users_Master', users as unknown as Record<string, unknown>[]);
      lastSeedSnapshot = raw;
    }
  } catch (error) {
    console.warn('[useUsersDemoSeed] Failed to parse users master seed', error);
  }
};

export function useUsersDemoSeed(enabled = true): void {
  const { provider } = useDataProvider();

  const performSeed = useCallback(async () => {
    if (enabled) {
      await seedUsersFromStorage(provider);
    }
  }, [enabled, provider]);

  useEffect(() => {
    performSeed();
  }, [performSeed]);
}
