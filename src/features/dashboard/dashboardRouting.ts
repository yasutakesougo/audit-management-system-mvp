import { getCurrentUserRole, useAuthStore, type DashboardAudience } from '@/features/auth/store';
import { useMemo } from 'react';

const DASHBOARD_ROUTES: Record<DashboardAudience, string> = {
  staff: '/dashboard',
  admin: '/admin/dashboard',
};

export const resolveDashboardPath = (role: DashboardAudience = 'staff') =>
  DASHBOARD_ROUTES[role] ?? DASHBOARD_ROUTES.staff;

export const useDashboardPath = () => {
  const role = useAuthStore((s) => s.currentUserRole);
  return useMemo(() => resolveDashboardPath(role), [role]);
};

export const getDashboardPath = () => resolveDashboardPath(getCurrentUserRole());
