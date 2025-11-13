import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usersStoreMock } from './testUtils/usersStoreMock';
import UsersPanel from './UsersPanel/index';

describe('UsersPanel smoke test', () => {
  let confirmSpy: MockInstance;

  beforeEach(() => {
    usersStoreMock.reset();
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it('allows creating and deleting a user with list refresh', async () => {
    render(
      <MemoryRouter>
        <UsersPanel />
      </MemoryRouter>
    );

  fireEvent.click(screen.getByRole('tab', { name: '新規利用者登録' }));

    const userIdInput = screen.getByRole('textbox', { name: /ユーザーID/ });
    const fullNameInput = screen.getByRole('textbox', { name: '氏名' });
    const createButton = screen.getByRole('button', { name: '簡易作成' });

    fireEvent.change(userIdInput, { target: { value: 'u-xyz' } });
    fireEvent.change(fullNameInput, { target: { value: 'テスト太郎' } });
    fireEvent.click(createButton);

  fireEvent.click(screen.getAllByRole('tab', { name: /利用者一覧/ })[0]);

  expect(await screen.findByText('テスト太郎')).toBeInTheDocument();
    expect(screen.getByText('u-xyz')).toBeInTheDocument();

    // テスト太郎の行を取得して削除ボタンをクリック
    const testUserRow = screen.getByText('テスト太郎').closest('tr');
    const deleteButton = testUserRow?.querySelector('button[title="削除"]');
    expect(deleteButton).toBeInTheDocument();
    fireEvent.click(deleteButton!);

    await waitFor(() => {
      expect(screen.queryByText('テスト太郎')).toBeNull();
      expect(screen.queryByText('u-xyz')).toBeNull();
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
    expect(screen.getAllByText('利用者ID: inline-001').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '詳細表示を閉じる' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '詳細表示を閉じる' })).toBeNull();
    });
  });
});
