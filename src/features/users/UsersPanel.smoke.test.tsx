import { usersStoreMock } from './testUtils/usersStoreMock';
import type { MockInstance } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

    const userIdInput = screen.getByRole('textbox', { name: 'User ID' });
    const fullNameInput = screen.getByRole('textbox', { name: '氏名' });
    const createButton = screen.getByRole('button', { name: 'Create' });

    fireEvent.change(userIdInput, { target: { value: 'u-xyz' } });
    fireEvent.change(fullNameInput, { target: { value: 'テスト太郎' } });
    fireEvent.click(createButton);

    expect(await screen.findByText('テスト太郎')).toBeInTheDocument();
    expect(screen.getByText('u-xyz')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText('テスト太郎')).toBeNull();
      expect(screen.getByText('No users yet.')).toBeInTheDocument();
    });
  });
});
