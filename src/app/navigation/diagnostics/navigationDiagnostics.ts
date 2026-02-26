import { createFooterActions } from '@/app/config/footerActionsConfig';
import { createNavItems, NavAudience } from '@/app/config/navigationConfig';
import { APP_ROUTE_PATHS } from '@/app/routes/appRoutePaths';
import { isDynamicPattern, matchDynamic, normalizePath, normalizeRouterPath, ORPHAN_ALLOWLIST } from './pathUtils';

export type DiagnosticParams = {
  role: NavAudience;
  schedulesEnabled: boolean;
  complianceFormEnabled: boolean;
  icebergPdcaEnabled: boolean;
  staffAttendanceEnabled: boolean;
  searchText?: string;
};

export type FlattenedNavItem = {
  source: 'side' | 'footer';
  group?: string;
  label: string;
  href: string;
  visible: boolean;
  reason: string;
};

export type DiagnosticsResult = {
  navItemsFlat: FlattenedNavItem[];
  footerItemsFlat: FlattenedNavItem[];
  missingInRouter: string[];
  orphanRoutes: string[];
  allowlistedOrphans: string[];
  counts: {
    routerPaths: number;
    sideNavItems: number;
    footerItems: number;
    missingInRouter: number;
    orphanRoutes: number;
    allowlistedOrphans: number;
  };
};

/**
 * Computes navigation exposure diagnostics based on current role and feature flags.
 * Pure function, easily unit testable.
 */
export const computeNavigationDiagnostics = (params: DiagnosticParams): DiagnosticsResult => {
  const { role, searchText = '', ...flags } = params;

  // 1. Fetch side nav items directly matching the configuration
  const sideNavConfig = createNavItems({
    dashboardPath: '/dashboard',
    currentRole: role,
    isAdmin: role === 'admin',
    authzReady: true,
    navAudience: role,
    skipLogin: true, // Always expose to evaluation
    ...flags,
  });

  const sideHrefs = new Set<string>();
  const navItemsFlat: FlattenedNavItem[] = [];

  for (const item of sideNavConfig) {
    if (!item.to) continue;
    const href = normalizePath(item.to);

    // Simplistic visibility based on audience config in item
    const audienceList = Array.isArray(item.audience) ? item.audience : [item.audience ?? 'all'];
    const visible = audienceList.includes('all') || role === 'admin' || audienceList.includes(role);

    if (visible) {
      sideHrefs.add(href);
    }

    // Filter by text if applicable
    if (!searchText || item.label.includes(searchText) || href.includes(searchText)) {
      navItemsFlat.push({
        source: 'side',
        group: 'various', // We're bypassing pickGroup for simplicity here, just tracking flat
        label: item.label,
        href,
        visible,
        reason: `Audience: ${audienceList.join(',')}`,
      });
    }
  }

  // 2. Fetch footer elements
  const footerConfig = createFooterActions({
    schedulesEnabled: flags.schedulesEnabled,
  });

  const footerHrefs = new Set<string>();
  const footerItemsFlat: FlattenedNavItem[] = [];

  for (const item of footerConfig) {
    if (!item.to) continue;
    const href = normalizePath(item.to);
    footerHrefs.add(href);

    if (!searchText || item.label.includes(searchText) || href.includes(searchText)) {
      footerItemsFlat.push({
        source: 'footer',
        label: item.label,
        href,
        visible: true, // AppShell actions are visible if created
        reason: 'Feature Flag / Static',
      });
    }
  }

  // 3. Router paths definition
  const routerPathSet = new Set(APP_ROUTE_PATHS.map(normalizeRouterPath));

  // 4. Analysis: missing in router vs orphans
  const missingInRouter: string[] = [];

  for (const href of sideHrefs) {
    if (href.startsWith('/nurse')) continue; // nested slice out of scope
    if (!routerPathSet.has(href)) {
      missingInRouter.push(href);
    }
  }

  for (const href of footerHrefs) {
    if (!routerPathSet.has(href)) {
      missingInRouter.push(href);
    }
  }

  const orphanRoutes: string[] = [];
  const allowlistedOrphans: string[] = [];

  for (const rPath of routerPathSet) {
    // Determine exposure matching exact or dynamic patterns
    let isExposed = sideHrefs.has(rPath) || footerHrefs.has(rPath);

    // Check dynamic routes in allowlist
    let isAllowlisted = ORPHAN_ALLOWLIST.has(rPath);

    // If not direct hit, see if a dynamic allowlist pattern catches it
    if (!isAllowlisted && Array.from(ORPHAN_ALLOWLIST).some(p => isDynamicPattern(p) && matchDynamic(rPath, p))) {
      isAllowlisted = true;
    }

    if (!isExposed) {
      // Check if some Nav href matches this dynamic router path (e.g. /meeting-minutes/:id matched by /meeting-minutes/new?category=...)
      // But query params are usually removed. However, maybe the path is entirely dynamic.
      isExposed = Array.from(sideHrefs).some(href => isDynamicPattern(rPath) && matchDynamic(href, rPath));
      if (!isExposed) {
        isExposed = Array.from(footerHrefs).some(href => isDynamicPattern(rPath) && matchDynamic(href, rPath));
      }
    }

    if (!isExposed) {
      if (isAllowlisted) {
        allowlistedOrphans.push(rPath);
      } else {
        orphanRoutes.push(rPath);
      }
    }
  }

  return {
    navItemsFlat,
    footerItemsFlat,
    missingInRouter,
    orphanRoutes,
    allowlistedOrphans,
    counts: {
      routerPaths: routerPathSet.size,
      sideNavItems: sideHrefs.size,
      footerItems: footerHrefs.size,
      missingInRouter: missingInRouter.length,
      orphanRoutes: orphanRoutes.length,
      allowlistedOrphans: allowlistedOrphans.length,
    }
  };
};
