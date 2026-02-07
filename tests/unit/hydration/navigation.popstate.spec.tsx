import { act, cleanup, render, waitFor } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getHydrationSpans, resetHydrationSpans } from '@/lib/hydrationHud';

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
      { path: 'schedules/week', element: <div>week</div> },
      { path: 'schedules/day', element: <div>day</div> },
    ],
  },
];

describe('RouteHydrationListener popstate handling', () => {
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

  it('records spans with source="history" when navigating via popstate', async () => {
    const router = createMemoryRouter(buildRoutes(RouteHydrationListener), {
      initialEntries: ['/schedules/week', '/schedules/day'],
      initialIndex: 1,
    });

    render(<RouterProvider router={router} />);

    await act(async () => {
      await router.navigate(-1);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/schedules/week');
    }, { timeout: 5_000 });

    const historySpans = await waitFor(() => {
      const spans = getHydrationSpans();
      const filtered = spans.filter((span) => {
        const meta = (span.meta ?? {}) as Record<string, unknown>;
        return meta.source === 'history';
      });
      expect(filtered.length).toBeGreaterThan(0);
      return filtered;
    }, { timeout: 10_000 });

    const lastHistorySpan = historySpans.at(-1);
    const meta = (lastHistorySpan?.meta ?? {}) as Record<string, unknown>;
    expect(meta.source).toBe('history');
    expect(meta.path).toBe('/schedules/week');
    expect(['pending', 'completed']).toContain(meta.status);
  });
});
