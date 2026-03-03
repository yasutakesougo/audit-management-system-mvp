import { create } from 'zustand';

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

const ROLE_STORAGE_KEY = 'role';

function getInitialRole(): DashboardAudience {
  if (typeof window === 'undefined') {
    return 'staff';
  }
  const stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
  return stored === 'admin' ? 'admin' : 'staff';
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

interface AuthState {
  currentUserRole: DashboardAudience;
  setCurrentUserRole: (role: DashboardAudience) => void;
}

export const useAuthStoreBase = create<AuthState>()((set) => ({
  currentUserRole: getInitialRole(),
  setCurrentUserRole: (role: DashboardAudience) => {
    set((state) => {
      if (state.currentUserRole === role) return state;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ROLE_STORAGE_KEY, role);
      }
      return { currentUserRole: role };
    });
  },
}));

// Cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === ROLE_STORAGE_KEY) {
      const nextRole = event.newValue === 'admin' ? 'admin' : 'staff';
      useAuthStoreBase.setState({ currentUserRole: nextRole });
    }
  });
}

// ---------------------------------------------------------------------------
// Public API (backward-compatible)
// ---------------------------------------------------------------------------

export const useAuthStore = <T,>(selector: (state: AuthState) => T): T => {
  return useAuthStoreBase(selector);
};

export const setCurrentUserRole = (role: DashboardAudience) => {
  useAuthStoreBase.getState().setCurrentUserRole(role);
};

export const getCurrentUserRole = () => useAuthStoreBase.getState().currentUserRole;

export const dashboardAudienceFromPath = (pathname: string): DashboardAudience =>
  pathname.startsWith('/admin/dashboard') ? 'admin' : 'staff';
