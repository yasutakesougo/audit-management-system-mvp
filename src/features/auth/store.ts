import { useSyncExternalStore } from 'react';

export type DashboardAudience = 'staff' | 'admin';

type AuthStoreState = {
  currentUserRole: DashboardAudience;
};

const ROLE_STORAGE_KEY = 'role';
const listeners = new Set<() => void>();

let state: AuthStoreState = {
  currentUserRole: getInitialRole(),
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
  state = { ...state, currentUserRole: role };
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
