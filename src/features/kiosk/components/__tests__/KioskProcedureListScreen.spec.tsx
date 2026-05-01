import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KioskProcedureListScreen } from '../KioskProcedureListScreen';
import { MemoryRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ userId: 'U001' }),
  };
});

vi.mock('@/features/users/useUsers', () => ({
  useUser: () => ({ data: { FullName: '田中 太郎' }, status: 'success' }),
}));

const mockProcedures = [
  { id: 'P001', time: '10:00', activity: '朝のバイタルチェック', instruction: '体温と血圧を測ります' },
  { id: 'P002', time: '12:00', activity: '昼食の介助', instruction: '見守りを行います' }
];

vi.mock('@/features/daily/hooks/useProcedureData', () => ({
  useProcedureData: () => ({
    getByUser: () => mockProcedures
  }),
}));

const mockGetRecords = vi.fn().mockResolvedValue([
  { scheduleItemId: 'P001', status: 'completed' }
]);

vi.mock('@/features/daily/hooks/useExecutionData', () => ({
  useExecutionData: () => ({
    getRecords: mockGetRecords
  }),
}));

describe('KioskProcedureListScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders procedure list and calculates progress correctly', async () => {
    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    expect(screen.getByText(/田中 太郎/)).toBeInTheDocument();
    expect(screen.getByText('朝のバイタルチェック')).toBeInTheDocument();
    expect(screen.getByText('昼食の介助')).toBeInTheDocument();

    await waitFor(() => {
      // P001 is completed, so 1 / 2
      expect(screen.getByText('実施状況: 1 / 2')).toBeInTheDocument();
      // P001 should have an "実施済み" chip
      expect(screen.getByText('実施済み')).toBeInTheDocument();
    });
  });

  it('shows "未実施" for procedures without records', async () => {
    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('未実施')).toBeInTheDocument();
    });
  });
});
