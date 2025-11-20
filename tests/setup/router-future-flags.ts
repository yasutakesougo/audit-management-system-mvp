import { routerFutureFlags } from '@/app/routerFuture';
import type { RouterProviderProps } from 'react-router-dom';
import { vi } from 'vitest';

/**
 * React Router future flags をテスト全体で一元管理するモック
 *
 * 目的:
 * - React Router future warning をテスト全体で統一的に抑制
 * - routerFutureFlags をすべてのテストで強制適用
 * - テスト側での future フラグ個別上書きも許可
 *
 * カバー範囲:
 * - RouterProvider (props.future に自動適用)
 * - createMemoryRouter (options.future に自動適用)
 * - 将来拡張: createBrowserRouter, createHashRouter など
 *
 * 使用例:
 * ```typescript
 * // テスト側で個別上書きも可能
 * const router = createMemoryRouter(routes, {
 *   future: { v7_skipActionErrorRevalidation: false }
 * });
 * ```
 */
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();

  // Helper: Future flags を安全にマージ
  const mergeFutureFlags = (userFuture?: Record<string, boolean>) => ({
    ...routerFutureFlags,
    ...(userFuture ?? {}),
  });

  const createMemoryRouterWithFuture: typeof actual.createMemoryRouter | undefined = actual.createMemoryRouter
    ? (
        routes: Parameters<typeof actual.createMemoryRouter>[0],
        options?: Parameters<typeof actual.createMemoryRouter>[1]
      ) => {
        const mergedOptions: Parameters<typeof actual.createMemoryRouter>[1] = {
          ...(options ?? {}),
          future: mergeFutureFlags(options?.future),
        };

        return actual.createMemoryRouter(routes, mergedOptions);
      }
    : undefined;

  // 将来拡張: createBrowserRouter 対応 (必要になったら有効化)
  // const createBrowserRouterWithFuture: typeof actual.createBrowserRouter | undefined = actual.createBrowserRouter
  //   ? (
  //       routes: Parameters<typeof actual.createBrowserRouter>[0],
  //       options?: Parameters<typeof actual.createBrowserRouter>[1]
  //     ) => {
  //       const mergedOptions: Parameters<typeof actual.createBrowserRouter>[1] = {
  //         ...(options ?? {}),
  //         future: mergeFutureFlags(options?.future),
  //       };

  //       return actual.createBrowserRouter(routes, mergedOptions);
  //     }
  //   : undefined;

  const RouterProvider: typeof actual.RouterProvider = (props: RouterProviderProps) => {
    const future = mergeFutureFlags(props.future);
    return actual.RouterProvider({ ...props, future });
  };

  return {
    ...actual,
    RouterProvider,
    createMemoryRouter: createMemoryRouterWithFuture ?? actual.createMemoryRouter,
    // 将来拡張用: createBrowserRouter など
    // createBrowserRouter: createBrowserRouterWithFuture ?? actual.createBrowserRouter,
  };
});
