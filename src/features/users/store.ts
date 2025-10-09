import { isDemoModeEnabled, shouldSkipLogin } from '@/lib/env';
import { useUsers } from './useUsers';
import { useUsersDemo } from './usersStoreDemo';

const demoEnabled = isDemoModeEnabled() || shouldSkipLogin();

type UsersStoreHook = typeof useUsers;

const resolveHook: UsersStoreHook = demoEnabled ? (useUsersDemo as UsersStoreHook) : useUsers;

export const useUsersStore: UsersStoreHook = (...args) => resolveHook(...args);
