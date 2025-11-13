import { routerFutureFlags } from '@/app/routerFuture';
import type { RouterProviderProps } from 'react-router-dom';
import { vi } from 'vitest';

// Ensure React Router future flags are consistently applied across tests to avoid noisy warnings.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();

  const createMemoryRouterWithFuture: typeof actual.createMemoryRouter | undefined = actual.createMemoryRouter
    ? (
        routes: Parameters<typeof actual.createMemoryRouter>[0],
        options?: Parameters<typeof actual.createMemoryRouter>[1]
      ) => {
        const mergedOptions: Parameters<typeof actual.createMemoryRouter>[1] = {
          ...(options ?? {}),
          future: {
            ...routerFutureFlags,
            ...(options?.future ?? {}),
          },
        };

        return actual.createMemoryRouter(routes, mergedOptions);
      }
    : undefined;

  const RouterProvider: typeof actual.RouterProvider = (props: RouterProviderProps) => {
    const future = {
      ...routerFutureFlags,
      ...(props.future ?? {}),
    };

    return actual.RouterProvider({ ...props, future });
  };

  return {
    ...actual,
    RouterProvider,
    createMemoryRouter: createMemoryRouterWithFuture ?? actual.createMemoryRouter,
  };
});
