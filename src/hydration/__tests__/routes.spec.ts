import { describe, expect, it } from 'vitest';
import { getUnmatchedHydrationKeys, HYDRATION_KEYS, resolveHydrationEntry, type HydrationRouteId } from '../routes';

describe('hydration/routes', () => {
  describe('resolveHydrationEntry', () => {
    it('should match dashboard routes', () => {
      expect(resolveHydrationEntry('/')).toEqual(HYDRATION_KEYS.dashboard);
      expect(resolveHydrationEntry('')).toEqual(HYDRATION_KEYS.dashboard);
      expect(resolveHydrationEntry('/dashboard')).toEqual(HYDRATION_KEYS.dashboard);
    });

    it('should match admin dashboard route', () => {
      expect(resolveHydrationEntry('/admin/dashboard')).toEqual(HYDRATION_KEYS.adminDashboard);
    });

    it('should match admin integrated resource calendar route', () => {
      expect(resolveHydrationEntry('/admin/integrated-resource-calendar')).toEqual(
        HYDRATION_KEYS.adminIntegratedResourceCalendar,
      );
    });

    it('should match admin management routes', () => {
      expect(resolveHydrationEntry('/admin/templates')).toEqual(HYDRATION_KEYS.adminTemplates);
      expect(resolveHydrationEntry('/admin/step-templates')).toEqual(HYDRATION_KEYS.adminSteps);
      expect(resolveHydrationEntry('/admin/individual-support')).toEqual(
        HYDRATION_KEYS.adminIndividualSupport,
      );
    });

    it('should match handoff timeline route', () => {
      expect(resolveHydrationEntry('/handoff-timeline')).toEqual(HYDRATION_KEYS.handoffTimeline);
    });

    it('should match schedules routes with query parameters', () => {
      expect(resolveHydrationEntry('/schedules', '?view=day')).toEqual(HYDRATION_KEYS.schedulesDay);
      expect(resolveHydrationEntry('/schedules', '?view=week')).toEqual(HYDRATION_KEYS.schedulesWeek);
      expect(resolveHydrationEntry('/schedules')).toEqual(HYDRATION_KEYS.schedulesWeek);
    });

    it('should handle path normalization', () => {
      expect(resolveHydrationEntry('/SCHEDULES/')).toEqual(HYDRATION_KEYS.schedulesWeek);
      expect(resolveHydrationEntry('schedules')).toEqual(HYDRATION_KEYS.schedulesWeek);
    });

    it('should match specific routes in correct order', () => {
      expect(resolveHydrationEntry('/schedules/month')).toEqual(HYDRATION_KEYS.schedulesMonth);
      expect(resolveHydrationEntry('/schedules/create')).toEqual(HYDRATION_KEYS.schedulesCreate);
      expect(resolveHydrationEntry('/admin/step-templates')).toEqual(HYDRATION_KEYS.adminSteps);
    });

    it('should map day-specific schedules path', () => {
      expect(resolveHydrationEntry('/schedules/day')).toEqual(HYDRATION_KEYS.schedulesDay);
    });

    it('should return null for unmatched paths', () => {
      expect(resolveHydrationEntry('/unknown-path')).toBeNull();
      expect(resolveHydrationEntry('/api/data')).toBeNull();
    });
  });

  describe('getUnmatchedHydrationKeys', () => {
    it('should detect unmatched hydration keys', () => {
      const unmatched = getUnmatchedHydrationKeys();

      expect(unmatched).toHaveLength(0);
    });

    it('should not include matched keys', () => {
      const unmatched = getUnmatchedHydrationKeys();

      // These should all be matched by MATCHERS
      expect(unmatched).not.toContain('dashboard');
      expect(unmatched).not.toContain('schedulesWeek');
      expect(unmatched).not.toContain('audit');
    });
  });

  describe('HydrationRouteId type', () => {
    it('should include all route IDs from HYDRATION_KEYS', () => {
      // Type test - this should compile without errors
      const routeIds: HydrationRouteId[] = [
        'route:dashboard',
        'route:audit',
        'route:admin:dashboard'
      ];

      expect(routeIds).toHaveLength(3);
    });
  });

  describe('Budget validation', () => {
    it('should have reasonable budget values', () => {
      Object.values(HYDRATION_KEYS).forEach(entry => {
        expect(entry.budget).toBeGreaterThan(0);
        expect(entry.budget).toBeLessThan(500); // Reasonable upper limit
      });
    });

    it('should have higher budgets for complex pages', () => {
      // Schedule pages should have higher budgets than simple pages
      expect(HYDRATION_KEYS.schedulesMonth.budget).toBeGreaterThan(HYDRATION_KEYS.dashboard.budget);
      expect(HYDRATION_KEYS.schedulesWeek.budget).toBeGreaterThan(HYDRATION_KEYS.audit.budget);
    });
  });

  describe('Route ID consistency', () => {
    it('should follow consistent ID naming patterns', () => {
      Object.values(HYDRATION_KEYS).forEach(entry => {
        expect(entry.id).toMatch(/^route:/);
        expect(entry.id).not.toContain(' '); // No spaces
        expect(entry.id).not.toContain('_'); // No underscores - use hyphens
      });
    });

    it('should have unique IDs', () => {
      const ids = Object.values(HYDRATION_KEYS).map(entry => entry.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});