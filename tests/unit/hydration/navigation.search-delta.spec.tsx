import { act, cleanup, render } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
    children: [{ path: 'schedules/day', element: <div>day</div> }],
  },
];

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('RouteHydrationListener search delta coalescing', () => {
  beforeEach(() => {
    resetHydrationSpans();
  });

  afterEach(() => {
    cleanup();
    resetHydrationSpans();
  });

  it('coalesces search-only updates into a single active span', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/schedules/day?tab=1'],
    });

    render(<RouterProvider router={router} />);

    await act(async () => {
      await wait(160);
    });

    await act(async () => {
      await router.navigate('/schedules/day?tab=2');
    });

    await act(async () => {
      await wait(20);
      await router.navigate('/schedules/day?tab=3');
      await wait(200);
    });

    const spans = getHydrationSpans().filter((span) => span.id === 'route:schedules:week');
    expect(spans.length).toBeGreaterThanOrEqual(1);

    const last = spans.at(-1);
    expect(last?.meta && typeof last.meta === 'object' ? (last.meta as Record<string, unknown>).reason : undefined).toBe(
      'search'
    );
    expect(last?.meta && typeof last.meta === 'object' ? (last.meta as Record<string, unknown>).search : undefined).toContain(
      'tab=3'
    );
    expect(last?.meta && typeof last.meta === 'object' ? (last.meta as Record<string, unknown>).searchUpdated : undefined).toBe(
      true
    );
  });
});
