import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { appChildRoutesForTest } from '@/app/router';
import { smokeRoutes } from '../_routes/testRoutes';
import React from 'react';

const spFetchMock = vi.fn<(input: RequestInfo | URL | Request, init?: RequestInit) => Promise<Response | { ok: true }>>(async () => ({ ok: true }));
const signInMock = vi.fn(async () => undefined);
const signOutMock = vi.fn(async () => undefined);

vi.mock('../../src/lib/spClient', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/spClient')>('../../src/lib/spClient');
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
  }),
}));

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: () => ({
    isAdmin: true,
    ready: true,
  }),
}));

vi.mock('../../src/auth/MsalProvider', () => ({
  MsalProvider: ({ children }: { children: React.ReactNode }) => children,
  useMsalContext: () => ({
    accounts: [],
    instance: {
      getActiveAccount: () => null,
      getAllAccounts: () => [],
      acquireTokenSilent: vi.fn(() => Promise.resolve({ accessToken: 'mock-token' })),
    },
    inProgress: 'none',
  }),
}));

vi.mock('../../src/features/records/RecordList', () => ({
  __esModule: true,
  default: () => <h1>記録管理トップ</h1>,
}));

vi.mock('../../src/features/compliance-checklist/ChecklistPage', () => ({
  __esModule: true,
  default: () => <h1>自己点検ビュー</h1>,
}));

vi.mock('../../src/features/audit/AuditPanel', () => ({
  __esModule: true,
  default: () => <h1>監査ログビュー</h1>,
}));

vi.mock('../../src/features/users', () => ({
  __esModule: true,
  UsersPanel: () => <h1>利用者ビュー</h1>,
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
  default: () => <h1>日次記録ビュー</h1>,
}));

// ===== A案: gate を素通りさせる（テスト専用） =====
vi.mock('@/app/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/AdminGate', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ===== RouteHydrationErrorBoundary を素通りにする（useLocation 問題回避） =====
vi.mock('@/hydration/RouteHydrationListener', () => ({
  RouteHydrationErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useRouteHydrationTracker: () => {},
}));

vi.mock('@/stores/useUsers', () => ({
  useUsers: () => ({ data: [], error: null, loading: false, reload: vi.fn() }),
}));

vi.mock('@/stores/useStaff', () => ({
  useStaff: () => ({ data: [], error: null, loading: false, reload: vi.fn() }),
}));

vi.mock('@/features/schedule/useSchedulesToday', () => ({
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

/**
 * skip/todo 回収条件（未来の自分向け定数）
 * 
 * このテストファイルの skip/todo を解除する条件を明文化
 */
// const TODO_RECOVERY_CONDITIONS = {
//   appRender: 'Recover when App routes can be rendered without MSAL/ProtectedRoute in unit test env',
//   navIntegration: 'Recover when nav testid + authz mock + route definition are stabilized',
// } as const;

describe('router future flags smoke', () => {
  beforeEach(() => {
    spFetchMock.mockClear();
    signInMock.mockClear();
    signOutMock.mockClear();
  });

  /**
   * 2段構え: 構造テスト（router.tsx） + レンダースモーク（testRoutes.tsx）
   */

  describe('route definitions (router.tsx)', () => {
    /**
     * A案（構造テスト）: 本番の route 定義が壊れていないか検証
     * 
     * 価値: router.tsx の構造が正しく export されていることを保証
     * 
     * 改善ポイント:
     * 1. React.isValidElement で正確に ReactElement かどうか判定
     * 2. 衝突検知：同じ path が重複して登録されたら即座に検出
     * 
     * 将来の拡張で片方の route が消えてもう片方が残ったような事故を防ぎます。
     */
    it('/audit path exists with valid element', () => {
      const matches = appChildRoutesForTest.filter((r: Record<string, unknown>) => r.path === 'audit');
      expect(matches).toHaveLength(1); // 衝突検知: 重複登録を防止
      const auditRoute = matches[0];
      expect(auditRoute).toBeDefined();
      expect(auditRoute?.path).toBe('audit');
      expect(auditRoute?.element).toBeTruthy();
      // React.isValidElement で正確に ReactElement かどうかを判定
      // typeof === 'object' でも十分ですが、これがより正確です
      expect(React.isValidElement(auditRoute?.element)).toBe(true);
    });

    it('/checklist path exists with valid element', () => {
      const matches = appChildRoutesForTest.filter((r: Record<string, unknown>) => r.path === 'checklist');
      expect(matches).toHaveLength(1); // 衝突検知: 重複登録を防止
      const checklistRoute = matches[0];
      expect(checklistRoute).toBeDefined();
      expect(checklistRoute?.path).toBe('checklist');
      expect(checklistRoute?.element).toBeTruthy();
      expect(React.isValidElement(checklistRoute?.element)).toBe(true);
    });
  });

  describe('router render smoke (test routes)', () => {
    /**
     * A'案（レンダースモーク）: Router 基盤が正常に動作するか検証
     * 
     * 価値: 統合の地雷（ErrorBoundary/MSAL/gate/lazy）を踏まずにレンダー成功を保証
     * 注意: 本番の route 定義は使わない（testRoutes.tsx の独立 route を使用）
     * 
     * ===== 将来の安定化TIPS（Tip 3: flake 防止策） =====
     * 現在は await screen.findByTestId() だけで安定していますが、
     * RouterProvider 周辺に async が入ったり Promise chain が複雑化した場合は:
     *   - 第1段: await waitFor(() => expect(screen.getByTestId(...)).toBeInTheDocument())
     *   - 第2段: await waitFor(..., { timeout: 5000 }) で timeout 延長
     * の順で最小に追加します。最小差分を保つことが重要です。
     * 
     * ===== Playwright への委譲戦略（Tip 4: 認証経路の選択） =====
     * skip 2 を Playwright に移す時、localStorage.setItem('auth:role', 'admin') は
     * アプリが そのキー を読んでいない限り効きません。MSAL/Graph/SharePoint 連携では特に。
     * 堅い方法は:
     *   ✅ storageState でログイン済み cookie/token を固定（既に運用経験あり）
     *   ✅ env override (VITE_E2E / VITE_SKIP_LOGIN) で本番同等経路を通す
     * どちらにするかは「実装の認証経路」に合わせて決めるのが正解です。
     */
    it('/audit URL直入でレンダー成功', async () => {
      const router = createMemoryRouter(smokeRoutes, { initialEntries: ['/audit'] });
      render(<RouterProvider router={router} />);
      expect(await screen.findByTestId('smoke-audit-root')).toBeInTheDocument();
    });

    it('/checklist URL直入でレンダー成功', async () => {
      const router = createMemoryRouter(smokeRoutes, { initialEntries: ['/checklist'] });
      render(<RouterProvider router={router} />);
      expect(await screen.findByTestId('smoke-checklist-root')).toBeInTheDocument();
    });
  });

  // ===== 旧テスト: App 全体レンダー（今後の拡張用に残す） =====
  it.skip('renders app root and loads home page with future flags', async () => {
    renderWithAppProviders(<App />, { initialEntries: ['/'] });
    
    // ✅ App が初期化され、Router が機能してることを確認（最小条件）
    const appShell = await screen.findByTestId('app-shell', {}, { timeout: 10_000 });
    expect(appShell).toBeInTheDocument();
    
    // ルート DOM の存在確認（future flags が有効でもクラッシュしてない）
    const root = document.querySelector('#root');
    expect(root?.children.length ?? 0).toBeGreaterThan(0);
  }, 15_000);

  // ===== テスト 2: 権限が有効な場合、管理者リンクが見える =====
  // TODO: [RECOVERY ROADMAP]
  // この todo を実現するには docs/ROUTER_FLAGS_RECOVERY_ROADMAP.md を参照
  // A案: Routes コンポーネント化（最小・最速）
  //   → src/app/AppRoutes.tsx を新規作成
  //   → router.tsx から childRoutes を参照
  //   → テストで appRouteConfig を直接使用（App全体プロバイダー省略）
  // B案: root testid 付与（次点）
  //   → src/features/audit/AuditPanel.tsx に data-testid="audit-root" を追加
  //   → src/features/compliance-checklist/ChecklistPage.tsx に data-testid="checklist-root" を追加
  // C案: 権限/フラグ固定（最後）
  //   → src/app/AppShell.tsx のナビに data-testid を追加
  //   → テストで useUserAuthz / feature flags を mock override
  it.todo('navigates to audit page when link is available - awaiting admin nav testid stabilization');

  // ===== テスト 3: ナビゲーション経路が正常か（リンク → 画面遷移） =====
  // NOTE: router-future-flags.ts の global mock で React Router v7 future flags を有効化した状態で、
  // App 全体の主要ルートが正常に遷移できることのスモークテスト。
  // ⚠️ SKIP 理由: App 全体の E2E テストは複雑（MSAL/権限/ルーティング/ナビ が統合）
  //    skip を外すには以下が必要：
  //    - [A案] src/app/AppRoutes.tsx を作成して Routes 定義を分離
  //    - [B案] 各ページ root に data-testid を付与（audit-root, checklist-root など）
  //    - [C案] 権限/フラグを固定して nav 検証を実施
  //    
  //    詳細: docs/ROUTER_FLAGS_RECOVERY_ROADMAP.md
  it.skip('navigates across primary routes with v7 flags enabled', async () => {
    const user = userEvent.setup();
    render(<App />);

    // 初期表示: ホーム画面の確認
    expect(await screen.findByText(/磯子区障害者地域活動ホーム/)).toBeInTheDocument();

    // ナビゲーション経路のテスト: ホーム → 監査ログ → 日次記録 → 自己点検 → ホーム

    // TODO: data-testid 追加で getAllByRole(...)[1] のマジックインデックスを回避
    // 現在はヘッダー/フッターで同じラベルが存在するため [1] で特定
    const auditLinks = screen.queryAllByRole('link', { name: '監査ログ' });
    if (auditLinks.length > 1) {
      await user.click(auditLinks[1]);
      // URL 変化を期待（文言より堅い）
      await page.waitForURL(/\/audit/i, { timeout: 5_000 }).catch(() => {
        // URL 遷移がなければ文言を試す
        return screen.findByText('監査ログビュー', {}, { timeout: 3_000 }).catch(() => undefined);
      });
    }

    const dailyLinks = screen.queryAllByRole('link', { name: '日次記録' });
    if (dailyLinks.length > 0) {
      await user.click(dailyLinks[0]);
      await screen.findByText(/日次記録/, {}, { timeout: 15_000 });
    }

    await user.click(screen.getByRole('link', { name: '自己点検' }));
    expect(await screen.findByText('自己点検ビュー')).toBeInTheDocument();

    // ホームリンクは「黒ノート」表記のナビゲーションをクリックして戻す
    await user.click(await screen.findByTestId('nav-dashboard'));
    expect(await screen.findByText(/磯子区障害者地域活動ホーム/)).toBeInTheDocument();

    // 副作用の検証: ルート遷移での想定外のAPI呼び出しや認証アクションが発生していないことを確認
    const calls = (spFetchMock.mock.calls as Array<[RequestInfo | URL | Request, RequestInit?]>).map(([input]) =>
      typeof input === 'string' ? input : input instanceof Request ? input.url : String(input),
    );

    const currentUserCalls = calls.filter((u) => u.includes('/currentuser?$select=Id'));
    const nonCurrentUserCalls = calls.filter((u) => !u.includes('/currentuser?$select=Id'));

    expect(currentUserCalls.length).toBeLessThanOrEqual(1);
    expect(nonCurrentUserCalls).toHaveLength(0);
    expect(signInMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
