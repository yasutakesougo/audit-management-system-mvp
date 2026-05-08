import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KioskProcedureDetailScreen } from '../KioskProcedureDetailScreen';
import { MemoryRouter } from 'react-router-dom';

// Mock dependencies
const mockNavigate = vi.fn();
const mockUseLocation = vi.fn(() => ({ search: '?kiosk=1&provider=memory' }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ userId: 'U001', slotKey: '0' }),
    useLocation: () => mockUseLocation(),
  };
});

vi.mock('@/features/users/useUsers', () => ({
  useUser: () => ({ data: { FullName: '田中 太郎' }, status: 'success' }),
}));

const mockProcedures = [
  {
    id: 'P001',
    time: '10:00',
    activity: '朝のバイタルチェック',
    instruction: '体温と血圧を測ります。',
    activityDetail: '体温と血圧を測る',
    instructionDetail: '測定の声かけと記録を行う',
  }
];

vi.mock('@/features/daily/hooks/useProcedureData', () => ({
  useProcedureData: () => ({
    getByUser: () => mockProcedures
  }),
}));

const mockSaveRecord = vi.fn().mockResolvedValue(undefined);
const mockUseExecutionRecord = vi.fn(() => ({
  record: null,
  saveRecord: mockSaveRecord,
  isLoading: false,
}));
vi.mock('@/features/daily/hooks/useExecutionRecord', () => ({
  useExecutionRecord: (...args: unknown[]) => mockUseExecutionRecord(...args),
}));

describe('KioskProcedureDetailScreen (memory provider URL for local UI behavior tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({ search: '?kiosk=1&provider=memory' });
    mockUseExecutionRecord.mockReturnValue({
      record: null,
      saveRecord: mockSaveRecord,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders procedure details correctly', () => {
    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    expect(screen.getByText('10:00 - 朝のバイタルチェック')).toBeInTheDocument();
    expect(screen.getByText('田中 太郎 様')).toBeInTheDocument();
    expect(screen.getByText('体温と血圧を測る')).toBeInTheDocument();
    expect(screen.getByText('測定の声かけと記録を行う')).toBeInTheDocument();
  });

  it('saves with serialized memo from the main "記録を保存する" action', async () => {
    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    expect(screen.getByTestId('kiosk-observation-panel')).toBeInTheDocument();

    // Select chips
    fireEvent.click(screen.getByTestId('mood-chip-不安そう'));
    fireEvent.click(screen.getByTestId('action-chip-声かけ'));
    fireEvent.click(screen.getByTestId('result-chip-途中で落ち着いた'));

    // Enter memo
    const memoInput = screen.getByTestId('kiosk-observation-memo');
    fireEvent.change(memoInput, { target: { value: '追加メモテスト' } });

    // Submit
    const submitBtn = screen.getByTestId('kiosk-observation-submit');
    fireEvent.click(submitBtn);

    const expectedMemo = `【様子】不安そう\n【対応】声かけ\n【変化】途中で落ち着いた\n【メモ】追加メモテスト`;
    expect(mockSaveRecord).toHaveBeenCalledWith('completed', expectedMemo);
    expect(screen.queryByText('記録の保存に失敗しました。再度お試しください。')).toBeNull();
  });

  it('navigates back when back button is clicked', () => {
    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    const backButton = screen.getByTestId('kiosk-procedure-detail-back');
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/kiosk/users/U001/procedures?kiosk=1&provider=memory');
  });

  it('uses date query for useExecutionRecord and saveRecord', async () => {
    mockUseLocation.mockReturnValue({ search: '?kiosk=1&provider=memory&date=2026-05-07' });

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    expect(mockUseExecutionRecord).toHaveBeenCalledWith('2026-05-07', 'U001', 'P001', ['0']);

    fireEvent.click(screen.getByTestId('mood-chip-不安そう'));
    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));
    await waitFor(() => {
      expect(mockSaveRecord).toHaveBeenCalled();
    });
  });

  it('preserves date query in return URL after save', async () => {
    mockUseLocation.mockReturnValue({ search: '?kiosk=1&provider=memory&date=2026-05-07' });
    vi.useFakeTimers();

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('mood-chip-不安そう'));
    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));
    await Promise.resolve();
    await Promise.resolve();
    expect(mockSaveRecord).toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(mockNavigate).toHaveBeenCalledWith('/kiosk/users/U001/procedures?kiosk=1&provider=memory&date=2026-05-07');
  });

  it('does not render multiple completion actions', () => {
    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    expect(screen.getAllByText('記録を保存する')).toHaveLength(1);
  });

  it('shows save error snackbar when save fails', async () => {
    mockSaveRecord.mockRejectedValueOnce(new Error('save failed'));

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('mood-chip-不安そう'));
    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));

    await waitFor(() => {
      expect(screen.getByText('記録の保存に失敗しました。再度お試しください。')).toBeInTheDocument();
    });
  });

  it('blocks save when observation content is empty', async () => {
    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));

    await waitFor(() => {
      expect(screen.getByText('手順記録の内容を1つ以上入力してください。')).toBeInTheDocument();
    });
    expect(mockSaveRecord).not.toHaveBeenCalled();
  });
});
