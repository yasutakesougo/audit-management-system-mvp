import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usersStoreMock } from './testUtils/usersStoreMock';
import UsersPanel from './UsersPanel';

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
    render(<UsersPanel />);

    const userIdInput = screen.getByRole('textbox', { name: /ユーザーID/ });
    const fullNameInput = screen.getByRole('textbox', { name: '氏名' });
    const createButton = screen.getByRole('button', { name: '簡易作成' });

    fireEvent.change(userIdInput, { target: { value: 'u-xyz' } });
    fireEvent.change(fullNameInput, { target: { value: 'テスト太郎' } });
    fireEvent.click(createButton);

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
});
