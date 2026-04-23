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

/**
 * Future path definitions for the Schedules hub.
 * These are not yet active but serve as the roadmap for domain-oriented routing.
 */
export const SCHEDULES_FUTURE_PATHS = {
  CALENDAR: {
    WEEK: '/schedules/calendar/week',
  },
  ASSIGNMENT: {
    TRANSPORT: '/schedules/assignment/transport',
    SUPPORT: '/schedules/assignment/support',
    STAFF: '/schedules/assignment/staff',
    RESOURCE: '/schedules/assignment/resource',
  },
  RESOURCE: {
    INTEGRATED: '/schedules/resource/integrated-calendar',
  },
} as const;

export const SCHEDULES_ROUTES = {
  // ─── 1. CALENDAR (View Focused) ──────────────────────────────────────────
  /**
   * CALENDAR Domain
   * 
   * Responsibility: Pure viewing and situational awareness of schedules.
   * Focuses on "What is happening?" without direct modification of assignments.
   */
  CALENDAR: {
    /**
     * Team-wide weekly schedule view.
     * Future path: SCHEDULES_FUTURE_PATHS.CALENDAR.WEEK
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
  /**
   * ASSIGNMENT Domain
   * 
   * Responsibility: Coordination, allocation, and conflict resolution of personnel and assets.
   * - Staff Assignment (Who does what?)
   * - Transport Assignment (Vehicle/Driver allocation)
   * - Support Assignment (Individual support matching)
   * - Resource Booking (Room/Equipment coordination)
   * 
   * Distinct from 'Execution' (Today Hub) which focus on real-time task performance.
   */
  ASSIGNMENT: {
    /**
     * Transport coordination and vehicle assignment.
     * Primary migration path for transport coordination logic.
     * Future path: SCHEDULES_FUTURE_PATHS.ASSIGNMENT.TRANSPORT
     * Visibility: Standard Staff only.
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

    /**
     * Future Candidate: Support Assignment (個別支援割当)
     * Responsibility: Matching users with specific support sessions.
     * Future path: SCHEDULES_FUTURE_PATHS.ASSIGNMENT.SUPPORT
     */

    /**
     * Future Candidate: Staff Assignment (職員配置調整)
     * Responsibility: Daily/Weekly shift allocation and task distribution.
     * Future path: SCHEDULES_FUTURE_PATHS.ASSIGNMENT.STAFF
     */

    /**
     * Future Candidate: Resource Booking Coordination (設備・居室予約調整)
     * Responsibility: Resolving room booking conflicts and equipment allocation.
     * Future path: SCHEDULES_FUTURE_PATHS.ASSIGNMENT.RESOURCE
     */
  },

  // ─── 3. RESOURCE (Asset Focused) ─────────────────────────────────────────
  /**
   * RESOURCE Domain
   * 
   * Responsibility: Management of physical infrastructure and asset availability.
   * - Room/Space availability
   * - Vehicle master schedules
   * - Equipment availability
   * 
   * Primarily administrative context.
   */
  RESOURCE: {
    /**
     * Admin-level integrated resource calendar (Rooms/Vehicles/Staff).
     * Future path: SCHEDULES_FUTURE_PATHS.RESOURCE.INTEGRATED
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
