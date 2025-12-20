import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spFetchMock = vi.fn(async () => ({ ok: true }));
const signInMock = vi.fn(async () => undefined);
const signOutMock = vi.fn(async () => undefined);

vi.mock('../../src/lib/spClient', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/spClient')>('../../src/lib/spClient');
  return {
    ...actual,
    useSP: () => ({ spFetch: spFetchMock }),
  };
});

vi.mock('../../src/auth/useAuth', () => ({
  useAuth: () => ({
    signIn: signInMock,
    signOut: signOutMock,
    isAuthenticated: false,
    account: null,
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

describe('router future flags smoke', () => {
  beforeEach(() => {
    spFetchMock.mockClear();
    signInMock.mockClear();
    signOutMock.mockClear();
  });

  // NOTE: router-future-flags.ts の global mock で React Router v7 future flags を有効化した状態で、
  // App 全体の主要ルートが正常に遷移できることのスモークテスト。
  it('navigates across primary routes with v7 flags enabled', async () => {
    const user = userEvent.setup();
    render(<App />);

    // 初期表示: ホーム画面の確認
    expect(await screen.findByRole('heading', { name: '磯子区障害者地域活動ホーム' })).toBeInTheDocument();

    // ナビゲーション経路のテスト: ホーム → 監査ログ → 日次記録 → 自己点検 → ホーム

    // TODO: data-testid 追加で getAllByRole(...)[1] のマジックインデックスを回避
    // 現在はヘッダー/フッターで同じラベルが存在するため [1] で特定
    await user.click(screen.getAllByRole('link', { name: '監査ログ' })[1]);
    expect(await screen.findByText('監査ログビュー')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '日次記録' }));
    expect(await screen.findByText('日次記録ビュー')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '自己点検' }));
    expect(await screen.findByText('自己点検ビュー')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'ホーム' }));
    expect(await screen.findByRole('heading', { name: '磯子区障害者地域活動ホーム' })).toBeInTheDocument();

    // 副作用の検証: ルート遷移での想定外のAPI呼び出しや認証アクションが発生していないことを確認
    expect(spFetchMock).not.toHaveBeenCalled();
    expect(signInMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
