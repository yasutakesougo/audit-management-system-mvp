import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import QuickRecordTab, { getInitialOccurredAt } from '../QuickRecordTab';
import { MemoryRouter } from 'react-router-dom';
import { useAbcDailySupportIntegration } from '@/features/daily/hooks/useAbcDailySupportIntegration';

// モック定義
const mockSaveAbcRecord = vi.fn().mockResolvedValue({ id: 'abc-123' });
vi.mock('@/infra/abc/useAbcRecordRepository', () => ({
  useAbcRecordRepository: () => ({
    save: mockSaveAbcRecord,
  }),
}));

const mockGetByUser = vi.fn().mockReturnValue([
  { id: 'step-1', rowNo: 1, time: '10:00', activity: '朝のバイタルチェック', instruction: '体温測定' },
]);
vi.mock('@/features/daily/hooks/useProcedureData', () => ({
  useProcedureData: () => ({
    getByUser: mockGetByUser,
  }),
}));

const mockGetRecord = vi.fn().mockResolvedValue(undefined);
const mockUpsertRecord = vi.fn().mockResolvedValue(undefined);
vi.mock('@/features/daily/hooks/useExecutionData', () => ({
  useExecutionData: () => ({
    getRecord: mockGetRecord,
    upsertRecord: mockUpsertRecord,
  }),
}));

// react-router-dom は実際のものと navigate モックを併用
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('getInitialOccurredAt (pure function)', () => {
  beforeEach(() => {
    const mockDate = new Date('2026-05-22T11:22:33+09:00');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('URL引数なしの場合、現在の日本時間 (Asia/Tokyo) を返す', () => {
    const result = getInitialOccurredAt();
    expect(result).toBe('2026-05-22T11:22');
  });

  it('date のみ指定された場合、本日であれば現在のローカル時刻、過去日であれば 12:00 を返す', () => {
    const resultToday = getInitialOccurredAt('2026-05-22');
    expect(resultToday).toBe('2026-05-22T11:22');

    const resultPast = getInitialOccurredAt('2026-05-20');
    expect(resultPast).toBe('2026-05-20T12:00');
  });

  it('date と slotId (時刻情報あり) が指定された場合、slotId から時刻をパースして結合する', () => {
    const result = getInitialOccurredAt('2026-05-20', '9:30頃|通所・朝の準備');
    expect(result).toBe('2026-05-20T09:30');
  });
});

describe('QuickRecordTab Component - ExecutionRecord linkage', () => {
  const mockUsers = [{ id: 'user-1', label: '塩田 裕貴' }];
  const mockOnSaved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('daily-support コンテキストから遷移した際、保存時に ExecutionRecord が連動して upsert されること', async () => {
    const TestWrapper = () => {
      const { linkExecutionRecord } = useAbcDailySupportIntegration();
      return (
        <QuickRecordTab
          users={mockUsers}
          recorderName="テスト記録者"
          onSaved={mockOnSaved}
          initialUserId="user-1"
          todayRecords={[]}
          targetDate="2026-05-22"
          sourceContext={{
            source: 'daily-support',
            date: '2026-05-22',
            slotId: '10:00|朝のバイタルチェック',
            slotLabel: '朝のバイタルチェック',
          }}
          onLinkExecutionRecord={(userId, behavior, consequence, sourceContext) =>
            linkExecutionRecord(userId, behavior, consequence, sourceContext, 'テスト記録者')
          }
        />
      );
    };

    render(
      <MemoryRouter>
        <TestWrapper />
      </MemoryRouter>
    );

    // 利用者「塩田 裕貴」が初期選択されているはず
    expect(screen.getByDisplayValue('塩田 裕貴')).toBeInTheDocument();

    // A, B, C のテキストを入力
    fireEvent.change(screen.getByLabelText(/A: 直前の状況/), { target: { value: '名前を呼んだ' } });
    fireEvent.change(screen.getByLabelText(/B: 行動/), { target: { value: '大声を出した' } });
    fireEvent.change(screen.getByLabelText(/C: 結果/), { target: { value: '静かな部屋へ誘導した' } });

    // 保存ボタンをクリック
    const saveBtn = screen.getByRole('button', { name: /ABC 記録を保存/ });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      // 1. ABC記録が保存されたこと
      expect(mockSaveAbcRecord).toHaveBeenCalledTimes(1);
      expect(mockSaveAbcRecord).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-1',
        antecedent: '名前を呼んだ',
        behavior: '大声を出した',
        consequence: '静かな部屋へ誘導した',
      }));

      // 2. 実施手順の `rowNo: 1` から `scheduleItemId: "1"` が特定され、ExecutionRecord が upsert されたこと
      expect(mockUpsertRecord).toHaveBeenCalledTimes(1);
      expect(mockUpsertRecord).toHaveBeenCalledWith(expect.objectContaining({
        date: '2026-05-22',
        userId: 'user-1',
        scheduleItemId: '1',
        status: 'completed',
        memo: expect.stringContaining('【メモ】[ABC記録] 行動: 大声を出した\n結果: 静かな部屋へ誘導した'),
      }));

      // 3. コールバックが呼ばれたこと
      expect(mockOnSaved).toHaveBeenCalledTimes(1);
    });
  });
});
