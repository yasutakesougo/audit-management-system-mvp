import { createNavItems } from '@/app/config/navigationConfig';
import { router } from '@/app/router';
import type { RouteObject } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

describe('Navigation and Router integration', () => {
  it('all navigation items should resolve to a valid route', () => {
    // Generate nav items with all features enabled
    const navItems = createNavItems({
      dashboardPath: '/dashboard',
      currentRole: 'admin',
      schedulesEnabled: true,
      complianceFormEnabled: true,
      icebergPdcaEnabled: true,
      staffAttendanceEnabled: true,
      isAdmin: true,
      authzReady: true,
      navAudience: 'admin',
      skipLogin: true,
    });

    // Helper to recursively extract all configured route paths
    const extractPaths = (routesObj: RouteObject[], parentPath = '') => {
      const paths: string[] = [];
      for (const r of routesObj) {
        if (r.path) {
          const currentPath = r.path.startsWith('/') ? r.path : `${parentPath}/${r.path}`.replace(/\/+/g, '/');
          paths.push(currentPath);
        }
        if (r.children) {
          const currentPath = r.path && !r.path.startsWith('/') ? `${parentPath}/${r.path}` : (r.path || parentPath);
          paths.push(...extractPaths(r.children, currentPath));
        }
      }
      return paths;
    };

    // The main app routes are children of the root AppShell route
    const mainRoutes = router.routes[0].children || [];
    const configuredPaths = new Set(extractPaths(mainRoutes));

    for (const item of navItems) {
      if (item.to) {
        // remove query params for testing existing paths (e.g. /meeting-minutes/new?category=朝会)
        const toPath = item.to.split('?')[0];

        // Some nurse routes map inside nurse UI slice
        if (toPath.startsWith('/nurse')) {
          continue; // nurse uses nested routes internally
        }

        const exists = configuredPaths.has(toPath);
        expect(exists, `Route for nav item "${item.label}" (${item.to}) is missing in router`).toBe(true);
      }
    }
  });
});
