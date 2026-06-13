import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IUserMaster } from '@/features/users/types';
import { toLocalDateISO } from '@/utils/getNow';
import { ToiletDailyBoard } from '../ToiletDailyBoard';

const { mockUseUsers, mockUseToiletRecords, mockRefreshRecords, mockCreateRecord, mockCorrectRecord } = vi.hoisted(() => ({
  mockUseUsers: vi.fn(),
  mockUseToiletRecords: vi.fn(),
  mockRefreshRecords: vi.fn(),
  mockCreateRecord: vi.fn(),
  mockCorrectRecord: vi.fn(),
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
    mockCorrectRecord.mockReset();

    mockUseUsers.mockReturnValue({
      data: [toiletTargetUser],
      isLoading: false,
      status: 'success',
    });

    mockUseToiletRecords.mockReturnValue({
      records: [],
      create: mockCreateRecord,
      correct: mockCorrectRecord,
      refresh: mockRefreshRecords,
      isLoading: false,
      error: null,
    });
  });

  it('shows a record load failure instead of treating every target user as unrecorded', () => {
    mockUseToiletRecords.mockReturnValue({
      records: [],
      create: mockCreateRecord,
      correct: mockCorrectRecord,
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

  it("uses today's local date by default (without query parameter)", () => {
    renderBoard();
    const today = toLocalDateISO(new Date());
    expect(mockUseToiletRecords).toHaveBeenCalledWith(today);
  });

  it('uses the specified date from date query parameter if it is a valid YYYY-MM-DD string', () => {
    render(
      <MemoryRouter initialEntries={['/kiosk/toilet?date=2026-06-12']}>
        <ToiletDailyBoard />
      </MemoryRouter>,
    );
    expect(mockUseToiletRecords).toHaveBeenCalledWith('2026-06-12');
  });

  it("falls back to today's date if the date query parameter is invalid", () => {
    render(
      <MemoryRouter initialEntries={['/kiosk/toilet?date=invalid-date']}>
        <ToiletDailyBoard />
      </MemoryRouter>,
    );
    const today = toLocalDateISO(new Date());
    expect(mockUseToiletRecords).toHaveBeenCalledWith(today);
  });

  it('creates new records with the selected date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T12:00:00'));

    try {
      mockUseToiletRecords.mockReturnValue({
        records: [],
        create: mockCreateRecord,
        correct: mockCorrectRecord,
        refresh: mockRefreshRecords,
        isLoading: false,
        error: null,
      });

      render(
        <MemoryRouter initialEntries={['/kiosk/toilet?date=2026-06-12']}>
          <ToiletDailyBoard />
        </MemoryRouter>,
      );

      // Click on "記録する" button for the user
      fireEvent.click(screen.getByTestId('toilet-record-button-user-1'));

      // Check that the dialog is shown
      expect(screen.getByText('支援 花子さんのトイレ記録')).toBeInTheDocument();

      // Click save
      fireEvent.click(screen.getByTestId('toilet-record-save'));

      // Check that create was called with occurredAt containing the selected date
      expect(mockCreateRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          occurredAt: expect.stringContaining('2026-06-12'),
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens a correction dialog from an existing record and saves via correct', async () => {
    mockCorrectRecord.mockResolvedValue({
      id: 'toilet-1',
      userId: 'user-1',
      recordDate: '2026-06-12',
      occurredAt: '2026-06-12T10:30:00.000+09:00',
      toiletType: 'bowel',
      amount: 'large',
      memo: '訂正メモ',
      recorderName: 'kiosk',
      source: 'kiosk',
      isDeleted: false,
      createdAt: '2026-06-12T10:30:00.000+09:00',
      updatedAt: '2026-06-12T10:35:00.000+09:00',
    });
    mockUseToiletRecords.mockReturnValue({
      records: [
        {
          id: 'toilet-1',
          userId: 'user-1',
          recordDate: '2026-06-12',
          occurredAt: '2026-06-12T10:30:00.000+09:00',
          toiletType: 'urination',
          amount: 'normal',
          memo: '記録メモ',
          recorderName: 'kiosk',
          source: 'kiosk',
          isDeleted: false,
          createdAt: '2026-06-12T10:30:00.000+09:00',
          updatedAt: '2026-06-12T10:30:00.000+09:00',
        },
      ],
      create: mockCreateRecord,
      correct: mockCorrectRecord,
      refresh: mockRefreshRecords,
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/kiosk/toilet?date=2026-06-12']}>
        <ToiletDailyBoard />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('toilet-correction-button-toilet-1'));

    expect(screen.getByText('支援 花子さんのトイレ記録を訂正')).toBeInTheDocument();
    expect(screen.getByLabelText('利用者')).toHaveValue('支援 花子');
    expect(screen.getByLabelText('記録日')).toHaveValue('2026-06-12');
    expect(screen.getByLabelText('利用者')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('記録日')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('記録日時')).toHaveAttribute('readonly');
    expect(screen.getByDisplayValue('記録メモ')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('メモ'), { target: { value: '訂正メモ' } });
    fireEvent.click(screen.getByTestId('toilet-correction-save'));

    await waitFor(() => {
      expect(mockCorrectRecord).toHaveBeenCalledWith('toilet-1', {
        toiletType: 'urination',
        amount: 'normal',
        memo: '訂正メモ',
      });
    });
    await waitFor(() => {
      expect(screen.queryByText('支援 花子さんのトイレ記録を訂正')).not.toBeInTheDocument();
    });
  });

  it('keeps the correction dialog open and shows an error when correction save fails', async () => {
    mockCorrectRecord.mockRejectedValue(new Error('訂正保存に失敗しました'));
    mockUseToiletRecords.mockReturnValue({
      records: [
        {
          id: 'toilet-1',
          userId: 'user-1',
          recordDate: '2026-06-12',
          occurredAt: '2026-06-12T10:30:00.000+09:00',
          toiletType: 'urination',
          amount: 'normal',
          memo: '記録メモ',
          recorderName: 'kiosk',
          source: 'kiosk',
          isDeleted: false,
          createdAt: '2026-06-12T10:30:00.000+09:00',
          updatedAt: '2026-06-12T10:30:00.000+09:00',
        },
      ],
      create: mockCreateRecord,
      correct: mockCorrectRecord,
      refresh: mockRefreshRecords,
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/kiosk/toilet?date=2026-06-12']}>
        <ToiletDailyBoard />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('toilet-correction-button-toilet-1'));
    fireEvent.click(screen.getByTestId('toilet-correction-save'));

    await waitFor(() => {
      expect(screen.getByText('訂正保存に失敗しました')).toBeInTheDocument();
    });
    expect(screen.getByText('支援 花子さんのトイレ記録を訂正')).toBeInTheDocument();
  });
});
