import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  { id: '1', rowNo: 1, time: '10:00', activity: '朝のバイタルチェック', instruction: '体温と血圧を測ります' },
  { id: 'P002', rowNo: 2, time: '12:00', activity: '昼食の介助', instruction: '見守りを行います' }
];

vi.mock('@/features/daily/hooks/useProcedureData', () => ({
  useProcedureData: () => ({
    getByUser: () => mockProcedures
  }),
}));

const mockGetRecords = vi.fn();
const mockGetStoreRecords = vi.fn();

vi.mock('@/features/daily/stores/executionStore', () => ({
  useExecutionStore: () => ({
    getRecords: mockGetStoreRecords
  }),
}));

vi.mock('@/features/daily/hooks/useExecutionData', () => ({
  useExecutionData: () => ({
    getRecords: mockGetRecords
  }),
}));

describe('KioskProcedureListScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStoreRecords.mockReturnValue([]);
    mockGetRecords.mockResolvedValue([]);
  });

  it('renders procedure list and calculates progress correctly', async () => {
    mockGetRecords.mockResolvedValue([
      { scheduleItemId: '1', status: 'completed' }
    ]);

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
      expect(screen.getByText('記録済み')).toBeInTheDocument();
    });
  });

  it('shows "未実施" for procedures without records', async () => {
    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('未実施')).toHaveLength(2);
    });
  });

  it('shows "記録済み" for a saved row and not "未実施" on that row', async () => {
    mockGetRecords.mockResolvedValue([
      { scheduleItemId: '1', status: 'completed' },
    ]);

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      const firstCard = screen.getByTestId('kiosk-procedure-card-0');
      expect(within(firstCard).getByText('記録済み')).toBeInTheDocument();
      expect(within(firstCard).queryByText('未実施')).toBeNull();
    });
  });

  it('matches scheduleItemId even when procedure is string and record is number', async () => {
    mockGetRecords.mockResolvedValue([
      { scheduleItemId: 1 as unknown as string, status: 'triggered' },
    ]);

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('実施状況: 1 / 2')).toBeInTheDocument();
      expect(screen.queryByText('注意あり')).toBeNull();
    });
  });

  it('does not count unmatched executionRecords in completed count', async () => {
    mockGetRecords.mockResolvedValue([
      { scheduleItemId: 'X001', status: 'completed' },
      { scheduleItemId: 'X002', status: 'completed' },
      { scheduleItemId: 'X003', status: 'triggered' },
    ]);

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('実施状況: 0 / 2')).toBeInTheDocument();
      expect(screen.getByText('0 完了')).toBeInTheDocument();
      expect(screen.queryByText('記録済み')).toBeNull();
    });
  });

  it('counts and labels matched records consistently', async () => {
    mockGetRecords.mockResolvedValue([
      { scheduleItemId: '1', status: 'completed' },
      { scheduleItemId: 'P002', status: 'triggered' },
    ]);

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('実施状況: 2 / 2')).toBeInTheDocument();
      expect(screen.getByText('1 完了')).toBeInTheDocument();
      expect(screen.getAllByText('記録済み')).toHaveLength(2);
    });
  });

  it('matches legacy index scheduleItemId with guarded fallback consistently', async () => {
    mockGetRecords.mockResolvedValue([
      { scheduleItemId: '0', status: 'completed' },
    ]);

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      const firstCard = screen.getByTestId('kiosk-procedure-card-0');
      expect(within(firstCard).getByText('記録済み')).toBeInTheDocument();
      expect(screen.getByText('実施状況: 1 / 2')).toBeInTheDocument();
      expect(screen.getByText('1 完了')).toBeInTheDocument();
    });
  });

  it('includes legacy records with undefined status when input exists', async () => {
    mockGetRecords.mockResolvedValue([
      { scheduleItemId: '1', status: undefined, note: '記録あり' } as unknown as { scheduleItemId: string; status: string },
    ]);

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      const firstCard = screen.getByTestId('kiosk-procedure-card-0');
      expect(within(firstCard).getByText('記録済み')).toBeInTheDocument();
      expect(screen.getByText('実施状況: 1 / 2')).toBeInTheDocument();
      expect(screen.getByText('0 完了')).toBeInTheDocument();
    });
  });

  it('treats saved/recorded status with input as recorded and doneCount remains completed-only', async () => {
    mockGetRecords.mockResolvedValue([
      { scheduleItemId: '1', status: 'saved', additionalInfo: '入力あり' } as unknown as { scheduleItemId: string; status: string },
      { scheduleItemId: 'P002', status: 'completed' },
    ]);

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('実施状況: 2 / 2')).toBeInTheDocument();
      expect(screen.getByText('1 完了')).toBeInTheDocument();
      expect(screen.getAllByText('記録済み')).toHaveLength(2);
    });
  });

  it('shows "記録済み" from store even if repository fetch result is empty', async () => {
    // Repository fetch returns empty
    mockGetRecords.mockResolvedValue([]);
    // Store has the record
    mockGetStoreRecords.mockReturnValue([
      { scheduleItemId: '1', status: 'completed', id: 'STORE-1' },
    ]);

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      const firstCard = screen.getByTestId('kiosk-procedure-card-0');
      expect(within(firstCard).getByText('記録済み')).toBeInTheDocument();
      expect(screen.getByText('実施状況: 1 / 2')).toBeInTheDocument();
    });
  });

  it('merges store and repository records by scheduleItemId even if IDs differ', async () => {
    // Repository has record with ID-REPO
    mockGetRecords.mockResolvedValue([
      { scheduleItemId: '1', status: 'completed', id: 'ID-REPO' },
    ]);
    // Store has record with ID-STORE
    mockGetStoreRecords.mockReturnValue([
      { scheduleItemId: '1', status: 'completed', id: 'ID-STORE' },
    ]);

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Should still be 1/2, not 2/2 or something else
      expect(screen.getByText('実施状況: 1 / 2')).toBeInTheDocument();
      const firstCard = screen.getByTestId('kiosk-procedure-card-0');
      expect(within(firstCard).getByText('記録済み')).toBeInTheDocument();
    });
  });

  it('correctly passes todayIso and userId to useExecutionStore.getRecords', async () => {
    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Check that it was called with userId from useParams mock ('U001')
      // and some date string (formatDateIso result)
      expect(mockGetStoreRecords).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        'U001'
      );
    });
  });
});
