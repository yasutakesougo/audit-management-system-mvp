import { isDemoModeEnabled, shouldSkipLogin } from '@/lib/env';
import { useUsers } from './useUsers';
import { useUsersDemo } from './usersStoreDemo';

type UsersStoreHook = typeof useUsers;

export const useUsersStore: UsersStoreHook = (...args) => {
  const demoEnabled = isDemoModeEnabled() || shouldSkipLogin();
  const resolveHook: UsersStoreHook = demoEnabled ? (useUsersDemo as UsersStoreHook) : useUsers;
  return resolveHook(...args);
};
