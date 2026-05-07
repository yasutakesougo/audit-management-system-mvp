import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KioskProcedureDetailScreen } from '../KioskProcedureDetailScreen';
import { MemoryRouter } from 'react-router-dom';

// Mock dependencies
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ userId: 'U001', slotKey: '0' }),
    useLocation: () => ({ search: '' }),
  };
});

vi.mock('@/features/users/useUsers', () => ({
  useUser: () => ({ data: { FullName: '田中 太郎' }, status: 'success' }),
}));

const mockProcedures = [
  { id: 'P001', time: '10:00', activity: '朝のバイタルチェック', instruction: '体温と血圧を測ります。' }
];

vi.mock('@/features/daily/hooks/useProcedureData', () => ({
  useProcedureData: () => ({
    getByUser: () => mockProcedures
  }),
}));

const mockSaveRecord = vi.fn().mockResolvedValue(undefined);
vi.mock('@/features/daily/hooks/useExecutionRecord', () => ({
  useExecutionRecord: () => ({
    record: null,
    saveRecord: mockSaveRecord,
    isLoading: false,
  }),
}));

describe('KioskProcedureDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders procedure details correctly', () => {
    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    expect(screen.getByText('10:00 - 朝のバイタルチェック')).toBeInTheDocument();
    expect(screen.getByText('田中 太郎 様')).toBeInTheDocument();
  });

  it('calls saveRecord with "completed" and empty memo when Complete button is clicked', async () => {
    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    const completeButton = screen.getByTestId('kiosk-complete-btn');
    fireEvent.click(completeButton);

    expect(mockSaveRecord).toHaveBeenCalledWith('completed', '');
    
    await waitFor(() => {
      expect(screen.getByText('記録を保存しました')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('expands observation panel when Trigger button is clicked, then saves with serialized memo', async () => {
    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    const triggerButton = screen.getByTestId('kiosk-trigger-btn');
    fireEvent.click(triggerButton);

    // Panel should appear
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
    expect(mockSaveRecord).toHaveBeenCalledWith('triggered', expectedMemo);
  });

  it('navigates back when back button is clicked', () => {
    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    const backButton = screen.getByTestId('kiosk-procedure-detail-back');
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/kiosk/users/U001/procedures');
  });
});
