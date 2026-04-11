/**
 * Application Router — Thin Orchestrator
 *
 * Composes domain-specific route modules into the final route tree.
 * All lazy-loaded components and Suspense wrappers live in ./routes/lazyPages.tsx.
 * Route definitions are grouped by domain in ./routes/*Routes.tsx.
 */
import { nurseRoutes } from '@/features/nurse/routes/NurseRoutes';
import { Outlet, createBrowserRouter, type RouteObject } from 'react-router-dom';
import { ComplianceBadgeProvider } from '@/features/regulatory/ComplianceBadgeProvider';
import AppShell from './AppShell';
import { routerFutureFlags } from './routerFuture';

// ── Domain route modules ─────────────────────────────────────────────────
import { adminRoutes } from './routes/adminRoutes';
import { analysisRoutes } from './routes/analysisRoutes';
import { callLogRoutes } from './routes/callLogRoutes';
import { dailyRoutes } from './routes/dailyRoutes';
import { dashboardRoutes } from './routes/dashboardRoutes';
import { hubRoutes } from './routes/hubRoutes';
import { ibdRoutes } from './routes/ibdRoutes';
import { recordRoutes } from './routes/recordRoutes';
import { safetyRoutes } from './routes/safetyRoutes';
import { scheduleRoutes } from './routes/scheduleRoutes';
import { supportPlanRoutes } from './routes/supportPlanRoutes';
import { transportRoutes } from './routes/transportRoutes';

// ── Route composition ────────────────────────────────────────────────────

const childRoutes: RouteObject[] = [
  ...dashboardRoutes,
  ...hubRoutes,
  ...dailyRoutes,
  ...recordRoutes,
  ...analysisRoutes,
  ...supportPlanRoutes,
  ...ibdRoutes,
  ...adminRoutes,
  ...safetyRoutes,
  ...scheduleRoutes,
  ...transportRoutes,
  ...callLogRoutes,
  nurseRoutes(),
];

export const routes: RouteObject[] = [
  {
    element: (
      <ComplianceBadgeProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </ComplianceBadgeProvider>
    ),
    children: childRoutes,
  },
];

export const router = createBrowserRouter(routes, {
  future: routerFutureFlags,
});
