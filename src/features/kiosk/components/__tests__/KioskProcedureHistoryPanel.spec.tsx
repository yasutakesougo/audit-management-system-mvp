import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KioskProcedureHistoryPanel } from '../KioskProcedureHistoryPanel';

// Mock child component and hooks
vi.mock('../KioskDailyProcedureFlowPreview', () => ({
  KioskDailyProcedureFlowPreview: ({ recordDate, onBack }: { recordDate: string; onBack: () => void }) => (
    <div data-testid="flow-preview">
      Preview for {recordDate}
      <button onClick={onBack} data-testid="back-button">Back</button>
    </div>
  )
}));

const mockRecords = [
  {
    id: 'R001',
    date: '2026-05-11',
    userId: 'U001',
    scheduleItemId: 'P001',
    status: 'completed',
    triggeredBipIds: [],
    memo: '【様子】落ち着いていた\n【対応】見守り',
    recordedBy: '佐藤 支援員',
    recordedAt: '2026-05-11T10:00:00Z'
  }
];

const mockUseHistoricalRecords = vi.fn();
vi.mock('@/features/daily/hooks/useHistoricalRecords', () => ({
  useHistoricalRecords: () => mockUseHistoricalRecords()
}));

describe('KioskProcedureHistoryPanel Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseHistoricalRecords.mockReturnValue({
      records: mockRecords,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      isCached: false,
      lastFetchedAt: null
    });
  });

  it('renders history records and shifts to daily flow preview upon button click', async () => {
    const handleClose = vi.fn();
    render(
      <KioskProcedureHistoryPanel
        userId="U001"
        scheduleItemId="P001"
        userName="田中 太郎"
        procedureName="朝の作業"
        onClose={handleClose}
      />
    );

    expect(screen.getByText('5/11')).toBeInTheDocument();
    expect(screen.getByText(/落ち着いていた/)).toBeInTheDocument();

    const previewButton = screen.getByText('この日の流れ（1日全体のプレビュー）を見る');
    expect(previewButton).toBeInTheDocument();

    // Trigger state change
    fireEvent.click(previewButton);

    // Verify shift to KioskDailyProcedureFlowPreview
    expect(screen.getByTestId('flow-preview')).toBeInTheDocument();
    expect(screen.getByText('Preview for 2026-05-11')).toBeInTheDocument();

    // Trigger back button and check reversion
    fireEvent.click(screen.getByTestId('back-button'));
    expect(screen.queryByTestId('flow-preview')).toBeNull();
    expect(screen.getByText('5/11')).toBeInTheDocument();
  });

  it('renders cache warning status banner when isCached=true and lastFetchedAt is set', () => {
    const mockRefresh = vi.fn();
    mockUseHistoricalRecords.mockReturnValue({
      records: mockRecords,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
      isCached: true,
      lastFetchedAt: new Date('2026-06-03T11:00:00Z').getTime(),
    });

    render(
      <KioskProcedureHistoryPanel
        userId="U001"
        scheduleItemId="P001"
        userName="田中 太郎"
        procedureName="朝の作業"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/前回取得分を表示中/)).toBeInTheDocument();

    // 更新ボタンの動作検証
    const updateButton = screen.getByRole('button', { name: '更新' });
    expect(updateButton).toBeInTheDocument();
    fireEvent.click(updateButton);
    expect(mockRefresh).toHaveBeenCalledWith({ force: true });
  });

  it('renders only error message and reload button when fetch fails with no cache records', () => {
    const mockRefresh = vi.fn();
    mockUseHistoricalRecords.mockReturnValue({
      records: [],
      isLoading: false,
      error: new Error('Network Error'),
      refresh: mockRefresh,
      isCached: false,
      lastFetchedAt: null,
    });

    render(
      <KioskProcedureHistoryPanel
        userId="U001"
        scheduleItemId="P001"
        userName="田中 太郎"
        procedureName="朝の作業"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('履歴の読み込みに失敗しました')).toBeInTheDocument();

    const reloadButton = screen.getByRole('button', { name: '再読み込み' });
    expect(reloadButton).toBeInTheDocument();
    fireEvent.click(reloadButton);
    expect(mockRefresh).toHaveBeenCalledWith({ force: true });

    // 「過去の記録はありません」などの文言が表示されていないことを確認
    expect(screen.queryByText('過去の記録はありません')).toBeNull();
  });

  it('renders historical records and top error banner when fetch fails but stale cache is present', () => {
    const mockRefresh = vi.fn();
    mockUseHistoricalRecords.mockReturnValue({
      records: mockRecords,
      isLoading: false,
      error: new Error('Network Error'),
      refresh: mockRefresh,
      isCached: true,
      lastFetchedAt: new Date('2026-06-03T11:00:00Z').getTime(),
    });

    render(
      <KioskProcedureHistoryPanel
        userId="U001"
        scheduleItemId="P001"
        userName="田中 太郎"
        procedureName="朝の作業"
        onClose={vi.fn()}
      />
    );

    // 履歴が表示されていること
    expect(screen.getByText('5/11')).toBeInTheDocument();
    expect(screen.getByText(/落ち着いていた/)).toBeInTheDocument();

    // エラーバナーが表示されていること
    expect(screen.getByText('最新履歴の取得に失敗しました。前回取得分を表示しています。')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: '再試行' });
    expect(retryButton).toBeInTheDocument();
    fireEvent.click(retryButton);
    expect(mockRefresh).toHaveBeenCalledWith({ force: true });
  });
});
