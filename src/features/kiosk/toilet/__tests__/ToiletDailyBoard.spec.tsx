import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IUserMaster } from '@/features/users/types';
import { ToiletDailyBoard } from '../ToiletDailyBoard';

const { mockUseUsers, mockUseToiletRecords, mockRefreshRecords, mockCreateRecord } = vi.hoisted(() => ({
  mockUseUsers: vi.fn(),
  mockUseToiletRecords: vi.fn(),
  mockRefreshRecords: vi.fn(),
  mockCreateRecord: vi.fn(),
}));

vi.mock('@/features/users/useUsers', () => ({
  useUsers: mockUseUsers,
}));

vi.mock('../useToiletRecords', () => ({
  useToiletRecords: mockUseToiletRecords,
}));

const toiletTargetUser = {
  Id: 1,
  UserID: 'user-1',
  FullName: '支援 花子',
  IsActive: true,
  RequiresToiletGuidance: true,
} as unknown as IUserMaster;

const renderBoard = () =>
  render(
    <MemoryRouter initialEntries={['/kiosk/toilet']}>
      <ToiletDailyBoard />
    </MemoryRouter>,
  );

describe('ToiletDailyBoard', () => {
  beforeEach(() => {
    mockUseUsers.mockReset();
    mockUseToiletRecords.mockReset();
    mockRefreshRecords.mockReset();
    mockCreateRecord.mockReset();

    mockUseUsers.mockReturnValue({
      data: [toiletTargetUser],
      isLoading: false,
      status: 'success',
    });

    mockUseToiletRecords.mockReturnValue({
      records: [],
      create: mockCreateRecord,
      refresh: mockRefreshRecords,
      isLoading: false,
      error: null,
    });
  });

  it('shows a record load failure instead of treating every target user as unrecorded', () => {
    mockUseToiletRecords.mockReturnValue({
      records: [],
      create: mockCreateRecord,
      refresh: mockRefreshRecords,
      isLoading: false,
      error: new Error('failed to load ToiletRecords'),
    });

    renderBoard();

    expect(screen.getByText('トイレ記録の読み込みに失敗しました')).toBeInTheDocument();
    expect(screen.getByText(/記録済み\/未記録の判定ができません/)).toBeInTheDocument();
    expect(screen.getByTestId('toilet-board-summary')).toHaveTextContent('記録状態を確認できません');
    expect(screen.queryByTestId('toilet-user-row-user-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('toilet-record-history')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }));
    expect(mockRefreshRecords).toHaveBeenCalledTimes(1);
  });

  it('keeps the no-target-users state for a successful load with no toilet guidance targets', () => {
    mockUseUsers.mockReturnValue({
      data: [
        {
          Id: 2,
          UserID: 'user-2',
          FullName: '対象外 太郎',
          IsActive: true,
          RequiresToiletGuidance: false,
        } as unknown as IUserMaster,
      ],
      isLoading: false,
      status: 'success',
    });

    renderBoard();

    expect(screen.getByText('トイレ誘導対象の利用者がいません')).toBeInTheDocument();
    expect(screen.queryByText('トイレ記録の読み込みに失敗しました')).not.toBeInTheDocument();
  });
});
