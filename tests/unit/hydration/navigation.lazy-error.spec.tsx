import { act, cleanup, render } from '@testing-library/react';
import React from 'react';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RouteHydrationListener, { RouteHydrationErrorBoundary } from '@/hydration/RouteHydrationListener';
import * as hydrationHud from '@/lib/hydrationHud';

const { getHydrationSpans, resetHydrationSpans, subscribeHydrationSpans } = hydrationHud;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const lazyModule = vi.fn<() => Promise<{ default: React.ComponentType }>>();
const LazyAdminPage = React.lazy(lazyModule);

const routes = [
  {
    path: '/',
    element: (
      <RouteHydrationListener>
        <RouteHydrationErrorBoundary>
          <React.Suspense fallback={<div>loading...</div>}>
            <Outlet />
          </React.Suspense>
        </RouteHydrationErrorBoundary>
      </RouteHydrationListener>
    ),
    children: [
      { index: true, element: <div>home</div> },
  { path: 'admin/templates', element: <LazyAdminPage /> },
    ],
  },
];

type SnapshotEntry = {
  id: string;
  status?: string;
  reason?: string;
};

describe('RouteHydrationListener lazy-load error handling', () => {
  beforeEach(() => {
    resetHydrationSpans();
    lazyModule.mockReset();
  });

  afterEach(() => {
    cleanup();
    resetHydrationSpans();
  });

  it('finalizes the pending span with an error status and recovers on the next navigation', async () => {
    const error = new Error('boom');
    lazyModule.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(error), 0);
        })
    );
    lazyModule.mockImplementation(() => Promise.resolve({ default: () => <div>day-ok</div> }));

    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    });

    const snapshots: SnapshotEntry[][] = [];
    const unsubscribe = subscribeHydrationSpans((spans) => {
      snapshots.push(
        spans.map((span) => {
          const meta = (span.meta ?? {}) as Record<string, unknown>;
          return {
            id: span.id,
            status: typeof meta.status === 'string' ? meta.status : undefined,
            reason: typeof meta.reason === 'string' ? meta.reason : undefined,
          } satisfies SnapshotEntry;
        })
      );
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(<RouterProvider router={router} />);

      await act(async () => {
        await delay(20);
      });

      await act(async () => {
        await router.navigate('/admin/templates').catch(() => undefined);
      });

      await expect
        .poll(() => {
          const span = getHydrationSpans().find((item) => item.id === 'route:admin:templates');
          if (!span) {
            return null;
          }
          const meta = (span.meta ?? {}) as Record<string, unknown>;
          return {
            status: typeof meta.status === 'string' ? meta.status : '',
            reason: typeof meta.reason === 'string' ? meta.reason : '',
            error: typeof span.error === 'string' ? span.error : '',
          };
        }, { timeout: 1000 })
        .toEqual(expect.objectContaining({ status: 'error', reason: 'lazy-import' }));

      const spansAfterError = getHydrationSpans();
      const adminSpan = spansAfterError.find((span) => span.id === 'route:admin:templates');
      expect(adminSpan).toBeDefined();
      expect(typeof adminSpan?.error === 'string' ? adminSpan?.error : '').toContain('boom');

      const flattened = snapshots.flat();
      expect(
        flattened.some(
          (entry) => entry.id === 'route:admin:templates' && entry.status === 'error' && entry.reason === 'lazy-import'
        )
      ).toBe(true);

      await act(async () => {
        await router.navigate('/');
        await delay(200);
      });

      const spansAfterRecovery = getHydrationSpans();
      const dashboardSpan = spansAfterRecovery.find((span) => span.id === 'route:dashboard');
      expect(dashboardSpan).toBeDefined();
      const dashboardMeta = (dashboardSpan?.meta ?? {}) as Record<string, unknown>;
      expect(['pending', 'completed']).toContain(dashboardMeta.status);
    } finally {
      consoleErrorSpy.mockRestore();
      unsubscribe();
    }
  });
});
