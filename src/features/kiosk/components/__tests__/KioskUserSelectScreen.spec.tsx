import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { IUserMaster } from '@/features/users/types';
import { KioskUserSelectScreen } from '../KioskUserSelectScreen';

const { mockUseUsersQuery, mockRefresh } = vi.hoisted(() => ({
  mockUseUsersQuery: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock('@/features/users/hooks/useUsersQuery', () => ({
  useUsersQuery: mockUseUsersQuery,
}));

const renderScreen = () =>
  render(
    <MemoryRouter initialEntries={['/kiosk/users']}>
      <KioskUserSelectScreen />
    </MemoryRouter>,
  );

describe('KioskUserSelectScreen', () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    mockUseUsersQuery.mockReset();
  });

  it('shows a load failure instead of the empty target-user state when users cannot be loaded', () => {
    mockUseUsersQuery.mockReturnValue({
      data: [],
      status: 'error',
      refresh: mockRefresh,
    });

    renderScreen();

    expect(screen.getByText('利用者の読み込みに失敗しました')).toBeInTheDocument();
    expect(screen.getByText(/対象者なしではありません/)).toBeInTheDocument();
    expect(screen.queryByText('対象の利用者がいません')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the empty target-user state for a successful load with no target users', () => {
    mockUseUsersQuery.mockReturnValue({
      data: [
        {
          Id: 1,
          UserID: 'user-1',
          FullName: '対象外 太郎',
          IsActive: true,
          IsSupportProcedureTarget: false,
          IsHighIntensitySupportTarget: false,
        } as unknown as IUserMaster,
      ],
      status: 'success',
      refresh: mockRefresh,
    });

    renderScreen();

    expect(screen.getByText('対象の利用者がいません')).toBeInTheDocument();
    expect(screen.queryByText('利用者の読み込みに失敗しました')).not.toBeInTheDocument();
  });
});
