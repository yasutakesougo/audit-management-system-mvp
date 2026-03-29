/**
 * Hub routes for 7-screen IA.
 * Canonical top-level entries.
 */
import { getStandaloneHubIds } from '@/app/hubs/hubDefinitions';
import { createStandaloneHubLandingRoute } from '@/app/hubs/hubRouting';
import type { RouteObject } from 'react-router-dom';

export const hubRoutes: RouteObject[] = getStandaloneHubIds().map((hubId) =>
  createStandaloneHubLandingRoute(hubId),
);
