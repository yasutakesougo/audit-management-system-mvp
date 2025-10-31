import { getAppConfig, isDemoModeEnabled, shouldSkipLogin } from '@/lib/env';
import { useUsers } from './useUsers';
import { useUsersDemo } from './usersStoreDemo';

type UsersStoreHook = typeof useUsers;

export const useUsersStore: UsersStoreHook = (...args) => {
  const { isDev } = getAppConfig(); // evaluate at call time
  const demoEnabled = !!isDev || isDemoModeEnabled() || shouldSkipLogin();
  const resolveHook: UsersStoreHook = demoEnabled ? (useUsersDemo as UsersStoreHook) : useUsers;
  return resolveHook(...args);
};
