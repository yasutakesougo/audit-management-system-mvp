import RequireAudience from '@/components/RequireAudience';
import type React from 'react';
import type { RouteObject } from 'react-router-dom';
import HubLanding from './HubLanding';
import { getHubRequiredRole, getHubRootPath } from './hubDefinitions';
import type { HubId } from './hubTypes';

const normalizeRoutePath = (rootPath: string): string => rootPath.replace(/^\//, '');

export const withHubAudienceGuard = (
  hubId: HubId,
  element: React.ReactNode,
): React.ReactElement => (
  <RequireAudience requiredRole={getHubRequiredRole(hubId)}>{element}</RequireAudience>
);

export const createStandaloneHubLandingRoute = (hubId: HubId): RouteObject => ({
  path: normalizeRoutePath(getHubRootPath(hubId)),
  element: withHubAudienceGuard(hubId, <HubLanding hubId={hubId} />),
});
