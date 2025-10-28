import React, { StrictMode } from 'react';
import { render } from '@testing-library/react';
import {
  RouterProvider,
  createMemoryRouter,
  Outlet,
  type RouteObject
} from 'react-router-dom';
import type { FutureConfig } from '@remix-run/router';
import { ToastProvider } from '@/hooks/useToast';

type Options = {
  initialEntries?: string[];
  routeChildren?: RouteObject[];
  future?: Partial<FutureConfig>;
  withHUD?: boolean;
};

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

export function renderWithAppProviders(ui: React.ReactNode, opts: Options = {}) {
  const { initialEntries = ['/'], routeChildren = [], future, withHUD = false } = opts;
  if (withHUD) {
    enableHudForTests();
  }

  const routes: RouteObject[] = [
    {
      path: '/',
      element: <Outlet />,
      children: [{ index: true, element: <>{ui}</> }, ...routeChildren],
    },
  ];

  const router = createMemoryRouter(routes, {
    initialEntries,
    future,
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
