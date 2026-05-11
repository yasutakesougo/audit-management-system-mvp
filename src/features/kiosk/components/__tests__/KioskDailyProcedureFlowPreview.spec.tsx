import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KioskDailyProcedureFlowPreview } from '../KioskDailyProcedureFlowPreview';

const mockUseDailyProcedureFlowPreview = vi.fn();
vi.mock('../../hooks/useDailyProcedureFlowPreview', () => ({
  useDailyProcedureFlowPreview: () => mockUseDailyProcedureFlowPreview()
}));

describe('KioskDailyProcedureFlowPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading spinner when loading', () => {
    mockUseDailyProcedureFlowPreview.mockReturnValue({
      steps: [],
      isLoading: true,
      error: null,
    });

    render(
      <KioskDailyProcedureFlowPreview
        userId="U001"
        userName="田中 太郎"
        recordDate="2026-05-11"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders error message when error occurs', () => {
    mockUseDailyProcedureFlowPreview.mockReturnValue({
      steps: [],
      isLoading: false,
      error: new Error('Failed to load steps'),
    });

    render(
      <KioskDailyProcedureFlowPreview
        userId="U001"
        userName="田中 太郎"
        recordDate="2026-05-11"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('1日の流れの取得に失敗しました')).toBeInTheDocument();
    expect(screen.getByText('Failed to load steps')).toBeInTheDocument();
  });

  it('renders steps correctly', () => {
    mockUseDailyProcedureFlowPreview.mockReturnValue({
      steps: [
        {
          rowNo: 1,
          time: '09:30',
          activity: '通所・朝の準備',
          activityDetail: '送迎車で来所 手洗い 荷物の片づけ',
          instructionDetail: '適宜見守り、必要に応じて声掛けを行います',
          isKey: true,
          block: 'morning',
          record: {
            status: 'completed',
            memo: '落ち着いていました',
            recordedAt: '2026-05-11T10:00:00Z',
            recordedBy: '佐藤',
          },
        },
        {
          rowNo: 2,
          time: '10:00',
          activity: '午前作業',
          isKey: false,
          block: 'morning',
        },
      ],
      isLoading: false,
      error: null,
    });

    render(
      <KioskDailyProcedureFlowPreview
        userId="U001"
        userName="田中 太郎"
        recordDate="2026-05-11"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('通所・朝の準備')).toBeInTheDocument();
    expect(screen.getByText('午前作業')).toBeInTheDocument();
    expect(screen.getByText('落ち着いていました')).toBeInTheDocument();
    expect(screen.getByText(/佐藤/)).toBeInTheDocument();
  });
});
