import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
    children: [{ path: 'schedules/day', element: <div>day</div> }],
  },
];

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('RouteHydrationListener hash suppression', () => {
  beforeEach(() => {
    resetHydrationSpans();
  });

  afterEach(() => {
    cleanup();
    resetHydrationSpans();
  });

  it('does not open a new span when only the hash changes', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/schedules/day'],
    });

    render(<RouterProvider router={router} />);

    await act(async () => {
      await wait(160);
    });

    const before = getHydrationSpans().filter((span) => span.id === 'route:schedules:week').length;

    await act(async () => {
      await router.navigate('/schedules/day#section-1');
      await wait(160);
    });

    const after = getHydrationSpans().filter((span) => span.id === 'route:schedules:week').length;
    expect(after).toBe(before);
  });
});
