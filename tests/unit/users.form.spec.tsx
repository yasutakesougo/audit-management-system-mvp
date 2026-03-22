import { renderWithAppProviders } from '../helpers/renderWithAppProviders';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { SpUserItem } from '@/types';

const createUserMock = vi.fn<() => Promise<SpUserItem>>();
const updateUserMock = vi.fn<() => Promise<SpUserItem>>();

vi.mock('@/hooks/useUsers', () => ({
  useUsers: () => ({
    createUser: createUserMock,
    updateUser: updateUserMock,
    getUserById: vi.fn(),
  }),
}));

// UserForm loads useUsers at module scope, so mock before importing component
import UserForm from '@/components/UserForm';

describe('UserForm', () => {
  beforeEach(() => {
    createUserMock.mockReset();
    updateUserMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('blocks submit when required Title is empty and shows validation message', () => {
    const onDone = vi.fn();

    renderWithAppProviders(<UserForm mode="create" onDone={onDone} />);

    const submitButton = screen.getByRole('button', { name: /保存|作成|登録/i });
    fireEvent.click(submitButton);

    expect(createUserMock).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText(/必須/i)).toBeInTheDocument();
  });

  it('prevents edit submit when id is missing in edit mode', () => {
    const onDone = vi.fn();

    renderWithAppProviders(<UserForm mode="edit" initial={{ Title: '利用者A' }} onDone={onDone} />);

    const submitButton = screen.getByRole('button', { name: /保存|更新/i });
    fireEvent.click(submitButton);

    expect(updateUserMock).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText(/IDが取得できません/)).toBeInTheDocument();
  });

  it('sends trimmed values and active flag when editing an existing user', async () => {
    const onDone = vi.fn();
    updateUserMock.mockResolvedValueOnce({ Id: 1, Title: '利用者B' } as SpUserItem);

    renderWithAppProviders(
      <UserForm
        mode="edit"
        initial={{ id: 1, Title: ' 利用者B ', Furigana: '   ', Phone: ' 090-1111-2222 ', Email: ' user@example.com ', IsActive: true }}
        onDone={onDone}
      />
    );

    const activeCheckbox = screen.getByRole('checkbox');
    fireEvent.click(activeCheckbox); // uncheck to set inactive

    const submitButton = screen.getByRole('button', { name: /保存|更新/i });
    fireEvent.click(submitButton);

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledTimes(1));
    expect(updateUserMock).toHaveBeenCalledWith(1, {
      Title: '利用者B',
      Furigana: null,
      Phone: '090-1111-2222',
      Email: 'user@example.com',
      IsActive: false,
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
