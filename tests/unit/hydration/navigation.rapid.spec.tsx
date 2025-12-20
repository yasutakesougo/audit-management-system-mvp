import { act, cleanup, render, waitFor } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as hydrationHud from '@/lib/hydrationHud';

const { getHydrationSpans, resetHydrationSpans } = hydrationHud;

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

describe('RouteHydrationListener rapid navigation handling', () => {
  let RouteHydrationListener: typeof import('@/hydration/RouteHydrationListener').default;

  beforeEach(() => {
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

    render(<RouterProvider router={router} />);

    await act(async () => {
      await router.navigate('/schedules/week?ts=1');
    });

    await waitFor(() => {
      const spans = getHydrationSpans();
      expect(spans.some((span) => span.id === 'route:schedules:week')).toBe(true);
    }, { timeout: 10_000 });

    await act(async () => {
      await router.navigate('/admin/templates');
    });

    await waitFor(() => {
      const spans = getHydrationSpans();
      const superseded = spans.find((span) => {
        const meta = (span.meta ?? {}) as Record<string, unknown>;
        return span.id === 'route:schedules:week' && meta.status === 'superseded';
      });
      expect(superseded).toBeDefined();
      expect(router.state.location.pathname).toBe('/admin/templates');
    }, { timeout: 10_000 });

    const currentSpan = getHydrationSpans().find((span) => span.id === 'route:admin:templates');
    const meta = (currentSpan?.meta ?? {}) as Record<string, unknown>;
    expect(['pending', 'completed']).toContain(meta.status);
    expect(meta.path).toBe('/admin/templates');
  });
});
