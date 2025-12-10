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

    // 初期ハイドレーションのsettle待ち
    await act(async () => {
      await wait(160);
    });

    // Hash変更前の'/schedules/day'ルートのspan数を記録
    const before = getHydrationSpans().filter((span) => span.id === 'route:schedules:day').length;

    // Hash付きの同一パスへ遷移（/schedules/day#section-1）
    await act(async () => {
      await router.navigate('/schedules/day#section-1');
      await wait(160);
    });

    // Hash変更後も同じルートのspan数が変わらないことを確認
    const after = getHydrationSpans().filter((span) => span.id === 'route:schedules:day').length;
    expect(after, 'Hash変更だけでは新しいハイドレーションspanを作成してはいけない').toBe(before);
  });

  it('does not create any new spans when only the hash changes', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/schedules/day'],
    });

    render(<RouterProvider router={router} />);

    // 初期ハイドレーションのsettle待ち
    await act(async () => {
      await wait(160);
    });

    // Hash変更前の全span数を記録
    const spansBefore = getHydrationSpans();

    // Hash付きの同一パスへ遷移
    await act(async () => {
      await router.navigate('/schedules/day#section-1');
      await wait(160);
    });

    // Hash変更後も全span数が変わらないことを確認
    const spansAfter = getHydrationSpans();
    expect(spansAfter.length, 'Hash変更だけでは全体のspan数も増加してはいけない').toBe(spansBefore.length);
  });
});
