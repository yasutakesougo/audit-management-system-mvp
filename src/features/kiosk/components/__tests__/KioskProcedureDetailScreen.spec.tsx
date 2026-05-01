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
  };
});

vi.mock('@/features/users/useUsers', () => ({
  useUser: () => ({ data: { FullName: '田中 太郎' }, status: 'success' }),
}));

const mockProcedures = [
  { id: 'P001', time: '10:00', activity: '朝のバイタルチェック', instruction: '体温と血圧を測ります' }
];

vi.mock('@/features/daily/hooks/useProcedureData', () => ({
  useProcedureData: () => ({
    getByUser: () => mockProcedures
  }),
}));

const mockSetStatus = vi.fn().mockResolvedValue(undefined);
vi.mock('@/features/daily/hooks/useExecutionRecord', () => ({
  useExecutionRecord: () => ({
    record: null,
    setStatus: mockSetStatus,
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

  it('calls setStatus with "completed" when Complete button is clicked', async () => {
    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    const completeButton = screen.getByText('実施済みにする');
    fireEvent.click(completeButton);

    expect(mockSetStatus).toHaveBeenCalledWith('completed');
    
    await waitFor(() => {
      expect(screen.getByText('記録を保存しました')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('calls setStatus with "triggered" when Triggered button is clicked', async () => {
    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    const triggeredButton = screen.getByText('注意ありで記録');
    fireEvent.click(triggeredButton);

    expect(mockSetStatus).toHaveBeenCalledWith('triggered');
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
