import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KioskProcedureListScreen } from '../KioskProcedureListScreen';
import { MemoryRouter } from 'react-router-dom';
import type { SupportPlanningSheet } from '@/domain/isp/schema';

// Mock dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ userId: 'U001' }),
  };
});

const mockUseUser = vi.fn(() => ({ data: { FullName: '田中 太郎', ServiceStartDate: undefined as string | undefined } as unknown as Record<string, unknown>, status: 'success' }));
vi.mock('@/features/users/useUsers', () => ({
  useUser: () => mockUseUser(),
}));

const mockProcedures = [
  { id: '1', rowNo: 1, time: '10:00', activity: '朝のバイタルチェック', instruction: '体温と血圧を測ります', planningSheetId: 'S001' },
  { id: 'P002', rowNo: 2, time: '12:00', activity: '昼食の介助', instruction: '見守りを行います', planningSheetId: 'S001' }
];

const mockGetByUser = vi.fn(() => mockProcedures);
vi.mock('@/features/daily/hooks/useProcedureData', () => ({
  useProcedureData: () => ({
    getByUser: () => mockGetByUser()
  }),
}));

const mockGetRecords = vi.fn();
const mockGetStoreRecords = vi.fn();
const mockGetCurrentExecutionRepositoryKind = vi.fn(() => 'local' as 'local' | 'sharepoint');

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

vi.mock('@/features/daily/repositories/sharepoint/executionRepositoryFactory', () => ({
  getCurrentExecutionRepositoryKind: () => mockGetCurrentExecutionRepositoryKind(),
}));

const mockUsePlanningSheetData = vi.fn(() => ({ data: null, isLoading: false }));
vi.mock('@/features/planning-sheet/hooks/usePlanningSheetData', () => ({
  usePlanningSheetData: () => mockUsePlanningSheetData(),
}));

const mockUseCurrentPlanningSheet = vi.fn(() => ({ currentSheet: null, allCurrentSheets: [], isLoading: false, error: null }));
vi.mock('@/features/planning-sheet/hooks/useCurrentPlanningSheet', () => ({
  useCurrentPlanningSheet: () => mockUseCurrentPlanningSheet(),
}));

vi.mock('@/features/planning-sheet/hooks/usePlanningSheetRepositories', () => ({
  usePlanningSheetRepositories: () => ({}),
}));

describe('KioskProcedureListScreen (includes local/memory-style recorded-state checks)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 4, 8));
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({ data: { FullName: '田中 太郎' }, status: 'success' });
    mockGetCurrentExecutionRepositoryKind.mockReturnValue('local');
    mockGetStoreRecords.mockReturnValue([]);
    mockGetByUser.mockReturnValue(mockProcedures);
    mockUsePlanningSheetData.mockReturnValue({ data: null, isLoading: false });
    mockUseCurrentPlanningSheet.mockReturnValue({ currentSheet: null, allCurrentSheets: [], isLoading: false, error: null });
    mockGetRecords.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('does not show "記録済み" from store-only data when repository kind is sharepoint', async () => {
    mockGetCurrentExecutionRepositoryKind.mockReturnValue('sharepoint');
    mockGetRecords.mockResolvedValue([]);
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
      expect(within(firstCard).queryByText('記録済み')).toBeNull();
      expect(within(firstCard).getByText('未実施')).toBeInTheDocument();
      expect(screen.getByText('実施状況: 0 / 2')).toBeInTheDocument();
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

  it('uses date query when provided for store/repository record fetch', async () => {
    render(
      <MemoryRouter initialEntries={['/kiosk/users/U001/procedures?date=2026-05-07']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetStoreRecords).toHaveBeenCalledWith('2026-05-07', 'U001');
      expect(mockGetRecords).toHaveBeenCalledWith('2026-05-07', 'U001');
    });
  });

  it('uses today when date query is missing', async () => {
    render(
      <MemoryRouter initialEntries={['/kiosk/users/U001/procedures?provider=memory&kiosk=1']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetStoreRecords).toHaveBeenCalledWith('2026-05-08', 'U001');
      expect(mockGetRecords).toHaveBeenCalledWith('2026-05-08', 'U001');
    });
  });

  it('falls back to today when date query is invalid', async () => {
    render(
      <MemoryRouter initialEntries={['/kiosk/users/U001/procedures?date=2026-13-99&provider=memory']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetStoreRecords).toHaveBeenCalledWith('2026-05-08', 'U001');
      expect(mockGetRecords).toHaveBeenCalledWith('2026-05-08', 'U001');
    });
  });

  it('shows fetch error snackbar when repository fetch fails', async () => {
    mockGetRecords.mockRejectedValue(new Error('fetch failed'));

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('記録の取得に失敗しました。再読み込みしてください。')).toBeInTheDocument();
    });
  });

  it('Case 1: renders supportStartDate from planningSheet when planningSheet.supportStartDate is present', async () => {
    mockUseUser.mockReturnValue({
      data: { FullName: '田中 太郎', ServiceStartDate: '2026-04-01' },
      status: 'success',
    });
    mockUsePlanningSheetData.mockReturnValue({
      data: { supportStartDate: '2026-05-01' } as unknown as SupportPlanningSheet,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/支援開始日: 2026年5月1日（90日参考・支援計画）/)).toBeInTheDocument();
    });
  });

  it('Case 2: renders ServiceStartDate from user master when planningSheet.supportStartDate is not present', async () => {
    mockUseUser.mockReturnValue({
      data: { FullName: '田中 太郎', ServiceStartDate: '2026-04-01' },
      status: 'success',
    });
    mockUsePlanningSheetData.mockReturnValue({
      data: { supportStartDate: undefined } as unknown as SupportPlanningSheet,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/支援開始日: 2026年4月1日（90日参考・利用者マスタ）/)).toBeInTheDocument();
    });
  });

  it('Case 3: renders appliedFrom from planningSheet when supportStartDate and ServiceStartDate are both absent', async () => {
    mockUseUser.mockReturnValue({
      data: { FullName: '田中 太郎', ServiceStartDate: undefined },
      status: 'success',
    });
    mockUsePlanningSheetData.mockReturnValue({
      data: { supportStartDate: undefined, appliedFrom: '2026-03-01' } as unknown as SupportPlanningSheet,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/\[暫定\] 支援開始日: 2026年3月1日（90日参考・計画適用日）/)).toBeInTheDocument();
    });
  });

  it('Case 4: renders unset message when planningSheetId, supportStartDate, ServiceStartDate and appliedFrom are all absent', async () => {
    mockUseUser.mockReturnValue({
      data: { FullName: '田中 太郎', ServiceStartDate: undefined },
      status: 'success',
    });
    mockGetByUser.mockReturnValue([
      { id: '1', rowNo: 1, time: '10:00', activity: '朝のバイタルチェック', instruction: '体温と血圧を測ります' }
    ]);
    mockUsePlanningSheetData.mockReturnValue({
      data: null,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/支援開始日: 未設定（90日参考）/)).toBeInTheDocument();
    });
  });

  it('Loading case: renders confirmation message during loading when planningSheetId is present but data is not loaded yet', async () => {
    mockUseUser.mockReturnValue({
      data: { FullName: '田中 太郎', ServiceStartDate: undefined },
      status: 'success',
    });
    mockUsePlanningSheetData.mockReturnValue({
      data: null,
      isLoading: true,
    });

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/支援開始日: 確認中（90日参考）/)).toBeInTheDocument();
    });
  });

  it('Fallback lookup case: renders supportStartDate from useCurrentPlanningSheet when planningSheet is absent but currentSheet is loaded', async () => {
    mockUseUser.mockReturnValue({
      data: { FullName: '田中 太郎', ServiceStartDate: undefined },
      status: 'success',
    });
    mockUsePlanningSheetData.mockReturnValue({
      data: null,
      isLoading: false,
    });
    mockUseCurrentPlanningSheet.mockReturnValue({
      currentSheet: { supportStartDate: '2026-05-15', appliedFrom: null } as any,
      allCurrentSheets: [],
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/支援開始日: 2026年5月15日（90日参考・支援計画）/)).toBeInTheDocument();
    });
  });
});
