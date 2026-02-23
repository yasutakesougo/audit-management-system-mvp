import { useSyncExternalStore } from 'react';

export type DashboardAudience = 'staff' | 'admin';

const DASHBOARD_AUDIENCE_LEVELS: Record<DashboardAudience, number> = {
  staff: 0,
  admin: 1,
};

export const canAccessDashboardAudience = (
  role: DashboardAudience,
  required: DashboardAudience,
): boolean => DASHBOARD_AUDIENCE_LEVELS[role] >= DASHBOARD_AUDIENCE_LEVELS[required];

export const isDashboardAudience = (
  role: DashboardAudience,
  expected: DashboardAudience,
): boolean => role === expected;

type AuthStoreState = {
  currentUserRole: DashboardAudience;
  setCurrentUserRole: (role: DashboardAudience) => void;
};

const ROLE_STORAGE_KEY = 'role';
const listeners = new Set<() => void>();

let state: AuthStoreState = {
  currentUserRole: getInitialRole(),
  setCurrentUserRole: (role: DashboardAudience) => updateRole(role, true),
};

function getInitialRole(): DashboardAudience {
  if (typeof window === 'undefined') {
    return 'staff';
  }
  const stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
  return stored === 'admin' ? 'admin' : 'staff';
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function updateRole(role: DashboardAudience, persist: boolean) {
  if (state.currentUserRole === role) {
    return;
  }
  state = {
    ...state,
    currentUserRole: role,
    setCurrentUserRole: (r: DashboardAudience) => updateRole(r, true),
  };
  if (persist && typeof window !== 'undefined') {
    window.localStorage.setItem(ROLE_STORAGE_KEY, role);
  }
  emitChange();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === ROLE_STORAGE_KEY) {
      const nextRole = event.newValue === 'admin' ? 'admin' : 'staff';
      updateRole(nextRole, false);
    }
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const snapshot = () => state;

export const useAuthStore = <T,>(selector: (state: AuthStoreState) => T): T => {
  return useSyncExternalStore(subscribe, () => selector(snapshot()), () => selector(snapshot()));
};

export const setCurrentUserRole = (role: DashboardAudience) => {
  updateRole(role, true);
};

export const getCurrentUserRole = () => snapshot().currentUserRole;

export const dashboardAudienceFromPath = (pathname: string): DashboardAudience =>
  pathname.startsWith('/admin/dashboard') ? 'admin' : 'staff';
