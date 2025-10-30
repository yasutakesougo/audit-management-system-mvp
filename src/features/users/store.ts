import { getAppConfig, isDemoModeEnabled, shouldSkipLogin } from '@/lib/env';
import { useUsers } from './useUsers';
import { useUsersDemo } from './usersStoreDemo';

type UsersStoreHook = typeof useUsers;
const demoHook = useUsersDemo as UsersStoreHook;
const liveHook = useUsers as UsersStoreHook;

export const useUsersStore: UsersStoreHook = (...args) => {
  const { isDev } = getAppConfig();

  if (isDev) {
    return demoHook(...args);
  }

  if (shouldSkipLogin()) {
    return demoHook(...args);
  }

  if (isDemoModeEnabled()) {
    return demoHook(...args);
  }

  return liveHook(...args);
};
