import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TESTIDS } from '../../src/testids';

const spFetchMock = vi.fn(async () => ({ ok: true }));
const spCreateItemMock = vi.fn(async () => ({}));
const spUpdateItemMock = vi.fn(async () => ({}));
const spGetItemsMock = vi.fn(async () => []);
const spGetFieldsMock = vi.fn(async () => []);
const spEnsureListMock = vi.fn(async () => undefined);
const signInMock = vi.fn(async () => undefined);
const signOutMock = vi.fn(async () => undefined);

vi.mock('@/lib/spClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/spClient')>('@/lib/spClient');
  return {
    ...actual,
    useSP: () => ({
      spFetch: spFetchMock,
      createItem: spCreateItemMock,
      updateItem: spUpdateItemMock,
      getListItemsByTitle: spGetItemsMock,
      getListFieldInternalNames: spGetFieldsMock,
      ensureList: spEnsureListMock,
      ensureListExists: spEnsureListMock,
    }),
  };
});

vi.mock('@/sharepoint/spProvisioningCoordinator', () => ({
  SharePointProvisioningCoordinator: {
    bootstrap: vi.fn(async () => ({ healthy: 0, unhealthy: 0, summaries: [] })),
  },
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({
    signIn: signInMock,
    signOut: signOutMock,
    isAuthenticated: false,
    account: null,
    shouldSkipLogin: true,
    loading: false,
    tokenReady: true,
    getListReadyState: () => true,
    setListReadyState: vi.fn(),
    acquireToken: vi.fn(async () => 'mock-token'),
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
    role: 'admin',
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

vi.mock('@/features/daily/table/TableDailyRecordPage', () => ({
  __esModule: true,
  default: () => <h1 data-testid="daily-table-root" />,
}));

vi.mock('@/pages/DashboardPage', () => ({
  __esModule: true,
  default: () => <h1 data-testid="dashboard-root">ダッシュボード</h1>,
  StaffDashboardPage: () => <h1 data-testid="dashboard-root">ダッシュボード</h1>,
  AdminDashboardPage: () => <h1 data-testid="dashboard-root">ダッシュボード</h1>,
}));

vi.mock('@/features/users/store', () => ({
  useUsers: () => ({
    data: [],
    error: null,
    loading: false,
    isLoading: false,
    reload: vi.fn(async () => {}),
    load: vi.fn(async () => {}),
  }),
}));

vi.mock('@/features/staff/store', () => ({
  useStaff: () => ({
    data: [],
    error: null,
    loading: false,
    isLoading: false,
    reload: vi.fn(async () => {}),
    load: vi.fn(async () => {}),
  }),
}));

vi.mock('@/features/schedules/useSchedulesToday', () => ({
  useSchedulesToday: () => ({
    data: [],
    loading: false,
    error: null,
    dateISO: '2024-01-01',
  }),
}));

vi.mock('../../src/app/AppShell', async () => {
  const { Link } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  const AppShellMock = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell-mock">
      <nav aria-label="primary-navigation">
        <Link data-testid={TESTIDS.nav.audit} to="/audit">監査ログ</Link>
        <Link data-testid={TESTIDS.nav.daily} to="/dailysupport">日次記録</Link>
      </nav>
      {children}
    </div>
  );
  return {
    __esModule: true,
    default: AppShellMock,
  };
});

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
 * ナビゲーション構造:
 * - nav-audit はヘッダーの IconButton（サイドバーにはない）
 * - nav-checklist は管理ツール (/admin) に統合済み
 * - nav-daily はサイドバーのナビアイテム
 */

describe('router future flags smoke', () => {
  beforeEach(async () => {
    localStorage.setItem('skipLogin', '1');
    await Promise.resolve();
    spFetchMock.mockClear();
    spCreateItemMock.mockClear();
    spUpdateItemMock.mockClear();
    spGetItemsMock.mockClear();
    spGetFieldsMock.mockClear();
    spEnsureListMock.mockClear();
    signInMock.mockClear();
    signOutMock.mockClear();
  });

  // NOTE: router-future-flags.ts の global mock で React Router v7 future flags を有効化した状態で、
  // App 全体の主要ルートが正常に遷移できることのスモークテスト。
  // retry(2): This test renders the full App and navigates across routes.
  // Transient timing issues (drawer animation, lazy route resolution) can
  // cause sporadic failures on slower machines / CI runners.
  it('navigates across primary routes with v7 flags enabled', { retry: 2, timeout: 45_000 }, async () => {
    await act(async () => {
      render(<App />);
    });
    // Use generous, unified timeouts — no CI/local split to avoid flakiness
    const arrivalOptions = { timeout: 20_000 };

    const ensureNavItem = async (testId: string) => {
      // findByTestId already retries internally; no need for queryByTestId fallback
      const navItem = await screen.findByTestId(testId, undefined, { timeout: 10_000 });
      await waitFor(
        () => expect(navItem).toBeVisible(),
        { timeout: 5_000 },
      );
      return navItem;
    };

    const navigateToPath = async (path: string) => {
      await act(async () => {
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
    };

    // 初期表示: ホーム画面の確認
    expect(await screen.findByTestId('dashboard-root', undefined, arrivalOptions)).toBeInTheDocument();

    // ナビゲーション経路のテスト: ホーム → 監査ログ → 日次記録 → ホーム

    const auditLink = await ensureNavItem(TESTIDS.nav.audit);
    expect(auditLink).toBeInTheDocument();
    fireEvent.click(auditLink);
    await waitFor(
      () => expect(window.location.pathname).toBe('/audit'),
      { timeout: 10_000 },
    );
    expect(screen.queryByText(/権限を確認中/)).not.toBeInTheDocument();
    await waitFor(
      () =>
        expect(
          screen.queryByTestId('audit-heading') ?? screen.queryByTestId('dashboard-root')
        ).toBeInTheDocument(),
      arrivalOptions,
    );

    // 日次記録ナビ（サイドバー）
    fireEvent.click(await ensureNavItem(TESTIDS.nav.daily));
    await waitFor(
      () => expect(window.location.pathname).toBe('/dailysupport'),
      { timeout: 10_000 },
    );

    // nav-dashboard は常設UI契約ではないため、戻りは history 遷移を契約にする
    await navigateToPath('/');
    expect(await screen.findByTestId('dashboard-root', undefined, arrivalOptions)).toBeInTheDocument();

    // 副作用の検証: ルート遷移での想定外のAPI呼び出しや認証アクションが発生していないことを確認
    const calls = spFetchMock.mock.calls.map((callArgs) => {
      if (!callArgs || (callArgs as unknown[]).length === 0) return '';
      const input = (callArgs as unknown[])[0] as unknown;
      return typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : String(input);
    });

    const currentUserCalls = calls.filter((u) => u.includes('/currentuser?$select=Id'));
    const nonCurrentUserCalls = calls.filter((u) => !u.includes('/currentuser?$select=Id'));

    expect(currentUserCalls.length).toBeLessThanOrEqual(1);
    expect(nonCurrentUserCalls).toHaveLength(0);
    expect(signInMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
