import { getHubRootPath, getStandaloneHubIds } from '@/app/hubs/hubDefinitions';
import { describe, expect, it } from 'vitest';
import { hubRoutes } from '../hubRoutes';

describe('hubRoutes', () => {
  it('builds standalone hub routes from hubDefinitions', () => {
    const expectedPaths = getStandaloneHubIds().map((hubId) =>
      getHubRootPath(hubId).replace(/^\//, ''),
    );

    expect(hubRoutes.map((route) => route.path)).toEqual(expectedPaths);
    expect(hubRoutes.every((route) => route.element)).toBe(true);
  });
});
