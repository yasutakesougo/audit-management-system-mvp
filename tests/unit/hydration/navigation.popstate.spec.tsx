import { act, cleanup, render, waitFor } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RouteHydrationListener from '@/hydration/RouteHydrationListener';
import { getHydrationSpans, resetHydrationSpans } from '@/lib/hydrationHud';

const routes = [
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
  beforeEach(() => {
    vi.useFakeTimers();
    resetHydrationSpans();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    resetHydrationSpans();
  });

  it('records spans with source="history" when navigating via popstate', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/schedules/week', '/schedules/day'],
      initialIndex: 1,
    });

    render(<RouterProvider router={router} />);

    await act(async () => {
      await router.navigate(-1);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const historySpans = await waitFor(() => {
      const spans = getHydrationSpans();
      const filtered = spans.filter((span) => {
        const meta = (span.meta ?? {}) as Record<string, unknown>;
        return meta.source === 'history';
      });
      expect(filtered.length).toBeGreaterThan(0);
      return filtered;
    });

    const lastHistorySpan = historySpans.at(-1);
    const meta = (lastHistorySpan?.meta ?? {}) as Record<string, unknown>;
    expect(meta).toMatchObject({ source: 'history', status: 'completed', path: '/schedules/week' });
  });
});
