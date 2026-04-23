/**
 * Schedules Routes — Domain-Oriented Sections
 * 
 * This file organizes schedule-related navigation by their functional domain:
 * - CALENDAR: Pure viewing of schedules and timelines.
 * - ASSIGNMENT: Coordination and allocation of resources (staff/transport).
 * - RESOURCE: Infrastructure and asset management (rooms/vehicles).
 * 
 * Organized to facilitate the 7+1 IA where 'Schedules' is a primary hub.
 */
import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';
import type { NavAudience, NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

export const SCHEDULES_ROUTES = {
  // ─── 1. CALENDAR (View Focused) ──────────────────────────────────────────
  CALENDAR: {
    /**
     * Team-wide weekly schedule view.
     * Future path: /schedules/calendar/week
     * Visibility: All Staff (Read/Write), Field Staff Shell (Read-only)
     */
    WEEK: (_isFieldStaffShell: boolean): NavItem => ({
      label: '週間予定',
      to: '/schedules/week',
      isActive: (pathname: string) => pathname.startsWith('/schedule') || pathname.startsWith('/schedules'),
      testId: TESTIDS.nav.schedules,
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.schedulesWeek,
      prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
      audience: NAV_AUDIENCE.staff as NavAudience,
      group: 'schedules' as NavGroupKey,
    }),
  },

  // ─── 2. ASSIGNMENT (Coordination Focused) ────────────────────────────────
  ASSIGNMENT: {
    /**
     * Transport coordination and vehicle assignment.
     * Future path: /schedules/assignment/transport
     * Visibility: Standard Staff only.
     * Responsibility: Planning and allocation (distinct from 'Today' execution).
     */
    TRANSPORT: (_isFieldStaffShell: boolean): NavItem => ({
      label: '送迎配車調整',
      to: '/transport/assignments',
      isActive: (pathname: string) => pathname.startsWith('/transport/assignments'),
      icon: undefined,
      testId: TESTIDS.nav.transportAssignments,
      audience: NAV_AUDIENCE.staff as NavAudience,
      group: 'schedules' as NavGroupKey,
    }),
  },

  // ─── 3. RESOURCE (Asset Focused) ─────────────────────────────────────────
  RESOURCE: {
    /**
     * Admin-level integrated resource calendar (Rooms/Vehicles/Staff).
     * Future path: /schedules/resource/integrated-calendar
     * Visibility: Admin Tier only.
     */
    INTEGRATED_CALENDAR: (_isFieldStaffShell: boolean): NavItem => ({
      label: 'リソースカレンダー',
      to: '/admin/integrated-resource-calendar',
      isActive: (pathname: string) => pathname === '/admin/integrated-resource-calendar',
      icon: undefined,
      audience: NAV_AUDIENCE.admin as NavAudience,
      group: 'schedules' as NavGroupKey,
      tier: 'admin' as const,
    }),
  },
};
