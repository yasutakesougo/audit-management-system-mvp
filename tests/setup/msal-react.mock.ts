import type { ReactNode } from 'react';
import { vi } from 'vitest';

/**
 * Vitest-only MSAL shim for jsdom test suites
 *
 * テスト環境でMSAL依存コンポーネントを問題なくレンダリングするためのモック。
 * 実際のMSAL認証は行わず、UI テストに必要最小限の機能を提供。
 *
 * 使用例:
 * ```typescript
 * import { __resetMsalMocks, __msalMock } from 'tests/setup/msal-react.mock';
 *
 * beforeEach(() => {
 *   __resetMsalMocks();
 * });
 *
 * test('ログアウト状態のテスト', () => {
 *   __msalMock.setAuthenticated(false);
 *   // テストコード
 * });
 * ```
 */

// Stub MSAL surface so UI tests can render without wiring the real provider.
type MockMsalInstance = {
  acquireTokenSilent: ReturnType<typeof vi.fn>;
  acquireTokenRedirect: ReturnType<typeof vi.fn>;
  loginRedirect: ReturnType<typeof vi.fn>;
  logoutRedirect: ReturnType<typeof vi.fn>;
  getAllAccounts: ReturnType<typeof vi.fn>;
  getActiveAccount: ReturnType<typeof vi.fn>;
};

type MockAccount = {
  localAccountId: string;
  name?: string;
  username?: string;
};

type MockMsalContext = {
  instance: MockMsalInstance;
  accounts: MockAccount[];
  inProgress: 'none' | 'login' | 'logout' | 'acquireToken';
};

const createMockInstance = (): MockMsalInstance => ({
  acquireTokenSilent: vi.fn(),
  acquireTokenRedirect: vi.fn(),
  loginRedirect: vi.fn(),
  logoutRedirect: vi.fn(),
  getAllAccounts: vi.fn(() => []),
  getActiveAccount: vi.fn(() => null),
});

const instance = createMockInstance();

const useMsal = vi.fn(() => ({
  instance,
  accounts: [] as MockAccount[],
  inProgress: 'none' as MockMsalContext['inProgress']
}));
const useIsAuthenticated = vi.fn(() => true);
const useMsalContext = vi.fn(() => ({
  instance,
  accounts: [] as MockAccount[],
  inProgress: 'none' as MockMsalContext['inProgress']
}));

/**
 * テスト間でのモック状態リセット用ヘルパー
 * beforeEach / afterEach で呼び出して、テストケース間の影響を排除
 */
export const __resetMsalMocks = () => {
  // インスタンスメソッドのリセット
  instance.acquireTokenSilent.mockReset();
  instance.acquireTokenRedirect.mockReset();
  instance.loginRedirect.mockReset();
  instance.logoutRedirect.mockReset();
  instance.getAllAccounts.mockReset();
  instance.getActiveAccount.mockReset();

  // フックのリセット
  useMsal.mockClear();
  useIsAuthenticated.mockClear();
  useMsalContext.mockClear();

  // デフォルト状態に復元
  const defaultState = {
    instance,
    accounts: [] as MockAccount[],
    inProgress: 'none' as MockMsalContext['inProgress']
  };
  useMsal.mockReturnValue(defaultState);
  useIsAuthenticated.mockReturnValue(true);
  useMsalContext.mockReturnValue(defaultState);
  instance.getAllAccounts.mockReturnValue([]);
  instance.getActiveAccount.mockReturnValue(null);
};

/**
 * テスト用MSAL状態管理ヘルパー
 * 認証状態やローディング状態を動的に切り替えてUI挙動をテスト
 */
export const __msalMock = {
  /**
   * 認証状態を設定
   * @param authenticated - true: ログイン済み, false: 未ログイン
   */
  setAuthenticated(authenticated: boolean) {
    useIsAuthenticated.mockReturnValue(authenticated);
    const accounts: MockAccount[] = authenticated ? [{ localAccountId: 'test-account', name: 'Test User' }] : [];
    const activeAccount: MockAccount | null = authenticated ? { localAccountId: 'test-account', name: 'Test User' } : null;

    const msalState: MockMsalContext = { instance, accounts, inProgress: 'none' };
    useMsal.mockReturnValue(msalState);
    useMsalContext.mockReturnValue(msalState);
    instance.getAllAccounts.mockReturnValue(accounts);
    instance.getActiveAccount.mockReturnValue(activeAccount);
  },

  /**
   * ローディング状態を設定
   * @param inProgress - 'none' | 'login' | 'logout' | 'acquireToken'
   */
  setInProgress(inProgress: MockMsalContext['inProgress']) {
    const currentMsal = useMsal.getMockImplementation()?.() || {
      instance,
      accounts: [] as MockAccount[],
      inProgress: 'none' as MockMsalContext['inProgress']
    };
    const newState = { ...currentMsal, inProgress };

    useMsal.mockReturnValue(newState);
    useMsalContext.mockReturnValue(newState);
  },

  /**
   * ログインエラーをシミュレート
   * @param error - 投げるエラー
   */
  simulateLoginError(error: Error) {
    instance.loginRedirect.mockRejectedValue(error);
    instance.acquireTokenSilent.mockRejectedValue(error);
  },

  /**
   * トークン取得成功をシミュレート
   * @param token - 返すアクセストークン
   */
  simulateTokenSuccess(token: string = 'mock-access-token') {
    instance.acquireTokenSilent.mockResolvedValue({
      accessToken: token,
      account: { localAccountId: 'test-account', name: 'Test User' },
    });
  },
};

vi.mock('@azure/msal-react', async () => {
  const React = await import('react');
  const { createElement, Fragment } = React;

  return {
    MsalProvider: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children),
    useMsal,
    useIsAuthenticated,
    __msalMock: {
      instance,
      useMsal,
      useIsAuthenticated,
    },
  };
});

vi.mock('@/auth/MsalProvider', async () => {
  const React = await import('react');
  const { createElement, Fragment } = React;

  return {
    MsalProvider: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children),
    useMsalContext,
    __msalContextMock: {
      createMockInstance,
      instance,
      useMsalContext,
    },
  };
});
