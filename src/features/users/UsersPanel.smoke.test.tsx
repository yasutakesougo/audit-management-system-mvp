import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { usersStoreMock } from './testUtils/usersStoreMock';
import UsersPanel from './UsersPanel/index';

describe('UsersPanel smoke test', () => {
  beforeEach(() => {
    usersStoreMock.reset();
  });

  const renderOnUsersRoute = (path = '/users') => {
    const router = createMemoryRouter(
      [{ path: '/users', element: <UsersPanel /> }],
      { initialEntries: [path] },
    );
    render(<RouterProvider router={router} />);
    return router;
  };

  it('allows creating and terminating a user with list refresh', async () => {
    render(
      <MemoryRouter>
        <UsersPanel />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('tab', { name: '新規利用者登録' }));

    const fullNameInput = screen.getByRole('textbox', { name: '氏名' });
    const createButton = screen.getByRole('button', { name: '簡易作成' });

    fireEvent.change(fullNameInput, { target: { value: 'テスト太郎' } });
    fireEvent.click(createButton);

    fireEvent.click(screen.getAllByRole('tab', { name: /利用者一覧/ })[0]);

    // デフォルトは「利用中のみ」フィルタONのため、全状態表示に切り替える
    fireEvent.click(screen.getByRole('button', { name: '利用中のみ' }));

    expect(await screen.findByText('テスト太郎')).toBeInTheDocument();
    expect(screen.getByText('LOCAL-U-0001')).toBeInTheDocument();

    // テスト太郎の行を取得して契約終了ボタンをクリック
    const testUserRow = screen.getByText('テスト太郎').closest('tr');
    const terminateButton = testUserRow?.querySelector('button[title="契約終了"]');
    expect(terminateButton).toBeInTheDocument();
    fireEvent.click(terminateButton!);

    const confirmButton = await screen.findByRole('button', { name: '契約終了にする' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('テスト太郎')).toBeInTheDocument();
      expect(screen.getByText('LOCAL-U-0001')).toBeInTheDocument();
      expect(screen.getByText('終了')).toBeInTheDocument();
    });
  });

  it('shows embedded detail when selecting a user from the list', async () => {
    usersStoreMock.reset([
      {
        Id: 101,
        UserID: 'inline-001',
        FullName: '埋め込み太郎',
        IsActive: true,
        IsHighIntensitySupportTarget: true,
        IsSupportProcedureTarget: true,
        AttendanceDays: ['月', '水', '金'],
      },
    ]);

    render(
      <MemoryRouter>
        <UsersPanel />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole('tab', { name: /利用者一覧/ })[0]);

    const detailLink = screen.getByRole('link', { name: '詳細' });
    fireEvent.click(detailLink);

    expect(await screen.findByRole('button', { name: '詳細表示を閉じる' })).toBeInTheDocument();
    expect(screen.getAllByText(/inline-001/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '詳細表示を閉じる' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '詳細表示を閉じる' })).toBeNull();
    });
  });

  it('restores selected detail from URL query', async () => {
    usersStoreMock.reset([
      {
        Id: 101,
        UserID: 'inline-001',
        FullName: '埋め込み太郎',
        IsActive: true,
      },
    ]);

    const router = renderOnUsersRoute('/users?tab=list&selected=inline-001');

    expect(await screen.findByRole('button', { name: '詳細表示を閉じる' })).toBeInTheDocument();
    expect(screen.getAllByText(/inline-001/).length).toBeGreaterThan(0);
    expect(router.state.location.search).toContain('selected=inline-001');
  });

  it('clears invalid selected query and keeps panel stable', async () => {
    usersStoreMock.reset([
      {
        Id: 101,
        UserID: 'inline-001',
        FullName: '埋め込み太郎',
        IsActive: true,
      },
    ]);

    const router = renderOnUsersRoute('/users?tab=list&selected=U-999');

    await waitFor(() => {
      expect(router.state.location.search).toBe('?tab=list');
    });

    expect(await screen.findByText('利用者が未選択です')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '詳細表示を閉じる' })).toBeNull();
  });

  it('writes selected query when detail is opened from list', async () => {
    usersStoreMock.reset([
      {
        Id: 101,
        UserID: 'inline-001',
        FullName: '埋め込み太郎',
        IsActive: true,
      },
    ]);

    const router = renderOnUsersRoute('/users?tab=list');

    fireEvent.click(screen.getByRole('link', { name: '詳細' }));

    await waitFor(() => {
      expect(router.state.location.search).toContain('selected=inline-001');
    });
  });
});
