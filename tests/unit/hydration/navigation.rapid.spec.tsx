import { act, cleanup, render } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as hydrationHud from '@/lib/hydrationHud';

const { getHydrationSpans, resetHydrationSpans, subscribeHydrationSpans } = hydrationHud;
type HydrationSpan = hydrationHud.HydrationSpan;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const buildRoutes = (
  RouteHydrationListener: typeof import('@/hydration/RouteHydrationListener').default
) => [
  {
    path: '/',
    element: (
      <RouteHydrationListener>
        <Outlet />
      </RouteHydrationListener>
    ),
    children: [
      { index: true, element: <div>root</div> },
      {
        path: 'schedules/week',
        loader: async () => {
          await delay(150);
          return null;
        },
        element: <div>week</div>,
      },
      {
        path: 'admin/templates',
        loader: async () => null,
        element: <div>admin templates</div>,
      },
    ],
  },
];

type SnapshotEntry = {
  id: string;
  status?: string;
  source?: string;
  path?: string;
};

describe('RouteHydrationListener rapid navigation handling', () => {
  let RouteHydrationListener: typeof import('@/hydration/RouteHydrationListener').default;

  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('@/hydration/RouteHydrationListener');
    return import('@/hydration/RouteHydrationListener').then((mod) => {
      RouteHydrationListener = mod.default;
      resetHydrationSpans();
    });
  });

  afterEach(() => {
    cleanup();
    resetHydrationSpans();
  });

  it('supersedes earlier spans when navigating rapidly to the same hydration key', async () => {
    const router = createMemoryRouter(buildRoutes(RouteHydrationListener), {
      initialEntries: ['/'],
    });

    const snapshots: SnapshotEntry[][] = [];
    const unsubscribe = subscribeHydrationSpans((spans: HydrationSpan[]) => {
      snapshots.push(
        spans.map((span) => {
          const meta = (span.meta ?? {}) as Record<string, unknown>;
          return {
            id: span.id,
            status: typeof meta.status === 'string' ? meta.status : undefined,
            source: typeof meta.source === 'string' ? meta.source : undefined,
            path: typeof meta.path === 'string' ? meta.path : undefined,
          } satisfies SnapshotEntry;
        })
      );
    });

    try {
      render(<RouterProvider router={router} />);

      await act(async () => {
        void router.navigate('/schedules/week?ts=1');
        await delay(40);
      });

      const flattenedAfterFirst = snapshots.flat();
      expect(flattenedAfterFirst.some((entry) => entry.id === 'route:schedules:week')).toBe(true);

      await act(async () => {
        await router.navigate('/admin/templates');
        await delay(320);
      });

      expect(router.state.location.pathname).toBe('/admin/templates');

      const flattened = snapshots.flat();
      expect(flattened.length).toBeGreaterThan(0);

      const supersededSnapshot = flattened.find(
        (entry) => entry.id === 'route:schedules:week' && entry.status === 'superseded'
      );
      expect(supersededSnapshot).toBeDefined();

      const currentSpan = getHydrationSpans().find((span) => span.id === 'route:admin:templates');
      const meta = (currentSpan?.meta ?? {}) as Record<string, unknown>;
      expect(['pending', 'completed']).toContain(meta.status);
      expect(meta.path).toBe('/admin/templates');
    } finally {
      unsubscribe();
    }
  });
});
