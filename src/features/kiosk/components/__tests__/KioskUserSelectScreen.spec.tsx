import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const mockGetDailyByDate = vi.fn();
const mockUpsertDailyByKey = vi.fn();
vi.mock('@/features/attendance/repositoryFactory', () => ({
  useAttendanceRepository: () => ({
    getDailyByDate: mockGetDailyByDate,
    upsertDailyByKey: mockUpsertDailyByKey,
  }),
}));

const mockGetRecords = vi.fn();
vi.mock('@/features/daily/hooks/useExecutionData', () => ({
  useExecutionData: () => ({
    getRecords: mockGetRecords,
  }),
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
    mockGetDailyByDate.mockReset();
    mockUpsertDailyByKey.mockReset();
    mockGetRecords.mockReset();
  });

  it('shows a load failure instead of the empty target-user state when users cannot be loaded', async () => {
    mockUseUsersQuery.mockReturnValue({
      data: [],
      status: 'error',
      refresh: mockRefresh,
    });
    mockGetDailyByDate.mockResolvedValue([]);

    renderScreen();

    expect(await screen.findByText('利用者の読み込みに失敗しました')).toBeInTheDocument();
    expect(screen.getByText(/対象者なしではありません/)).toBeInTheDocument();
    expect(screen.queryByText('対象の利用者がいません')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    // 再読み込みによって開始されるローディング表示とその完了を待機し、テスト外での非同期状態更新（act警告）を防ぐ
    await screen.findByRole('progressbar');
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('keeps the empty target-user state for a successful load with no target users', async () => {
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
    mockGetDailyByDate.mockResolvedValue([]);

    renderScreen();

    expect(await screen.findByText('対象の利用者がいません')).toBeInTheDocument();
    expect(screen.queryByText('利用者の読み込みに失敗しました')).not.toBeInTheDocument();
  });

  it('shows a [本日欠席] chip and sets opacity on absent user card', async () => {
    mockUseUsersQuery.mockReturnValue({
      data: [
        {
          Id: 1,
          UserID: 'user-1',
          FullName: '欠席 太郎',
          IsActive: true,
          IsSupportProcedureTarget: true,
          IsHighIntensitySupportTarget: false,
        } as unknown as IUserMaster,
      ],
      status: 'success',
      refresh: mockRefresh,
    });

    mockGetDailyByDate.mockResolvedValue([
      {
        Key: 'user-1|2026-06-03',
        UserCode: 'user-1',
        RecordDate: '2026-06-03',
        Status: '当日欠席',
      },
    ]);

    renderScreen();

    const chip = await screen.findByTestId('kiosk-user-absent-chip-1');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('本日欠席');

    const card = screen.getByTestId('kiosk-user-card-1');
    expect(card).toHaveStyle('opacity: 0.6');
  });

  it('opens dialog, allows selecting reason, typing memo and saves absence', async () => {
    mockUseUsersQuery.mockReturnValue({
      data: [
        {
          Id: 2,
          UserID: 'user-2',
          FullName: '出席 花子',
          IsActive: true,
          IsSupportProcedureTarget: true,
          IsHighIntensitySupportTarget: false,
        } as unknown as IUserMaster,
      ],
      status: 'success',
      refresh: mockRefresh,
    });

    mockGetDailyByDate.mockResolvedValue([]);
    mockGetRecords.mockResolvedValue([]); // 既存実績なし

    renderScreen();

    const trigger = await screen.findByTestId('kiosk-user-menu-trigger-2');
    fireEvent.click(trigger);

    const menuItem = await screen.findByTestId('kiosk-user-menu-absent');
    fireEvent.click(menuItem);

    const dialogTitle = await screen.findByText(/本日欠席として処理/);
    expect(dialogTitle).toBeInTheDocument();

    const memoInput = screen.getByPlaceholderText(/連絡手段や詳細など/);
    fireEvent.change(memoInput, { target: { value: '家庭都合で休みです' } });

    const submitBtn = screen.getByTestId('kiosk-absent-dialog-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockUpsertDailyByKey).toHaveBeenCalledWith(expect.objectContaining({
        UserCode: 'user-2',
        Status: '当日欠席',
        AbsentReason: '体調不良',
        AbsentSupportContent: '家庭都合で休みです',
      }));
    });
  });

  it('blocks saving absence if there are existing records', async () => {
    mockUseUsersQuery.mockReturnValue({
      data: [
        {
          Id: 3,
          UserID: 'user-3',
          FullName: '実績あり 次郎',
          IsActive: true,
          IsSupportProcedureTarget: true,
          IsHighIntensitySupportTarget: false,
        } as unknown as IUserMaster,
      ],
      status: 'success',
      refresh: mockRefresh,
    });

    mockGetDailyByDate.mockResolvedValue([]);
    mockGetRecords.mockResolvedValue([{ id: 'rec-1', status: 'completed' }]); // 既存実績あり

    renderScreen();

    const trigger = await screen.findByTestId('kiosk-user-menu-trigger-3');
    fireEvent.click(trigger);

    const menuItem = await screen.findByTestId('kiosk-user-menu-absent');
    fireEvent.click(menuItem);

    const errorAlert = await screen.findByTestId('kiosk-absent-dialog-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent(/本日の実施記録が既にあります/);

    const submitBtn = screen.getByTestId('kiosk-absent-dialog-submit');
    expect(submitBtn).toBeDisabled();
  });
});
