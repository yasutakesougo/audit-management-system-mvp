import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TESTIDS } from '../../src/testids';

const spFetchMock = vi.fn(async () => ({ ok: true }));
const signInMock = vi.fn(async () => undefined);
const signOutMock = vi.fn(async () => undefined);

vi.mock('@/lib/spClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/spClient')>('@/lib/spClient');
  return {
    ...actual,
    useSP: () => ({ spFetch: spFetchMock }),
  };
});

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({
    signIn: signInMock,
    signOut: signOutMock,
    isAuthenticated: false,
    account: null,
    shouldSkipLogin: true,
    loading: false,
  }),
}));

vi.mock('@/features/records/RecordList', () => ({
  __esModule: true,
  default: () => <h1>記録管理トップ</h1>,
}));

vi.mock('@/features/compliance-checklist/ChecklistPage', () => ({
  __esModule: true,
  default: () => <h1>自己点検ビュー</h1>,
}));

vi.mock('@/features/audit/AuditPanel', () => ({
  __esModule: true,
  default: () => <h1 data-testid="audit-heading">監査ログビュー</h1>,
}));

vi.mock('@/features/users', () => ({
  __esModule: true,
  UsersPanel: () => <h1>利用者ビュー</h1>,
}));

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: () => ({
    isAdmin: true,
    isReception: false,
    ready: true,
    reason: undefined,
  }),
}));

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    shouldSkipLogin: () => true,
  };
});

vi.mock('@/pages/DailyPage', () => ({
  __esModule: true,
  default: () => <h1 data-testid="daily-page-root" />,
}));

vi.mock('@/pages/DailyRecordMenuPage', () => ({
  __esModule: true,
  default: () => <h1 data-testid="daily-hub-root" />,
}));

vi.mock('@/features/daily/TableDailyRecordPage', () => ({
  __esModule: true,
  default: () => <h1 data-testid="daily-table-root" />,
}));

vi.mock('@/pages/DashboardPage', () => ({
  __esModule: true,
  default: () => <h1 data-testid="dashboard-root">ダッシュボード</h1>,
  StaffDashboardPage: () => <h1 data-testid="dashboard-root">ダッシュボード</h1>,
  AdminDashboardPage: () => <h1 data-testid="dashboard-root">ダッシュボード</h1>,
}));

vi.mock('@/stores/useUsers', () => ({
  useUsers: () => ({ data: [], error: null, loading: false, reload: vi.fn() }),
}));

vi.mock('@/stores/useStaff', () => ({
  useStaff: () => ({ data: [], error: null, loading: false, reload: vi.fn() }),
}));

vi.mock('@/features/schedules/useSchedulesToday', () => ({
  useSchedulesToday: () => ({
    data: [],
    loading: false,
    error: null,
    dateISO: '2024-01-01',
  }),
}));

import App from '../../src/App';

/**
 * Router Future Flags スモークテスト
 *
 * 目的: router-future-flags.ts で設定されたReact Router v7 future flags が
 * 本番同等環境で正常に動作することを検証
 *
 * テスト内容:
 * - App全体の主要ルート間でのナビゲーション成功
 * - Future flags有効状態での画面遷移の安定性
 * - 想定外のAPI呼び出し・認証アクションの発生しないことの確認
 *
 * モック戦略:
 * - 各画面コンポーネントを <h1> スタブに差し替えて高速化
 * - useAuth でログイン済み状態をシミュレート + shouldSkipLogin: true
 * - spClient, stores (users/staff/schedules) をモック化
 *
 * 改善点:
 * - userEvent使用でより現実的なユーザー操作をシミュレート
 * - 認証・API呼び出しの副作用検証追加
 * - マジックインデックス [1] の課題は data-testid 追加で将来解決予定
 */

describe('router future flags smoke', () => {
  beforeEach(async () => {
    localStorage.setItem('skipLogin', '1');
    await Promise.resolve();
    spFetchMock.mockClear();
    signInMock.mockClear();
    signOutMock.mockClear();
  });

  // NOTE: router-future-flags.ts の global mock で React Router v7 future flags を有効化した状態で、
  // App 全体の主要ルートが正常に遷移できることのスモークテスト。
  it('navigates across primary routes with v7 flags enabled', async () => {
    const user = userEvent.setup();
    render(<App />);
    const arrivalOptions = { timeout: process.env.CI ? 15_000 : 8_000 };

    const openDrawerIfPossible = async () => {
      const openButton =
        screen.queryByTestId(TESTIDS['nav-open']) ?? screen.queryByTestId('desktop-nav-open');
      if (!openButton) {
        return;
      }
      await user.click(openButton);
      if (openButton.hasAttribute('aria-expanded')) {
        await waitFor(
          () => expect(openButton).toHaveAttribute('aria-expanded', 'true'),
          { timeout: process.env.CI ? 5_000 : 2_000 },
        );
      }
    };

    const ensureNavItem = async (testId: string) => {
      await openDrawerIfPossible();
      const navItem = (screen.queryByTestId(testId) ??
        (await screen.findByTestId(testId, arrivalOptions))) as HTMLElement;
      await waitFor(
        () => expect(navItem).toBeVisible(),
        { timeout: process.env.CI ? 5_000 : 2_000 },
      );
      return navItem;
    };

    const navigateToPath = (path: string) => {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    };

    // 初期表示: ホーム画面の確認
    expect(await screen.findByTestId('dashboard-root', arrivalOptions)).toBeInTheDocument();

    // ナビゲーション経路のテスト: ホーム → 監査ログ → 日次記録 → 自己点検 → ホーム

    await user.click(await ensureNavItem(TESTIDS.nav.audit));
    // Ensure router observes location updates in JSDOM when the nav item is an anchor.
    navigateToPath('/audit');
    await waitFor(
      () => expect(window.location.pathname).toBe('/audit'),
      { timeout: process.env.CI ? 15_000 : 8_000 },
    );
    expect(screen.queryByText(/権限を確認中/)).not.toBeInTheDocument();
    expect(await screen.findByTestId(TESTIDS['audit-heading'], arrivalOptions)).toBeInTheDocument();

    await user.click(await ensureNavItem(TESTIDS.nav.daily));
    expect(await screen.findByTestId('daily-hub-root', arrivalOptions)).toBeInTheDocument();

    await user.click(await ensureNavItem(TESTIDS.nav.checklist));
    expect(await screen.findByText('自己点検ビュー', arrivalOptions)).toBeInTheDocument();

    // nav-dashboard は常設UI契約ではないため、戻りは history 遷移を契約にする
    navigateToPath('/');
    expect(await screen.findByTestId('dashboard-root', arrivalOptions)).toBeInTheDocument();

    // 副作用の検証: ルート遷移での想定外のAPI呼び出しや認証アクションが発生していないことを確認
    const calls = (spFetchMock.mock.calls as unknown as any[]).map(([input]: any) =>
      typeof input === 'string' ? input : input instanceof Request ? (input as Request).url : String(input),
    );

    const currentUserCalls = calls.filter((u) => u.includes('/currentuser?$select=Id'));
    const nonCurrentUserCalls = calls.filter((u) => !u.includes('/currentuser?$select=Id'));

    expect(currentUserCalls.length).toBeLessThanOrEqual(1);
    expect(nonCurrentUserCalls).toHaveLength(0);
    expect(signInMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  }, 15_000);
});
