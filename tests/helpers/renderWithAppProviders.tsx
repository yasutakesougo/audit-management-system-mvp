import { routerFutureFlags } from '@/app/routerFuture';
import { ToastProvider } from '@/hooks/useToast';
import type { FutureConfig } from '@remix-run/router';
import { render, type RenderResult } from '@testing-library/react';
import React, { StrictMode } from 'react';
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  type RouteObject
} from 'react-router-dom';

type Options = {
  /** Initial router entries (default: ['/']) */
  initialEntries?: string[];
  /** Additional child routes to register */
  routeChildren?: RouteObject[];
  /** Remix Router future configuration */
  future?: Partial<FutureConfig>;
  /** Enable HydrationHUD flags (sets localStorage/sessionStorage/env) */
  withHUD?: boolean;
};

type RenderWithAppProvidersResult = RenderResult & {
  /** Memory router instance for test navigation */
  router: ReturnType<typeof createMemoryRouter>;
};

/**
 * HudForTests を有効化するヘルパー
 *
 * NOTE: フラグのみ設定。実際のHUDコンポーネントはProviderツリーに含めない。
 * HUDのDOM要素を直接テストしたい場合は、専用のrenderWithHud()を検討。
 */
export function enableHudForTests(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('VITE_PREFETCH_HUD', '1');
      window.localStorage.setItem('VITE_E2E', '1');
      window.sessionStorage.setItem('prefetch:hud:visible', '1');
    } catch {
      // ignore storage errors (e.g. jsdom restrictions)
    }
  }
  process.env.VITE_PREFETCH_HUD = '1';
  process.env.PREFETCH_HUD = '1';
  process.env.VITE_E2E = '1';
}

export function renderWithAppProviders(ui: React.ReactNode, opts: Options = {}): RenderWithAppProvidersResult {
  const { initialEntries = ['/'], routeChildren = [], future, withHUD = false } = opts;
  if (withHUD) {
    enableHudForTests();
  }

  // Merge user-specified future flags with the project defaults used in production router
  const mergedFuture = { ...routerFutureFlags, ...(future ?? {}) } satisfies Partial<FutureConfig>;

  const routes: RouteObject[] = [
    {
      path: '/',
      element: <Outlet />,
      children: [{ index: true, element: <>{ui}</> }, ...routeChildren],
    },
  ];

  const router = createMemoryRouter(routes, {
    initialEntries,
    future: mergedFuture,
  });

  const utils = render(
    <StrictMode>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </StrictMode>
  );

  return { ...utils, router };
}
