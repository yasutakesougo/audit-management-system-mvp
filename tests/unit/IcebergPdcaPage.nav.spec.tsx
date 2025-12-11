import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// プロジェクトの alias に合わせてパスを調整してください
import { IcebergPdcaPage } from '@/features/iceberg-pdca/IcebergPdcaPage';

// useNavigate をモックして遷移先を検証する
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/features/users/store', () => ({
  useUsersStore: () => ({
    data: [
      { Id: 1, UserID: 'U001', FullName: '利用者A' },
      { Id: 2, UserID: 'I022', FullName: '利用者B' },
    ],
    status: 'success' as const,
    error: null,
    refresh: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  }),
}));

describe('IcebergPdcaPage navigation', () => {
  it('「氷山を見る」クリックで /analysis/iceberg?userId=... に遷移する', async () => {
    const user = userEvent.setup();
    const userId = 'U001';
    mockNavigate.mockReset();

    render(
      <MemoryRouter initialEntries={[`/pdca?userId=${encodeURIComponent(userId)}`]}>
        <IcebergPdcaPage />
      </MemoryRouter>
    );

    const buttons = await screen.findAllByTestId('pdca-open-iceberg');
    await user.click(buttons[0]);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate.mock.calls[0][0]).toBe(`/analysis/iceberg?userId=${encodeURIComponent(userId)}`);
  });
});
