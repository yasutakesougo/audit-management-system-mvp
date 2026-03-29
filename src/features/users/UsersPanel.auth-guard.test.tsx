import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usersStoreMock } from './testUtils/usersStoreMock';

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: vi.fn(),
}));

vi.mock('@/auth/useAdminOverride', () => ({
  useAdminOverride: () => ({
    isOverrideActive: false,
    requestOverride: () => false,
    revokeOverride: () => {},
    remainingMs: 0,
  }),
}));

import { useUserAuthz } from '@/auth/useUserAuthz';
import UsersPanel from './UsersPanel/index';

describe('UsersPanel auth guard', () => {
  beforeEach(() => {
    usersStoreMock.reset();
    vi.mocked(useUserAuthz).mockReturnValue({ role: 'viewer', ready: true });
  });

  const renderOnUsersRoute = (path = '/users') => {
    const router = createMemoryRouter(
      [{ path: '/users', element: <UsersPanel /> }],
      { initialEntries: [path] },
    );
    render(<RouterProvider router={router} />);
    return router;
  };

  it('falls back to list when create tab is requested without edit permission', async () => {
    renderOnUsersRoute('/users?tab=create');

    expect(await screen.findByRole('heading', { name: '利用者一覧' })).toBeInTheDocument();
    expect(screen.getByText('条件に一致する利用者がいません')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '新規利用者登録' })).toBeNull();
    expect(screen.getByRole('tab', { name: /利用者一覧/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('disables create action in menu when edit permission is missing', () => {
    render(
      <MemoryRouter>
        <UsersPanel />
      </MemoryRouter>
    );

    const createButton = screen.getByRole('button', { name: '新規利用者登録' });
    expect(createButton).toBeDisabled();
    expect(screen.getByText('新規利用者登録には編集モードが必要です。')).toBeInTheDocument();

    fireEvent.click(createButton);
    expect(screen.queryByRole('heading', { name: '新規利用者登録' })).toBeNull();
    expect(screen.getByRole('tab', { name: '利用者メニュー' })).toHaveAttribute('aria-selected', 'true');
  });
});
