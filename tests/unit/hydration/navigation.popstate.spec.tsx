import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom';

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
      window.dispatchEvent(new PopStateEvent('popstate'));
      await router.navigate(-1);
    });

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    const spans = getHydrationSpans();
    const historySpans = spans.filter((span) => {
      const meta = (span.meta ?? {}) as Record<string, unknown>;
      return meta.source === 'history';
    });

    expect(historySpans.length).toBeGreaterThan(0);

    const lastHistorySpan = historySpans.at(-1);
    const meta = (lastHistorySpan?.meta ?? {}) as Record<string, unknown>;
    expect(meta).toMatchObject({ source: 'history', status: 'completed', path: '/schedules/week' });
  });
});
