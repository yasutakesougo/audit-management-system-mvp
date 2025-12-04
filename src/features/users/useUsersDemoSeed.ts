import { useEffect } from 'react';
import type { IUserMaster } from './types';
import { seedDemoUsers } from './usersStoreDemo';
import { seedInMemoryUsers } from './infra/InMemoryUserRepository';

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

const seedUsersFromStorage = (): void => {
  if (import.meta.env.PROD) return;
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

    seedDemoUsers(users);
    seedInMemoryUsers(users);
    lastSeedSnapshot = raw;
  } catch (error) {
    console.warn('[useUsersDemoSeed] Failed to parse users master seed', error);
  }
};

export function useUsersDemoSeed(): void {
  seedUsersFromStorage();
  useEffect(() => {
    seedUsersFromStorage();
  }, []);
}
