import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KioskProcedureListScreen } from '../KioskProcedureListScreen';
import { openThrottleCircuit, __clearSharePointThrottleCircuitBreakerForTests } from '@/lib/sp';
import { MemoryRouter } from 'react-router-dom';
import type { SupportPlanningSheet, PlanningSheetListItem } from '@/domain/isp/schema';
import type { ProcedureStep } from '@/features/daily/domain/ProcedureRepository';
import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';
import type { IUserMaster } from '@/features/users/types';
import { AuthRequiredError } from '@/lib/errors';

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';
type MockUser = Pick<IUserMaster, 'FullName'> & Partial<IUserMaster>;

type MockUseUser = {
  data: MockUser | null;
  status: AsyncStatus;
  error?: unknown;
};

type MockUseUsers = {
  data: MockUser[];
  status: AsyncStatus;
  error?: unknown;
};

type MockUsePlanningSheetData = {
  data: SupportPlanningSheet | null;
  isLoading: boolean;
  error?: string | null;
  refetch?: () => void;
};

type MockUseCurrentPlanningSheet = {
  currentSheet: Partial<PlanningSheetListItem> | null;
  allCurrentSheets: Array<Partial<PlanningSheetListItem>>;
  isLoading: boolean;
  error: string | null;
};

const asUser = (user: MockUser): MockUser => ({
  ...user,
  Id: user.Id ?? 1,
  UserID: user.UserID ?? 'U001',
});

const makeProcedureStep = (data: Partial<ProcedureStep> = {}): ProcedureStep => ({
  id: data.id ?? 'step-0',
  time: data.time ?? '',
  activity: data.activity ?? '',
  instruction: data.instruction ?? '',
  isKey: false,
  planningSheetId: data.planningSheetId ?? 'S001',
  ...data,
});

let mockRouteUserId = 'U001';
let mockLocationSearch: string | null = null;
let mockLocationKey: string | null = null;
let mockKioskAttendance = {
  isAbsent: false,
  reason: undefined as string | undefined,
  isLoading: false,
  isError: false,
};
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ userId: mockRouteUserId }),
    useLocation: () => {
      const loc = actual.useLocation();
      return {
        ...loc,
        search: mockLocationSearch !== null ? mockLocationSearch : loc.search,
        key: mockLocationKey !== null ? mockLocationKey : loc.key,
      };
    },
  };
});

vi.mock('../../hooks/useKioskAttendance', () => ({
  useKioskAttendance: () => mockKioskAttendance,
}));

const mockUseUser = vi.fn<() => MockUseUser>(() => ({
  data: asUser({ FullName: '田中 太郎', ServiceStartDate: undefined }),
  status: 'success',
  error: null,
}));
const mockUseUsers = vi.fn<() => MockUseUsers>(() => ({
  data: [],
  status: 'success',
  error: null,
}));
vi.mock('@/features/users/useUsers', () => ({
  useUser: () => mockUseUser(),
  useUsers: () => mockUseUsers(),
}));
vi.mock('@/features/users/hooks/useUsersQuery', () => ({
  useUsersQuery: () => ({
    data: mockUseUsers().data,
    status: mockUseUsers().status === 'success' ? 'success' : mockUseUsers().status === 'error' ? 'error' : 'loading',
    error: mockUseUsers().error ?? null,
    refresh: vi.fn(),
  }),
}));

const mockProcedures = [
  makeProcedureStep({ id: '1', rowNo: 1, time: '10:00', activity: '朝のバイタルチェック', instruction: '体温と血圧を測ります', planningSheetId: 'S001', isKey: true }),
  makeProcedureStep({ id: 'P002', rowNo: 2, time: '12:00', activity: '昼食の介助', instruction: '見守りを行います', planningSheetId: 'S001', isKey: true }),
];

const mockGetByUser = vi.fn<(userId: string) => Array<Partial<ProcedureStep>>>(() => mockProcedures);
vi.mock('@/features/daily/hooks/useProcedureData', () => ({
  useProcedureData: () => ({
    getByUser: mockGetByUser,
  }),
}));

const mockGetRecords = vi.fn<(date: string, userId: string) => Promise<Array<Partial<ExecutionRecord>>>>();
const mockGetRecord = vi.fn<
  (date: string, userId: string, scheduleItemId: string) => Promise<Partial<ExecutionRecord> | undefined>
>();
const mockGetStoreRecords = vi.fn<(date: string, userId: string) => Array<Partial<ExecutionRecord>>>();
const mockGetCurrentExecutionRepositoryKind = vi.fn<() => 'local' | 'sharepoint'>(() => 'local');

vi.mock('@/features/daily/stores/executionStore', () => ({
  useExecutionStore: () => ({
    getRecords: mockGetStoreRecords
  }),
}));

vi.mock('@/features/daily/hooks/useExecutionData', () => ({
  useExecutionData: () => ({
    getRecords: mockGetRecords,
    getRecord: mockGetRecord,
  }),
}));

vi.mock('@/features/daily/repositories/sharepoint/executionRepositoryFactory', () => ({
  getCurrentExecutionRepositoryKind: () => mockGetCurrentExecutionRepositoryKind(),
}));

const mockUsePlanningSheetData = vi.fn<() => MockUsePlanningSheetData>(() => ({
  data: null,
  isLoading: false,
  error: null,
  refetch: () => {},
}));
vi.mock('@/features/planning-sheet/hooks/usePlanningSheetData', () => ({
  usePlanningSheetData: () => mockUsePlanningSheetData(),
}));

const mockUseCurrentPlanningSheet = vi.fn<() => MockUseCurrentPlanningSheet>(() => ({
  currentSheet: null,
  allCurrentSheets: [],
  isLoading: false,
  error: null,
}));
vi.mock('@/features/planning-sheet/hooks/useCurrentPlanningSheet', () => ({
  useCurrentPlanningSheet: () => mockUseCurrentPlanningSheet(),
}));

vi.mock('@/features/planning-sheet/hooks/usePlanningSheetRepositories', () => ({
  usePlanningSheetRepositories: () => ({}),
}));

const mockIsDemoModeEnabled = vi.fn(() => false);
const mockShouldSkipSharePoint = vi.fn(() => false);
const mockShouldSkipLogin = vi.fn(() => false);

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual('@/lib/env');
  return {
    ...actual,
    isDemoModeEnabled: () => mockIsDemoModeEnabled(),
    shouldSkipSharePoint: () => mockShouldSkipSharePoint(),
    shouldSkipLogin: () => mockShouldSkipLogin(),
  };
});

describe('KioskProcedureListScreen (includes local/memory-style recorded-state checks)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 4, 8));
    vi.clearAllMocks();
    __clearSharePointThrottleCircuitBreakerForTests();
    mockRouteUserId = 'U001';
    mockLocationSearch = null;
    mockLocationKey = null;
    mockUseUser.mockReturnValue({ data: asUser({ FullName: '田中 太郎' }), status: 'success', error: null });
    mockUseUsers.mockReturnValue({ data: [], status: 'success', error: null });
    mockGetCurrentExecutionRepositoryKind.mockReturnValue('local');
    mockGetStoreRecords.mockReturnValue([]);
    mockGetByUser.mockReturnValue(mockProcedures);
    mockUsePlanningSheetData.mockReturnValue({ data: null, isLoading: false, error: null, refetch: vi.fn() });
    mockUseCurrentPlanningSheet.mockReturnValue({ currentSheet: null, allCurrentSheets: [], isLoading: false, error: null });
    mockGetRecords.mockResolvedValue([]);
    mockGetRecord.mockResolvedValue(undefined);
    mockKioskAttendance = {
      isAbsent: false,
      reason: undefined,
      isLoading: false,
      isError: false,
    };
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

  it('shows saved record summary on recorded procedure cards', async () => {
    mockGetRecords.mockResolvedValue([
      {
        scheduleItemId: '1',
        status: 'completed',
        memo: '【様子】落ち着いていた\n【対応】見守り\n【変化】改善した\n【メモ】問題なく実施完了',
      }
    ]);

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      const firstCard = screen.getByTestId('kiosk-procedure-card-0');
      const summary = within(firstCard).getByTestId('kiosk-procedure-record-summary-0');
      expect(summary).toHaveTextContent('様子: 落ち着いていた');
      expect(summary).toHaveTextContent('対応: 見守り');
      expect(summary).toHaveTextContent('変化: 改善した');
      expect(summary).toHaveTextContent('メモ: 問題なく実施完了');
    });
  });

  it('does not show saved record summary on unrecorded procedure cards', async () => {
    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      const firstCard = screen.getByTestId('kiosk-procedure-card-0');
      expect(within(firstCard).getByText('未実施')).toBeInTheDocument();
      expect(within(firstCard).queryByTestId('kiosk-procedure-record-summary-0')).toBeNull();
    });
  });

  it('shows an auth-required alert instead of user-not-found when user lookup requires Microsoft 365 auth', async () => {
    mockRouteUserId = '23';
    mockUseUser.mockReturnValue({
      data: null,
      status: 'error',
      error: new AuthRequiredError(),
    });
    mockUseUsers.mockReturnValue({
      data: [],
      status: 'error',
      error: new AuthRequiredError(),
    });

    render(
      <MemoryRouter initialEntries={['/kiosk/users/23/procedures']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    const alert = await screen.findByTestId('kiosk-auth-required-alert');
    expect(alert).toHaveTextContent('Microsoft 365 の認証が必要です。再ログイン後にもう一度お試しください。');
    expect(within(alert).getByRole('button', { name: '再ログイン' })).toBeInTheDocument();
    expect(screen.queryByText('利用者が存在しません')).toBeNull();
  });

  it('keeps the user-not-found state when lookup succeeds without a matching user', async () => {
    mockRouteUserId = '23';
    mockUseUser.mockReturnValue({
      data: null,
      status: 'success',
      error: null,
    });
    mockUseUsers.mockReturnValue({
      data: [],
      status: 'success',
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/kiosk/users/23/procedures']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    expect(await screen.findByText('利用者が存在しません')).toBeInTheDocument();
    expect(screen.queryByTestId('kiosk-auth-required-alert')).toBeNull();
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

  it('counts records saved under route and master user IDs with row-prefixed schedule keys', async () => {
    mockRouteUserId = '17';
    const procedures17 = Array.from({ length: 17 }, (_, index) => {
      const rowNo = index + 1;
      return {
        id: `base-${rowNo}`,
        rowNo,
        time: `${String(9 + Math.floor(index / 2)).padStart(2, '0')}:00`,
        activity: `手順 ${rowNo}`,
        instruction: `支援内容 ${rowNo}`,
      };
    });
    mockGetByUser.mockReturnValue(procedures17);
    mockUseUser.mockReturnValue({
      data: { FullName: '対象 利用者', UserID: 'U017' },
      status: 'success',
    });
    mockGetRecords.mockImplementation(async (_date, userId) => {
      if (userId === 'U017') {
        return [{ scheduleItemId: 'base-1', status: 'completed' }];
      }
      if (userId === '17') {
        return [
          { scheduleItemId: 'row-2', status: 'completed' },
          { scheduleItemId: 'procedure-3', status: 'completed' },
          { scheduleItemId: 'slot_4', status: 'completed' },
          { scheduleItemId: 'base-5', status: 'completed' },
        ];
      }
      return [];
    });

    render(
      <MemoryRouter initialEntries={['/kiosk/users/17/procedures']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('実施状況: 5 / 17')).toBeInTheDocument();
      expect(screen.getByText('5 完了')).toBeInTheDocument();
      expect(screen.getAllByText('記録済み')).toHaveLength(5);
    });
  });

  it('keeps successful candidate records when one execution user ID lookup fails', async () => {
    mockRouteUserId = '17';
    const procedures17 = Array.from({ length: 17 }, (_, index) => {
      const rowNo = index + 1;
      return {
        id: `base-${rowNo}`,
        rowNo,
        time: `${String(9 + Math.floor(index / 2)).padStart(2, '0')}:00`,
        activity: `手順 ${rowNo}`,
        instruction: `支援内容 ${rowNo}`,
      };
    });
    mockGetByUser.mockReturnValue(procedures17);
    mockUseUser.mockReturnValue({
      data: { FullName: '対象 利用者', UserID: 'U017' },
      status: 'success',
    });
    mockGetRecords.mockImplementation(async (_date, userId) => {
      if (userId === '17') {
        throw new Error('numeric lookup failed');
      }
      if (userId === 'U017') {
        return [
          { scheduleItemId: 'base-1', status: 'completed' },
          { scheduleItemId: 'row-2', status: 'completed' },
          { scheduleItemId: 'procedure-3', status: 'completed' },
          { scheduleItemId: 'slot_4', status: 'completed' },
          { scheduleItemId: 'base-5', status: 'completed' },
        ];
      }
      return [];
    });

    render(
      <MemoryRouter initialEntries={['/kiosk/users/17/procedures?date=2026-05-25']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('実施状況: 5 / 17')).toBeInTheDocument();
      expect(screen.getByText('5 完了')).toBeInTheDocument();
      expect(screen.getAllByText('記録済み')).toHaveLength(5);
      expect(screen.queryByText('記録の取得に失敗しました。再読み込みしてください。')).toBeNull();
    });
  });

  it('prefers fetched SharePoint records over stale local cache after remote read completes', async () => {
    mockGetCurrentExecutionRepositoryKind.mockReturnValue('sharepoint');
    mockGetStoreRecords.mockReturnValue([
      { scheduleItemId: '1', status: 'completed', memo: 'stale local cache' },
    ]);
    mockGetRecords.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('実施状況: 0 / 2')).toBeInTheDocument();
      const firstCard = screen.getByTestId('kiosk-procedure-card-0');
      expect(within(firstCard).queryByText('記録済み')).toBeNull();
      expect(within(firstCard).getByText('未実施')).toBeInTheDocument();
    });
  });

  it('shows stale store records without the recency filter when SharePoint record fetch fails', async () => {
    mockGetCurrentExecutionRepositoryKind.mockReturnValue('sharepoint');
    mockGetStoreRecords.mockReturnValue([
      {
        scheduleItemId: '1',
        status: 'completed',
        memo: 'saved before throttling',
        recordedAt: '2026-05-07T23:50:00+09:00',
      },
    ]);
    mockGetRecords.mockRejectedValue(new Error('Connection failed'));

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      const firstCard = screen.getByTestId('kiosk-procedure-card-0');
      expect(within(firstCard).getByText('同期状態未確認')).toBeInTheDocument();
      expect(within(firstCard).queryByText('記録済み')).toBeNull();
      expect(within(firstCard).queryByText('未実施')).toBeNull();
      expect(screen.getByText('実施状況: 1 / 2')).toBeInTheDocument();
      expect(screen.getByText('記録の取得に失敗しました。再読み込みしてください。')).toBeInTheDocument();
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
      { scheduleItemId: '1', status: undefined, note: '記録あり' } as Partial<ExecutionRecord>,
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
      {
        scheduleItemId: '1',
        status: 'saved' as unknown as ExecutionRecord['status'],
        additionalInfo: '入力あり',
      } as unknown as Partial<ExecutionRecord>,
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

  it('shows "記録済み" from store-only data even when repository kind is sharepoint for immediate reactivity', async () => {
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
      expect(within(firstCard).getByText('記録済み')).toBeInTheDocument();
      expect(within(firstCard).queryByText('未実施')).toBeNull();
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
      currentSheet: { supportStartDate: '2026-05-15', appliedFrom: null } satisfies Partial<PlanningSheetListItem> as PlanningSheetListItem,
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

  it('does not show setup CTA even when support start date is unset', async () => {
    mockUseUser.mockReturnValue({
      data: { FullName: '田中 太郎', ServiceStartDate: undefined },
      status: 'success',
    });
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
      expect(screen.queryByTestId('kiosk-support-start-setup-cta')).toBeNull();
    });
  });

  it('does not show planning draft review CTA even when planning sheet status is draft', async () => {
    mockUseUser.mockReturnValue({
      data: { FullName: '田中 太郎', ServiceStartDate: '2026-04-01' },
      status: 'success',
    });
    mockUsePlanningSheetData.mockReturnValue({
      data: { id: 'sp-123', status: 'draft', supportStartDate: '2026-05-01' } as unknown as SupportPlanningSheet,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('kiosk-planning-draft-review-cta')).toBeNull();
      expect(screen.queryByText(/この支援計画シートは下書きです/)).toBeNull();
    });
  });

  it('does not show planning draft review CTA when planning sheet status is active', async () => {
    mockUseUser.mockReturnValue({
      data: { FullName: '田中 太郎', ServiceStartDate: '2026-04-01' },
      status: 'success',
    });
    mockUsePlanningSheetData.mockReturnValue({
      data: { id: 'sp-123', status: 'active', supportStartDate: '2026-05-01' } as unknown as SupportPlanningSheet,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('kiosk-planning-draft-review-cta')).toBeNull();
      expect(screen.queryByText(/この支援計画シートは下書きです/)).toBeNull();
    });
  });

  it('prefers query userId over route userId when loading user-scoped data', async () => {
    mockRouteUserId = '6';
    mockUseUser.mockReturnValue({
      data: { FullName: '石渡 亮', UserID: 'I005', ServiceStartDate: undefined },
      status: 'success',
    });

    render(
      <MemoryRouter initialEntries={['/kiosk/users/6/procedures?wizard=plan&user=I005&userId=I005']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetByUser).toHaveBeenCalledWith('I005');
      expect(mockGetStoreRecords).toHaveBeenCalledWith(expect.any(String), 'I005');
    });
  });

  it('does not show setup CTA when support start date is from planning sheet', async () => {
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
      expect(screen.queryByTestId('kiosk-support-start-setup-cta')).toBeNull();
    });
  });

  it('does not show provisional review CTA even for fallback source', async () => {
    mockUseUser.mockReturnValue({
      data: { FullName: '田中 太郎', ServiceStartDate: undefined },
      status: 'success',
    });
    mockUsePlanningSheetData.mockReturnValue({
      data: { id: 'sp-123', supportStartDate: undefined, appliedFrom: '2026-03-01' } as unknown as SupportPlanningSheet,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('kiosk-support-start-provisional-cta')).toBeNull();
      expect(screen.queryByTestId('kiosk-support-start-setup-cta')).toBeNull();
    });
  });

  it('does not show setup CTA even when support start date is invalid', async () => {
    mockUseUser.mockReturnValue({
      data: { FullName: '田中 太郎', ServiceStartDate: undefined },
      status: 'success',
    });
    mockUsePlanningSheetData.mockReturnValue({
      data: { id: 'sp-123', supportStartDate: '2026-13-99' } as unknown as SupportPlanningSheet,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/支援開始日: 不正な日付（90日参考）/)).toBeInTheDocument();
      expect(screen.queryByTestId('kiosk-support-start-setup-cta')).toBeNull();
    });
  });

  it('synchronously clears records when user changes to prevent temporal display of stale records', async () => {
    mockGetRecords.mockImplementation(async (date, userId) => {
      if (userId === 'U001') {
        return [{ scheduleItemId: '1', status: 'completed' }];
      }
      return new Promise((resolve) => setTimeout(() => resolve([]), 50));
    });

    mockUseUser.mockImplementation(() => ({
      data: { FullName: '田中 太郎', UserID: 'U001' },
      status: 'success',
    }));

    const { rerender } = render(
      <MemoryRouter initialEntries={['/kiosk/users/U001/procedures']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      const firstCard = screen.getByTestId('kiosk-procedure-card-0');
      expect(within(firstCard).getByText('記録済み')).toBeInTheDocument();
    });

    mockRouteUserId = 'U002';
    mockLocationKey = 'new-user-key';
    mockUseUser.mockImplementation(() => ({
      data: { FullName: '鈴木 次郎', UserID: 'U002' },
      status: 'success',
    }));

    rerender(
      <MemoryRouter initialEntries={['/kiosk/users/U002/procedures']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/鈴木 次郎/)).toBeInTheDocument();
    });

    const firstCard = screen.getByTestId('kiosk-procedure-card-0');
    expect(within(firstCard).queryByText('記録済み')).toBeNull();
    expect(within(firstCard).getByText('未実施')).toBeInTheDocument();
  });

  it('synchronously clears records when date query changes to prevent temporal display of stale records', async () => {
    mockGetRecords.mockImplementation(async (date) => {
      if (date === '2026-05-08') {
        return [{ scheduleItemId: '1', status: 'completed' }];
      }
      return new Promise((resolve) => setTimeout(() => resolve([]), 50));
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/kiosk/users/U001/procedures?date=2026-05-08']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      const firstCard = screen.getByTestId('kiosk-procedure-card-0');
      expect(within(firstCard).getByText('記録済み')).toBeInTheDocument();
    });

    mockLocationSearch = '?date=2026-05-09';
    mockLocationKey = 'new-date-key';

    rerender(
      <MemoryRouter initialEntries={['/kiosk/users/U001/procedures?date=2026-05-09']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/2026年5月9日/)).toBeInTheDocument();
    });

    const firstCard = screen.getByTestId('kiosk-procedure-card-0');
    expect(within(firstCard).queryByText('記録済み')).toBeNull();
    expect(within(firstCard).getByText('未実施')).toBeInTheDocument();
  });

  it('marks a procedure as recorded when the record status is "skipped"', async () => {
    mockGetRecords.mockResolvedValue([
      { scheduleItemId: '1', status: 'skipped', memo: '' }
    ]);

    mockUseUser.mockReturnValue({
      data: { FullName: '田中 太郎', UserID: 'U001' },
      status: 'success',
    });

    render(
      <MemoryRouter initialEntries={['/kiosk/users/U001/procedures']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      const firstCard = screen.getByTestId('kiosk-procedure-card-0');
      expect(within(firstCard).getByText('記録済み')).toBeInTheDocument();
      expect(within(firstCard).queryByText('未実施')).toBeNull();
    });
  });

  it('matches planning-sheet scoped procedure IDs to row-number execution records', async () => {
    mockGetByUser.mockReturnValue([
      {
        id: 'official-sheet-1809-1',
        time: '9:30頃',
        activity: '通所・朝の準備',
        instruction: '送迎担当と引継ぎ',
      },
      {
        id: 'official-sheet-1809-2',
        time: '10:00頃',
        activity: '体操',
        instruction: '見守り',
      },
    ]);
    mockGetRecords.mockResolvedValue([
      { scheduleItemId: '1', status: 'completed', memo: 'saved row 1' },
      { scheduleItemId: '2', status: 'completed', memo: 'saved row 2' },
    ]);

    render(
      <MemoryRouter initialEntries={['/kiosk/users/U001/procedures']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('実施状況: 2 / 2')).toBeInTheDocument();
      expect(screen.getAllByText('記録済み')).toHaveLength(2);
    });
  });

  it('fills sparse bulk results with procedure-level record lookups', async () => {
    mockGetByUser.mockReturnValue([
      {
        id: 'official-sheet-1809-1',
        time: '9:30頃',
        activity: '通所・朝の準備',
        instruction: '送迎担当と引継ぎ',
      },
    ]);
    mockGetRecords.mockResolvedValue([]);
    mockGetRecord.mockImplementation(async (_date, _userId, scheduleItemId) => {
      if (scheduleItemId === '1') {
        return { scheduleItemId: '1', status: 'completed', memo: 'saved row 1' };
      }
      return undefined;
    });

    render(
      <MemoryRouter initialEntries={['/kiosk/users/U001/procedures']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('実施状況: 1 / 1')).toBeInTheDocument();
      const firstCard = screen.getByTestId('kiosk-procedure-card-0');
      expect(within(firstCard).getByText('記録済み')).toBeInTheDocument();
      expect(within(firstCard).queryByText('未実施')).toBeNull();
    });
  });

  it('skips procedure-level lookups for SharePoint after bulk lookup completes', async () => {
    mockGetByUser.mockReturnValue([
      {
        id: 'official-sheet-1809-1',
        time: '9:30頃',
        activity: '通所・朝の準備',
        instruction: '送迎担当と引継ぎ',
      },
      {
        id: 'official-sheet-1809-2',
        time: '10:00頃',
        activity: '体操',
        instruction: '見守り',
      },
    ]);
    mockGetCurrentExecutionRepositoryKind.mockReturnValue('sharepoint');
    mockGetRecords.mockResolvedValue([]);
    mockGetRecord.mockResolvedValue({ scheduleItemId: '1', status: 'completed', memo: 'saved row 1' });
    const callsBeforeRender = mockGetRecord.mock.calls.length;

    render(
      <MemoryRouter initialEntries={['/kiosk/users/U001/procedures']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('実施状況: 0 / 2')).toBeInTheDocument();
    });
    expect(mockGetRecord.mock.calls.slice(callsBeforeRender)).toHaveLength(0);
  });

  it('waits for user to load before fetching route and master user ID candidates', async () => {
    mockRouteUserId = '17';
    // Start as loading
    let userState: MockUseUser = { data: undefined as unknown as MockUser | null, status: 'loading' };
    mockUseUser.mockImplementation(() => userState);

    // Track calls to mockGetRecords
    mockGetRecords.mockClear();
    mockGetRecords.mockImplementation(async (date, userId) => {
      if (userId === 'U001') {
        return [{ scheduleItemId: '1', status: 'completed' }];
      }
      return [];
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/kiosk/users/17/procedures']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    // Initial render should be loading state
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
    // At this point, mockGetRecords should NOT have been called because user loading is true
    expect(mockGetRecords).not.toHaveBeenCalled();

    // Now, transition user to success
    userState = {
      data: { FullName: '田中 太郎', UserID: 'U001' } as any,
      status: 'success',
    };

    // Trigger rerender to simulate useUser state update
    rerender(
      <MemoryRouter initialEntries={['/kiosk/users/17/procedures']}>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    // Verify it loads and shows "記録済み"
    await waitFor(() => {
      expect(screen.queryByText('読み込み中...')).toBeNull();
      const firstCard = screen.getByTestId('kiosk-procedure-card-0');
      expect(within(firstCard).getByText('記録済み')).toBeInTheDocument();
    });

    // Verify that fetches start only after the master user is resolved.
    expect(mockGetRecords).toHaveBeenCalledWith(expect.any(String), 'U001');
    expect(mockGetRecords).toHaveBeenCalledWith(expect.any(String), '17');
  });

  it('correctly matches 6 completed execution records (1 to 6) to the first 6 procedure rows (1-based rowNo match)', async () => {
    const procedures17 = Array.from({ length: 17 }, (_, index) => {
      const rowNo = index + 1;
      return {
        id: `base-${rowNo}`,
        rowNo,
        time: `${String(9 + Math.floor(index / 2)).padStart(2, '0')}:00`,
        activity: `手順 ${rowNo}`,
        instruction: `支援内容 ${rowNo}`,
      };
    });
    mockGetByUser.mockReturnValue(procedures17);

    mockGetRecords.mockResolvedValue([
      { scheduleItemId: '1', status: 'completed', memo: '実施済み1' },
      { scheduleItemId: '2', status: 'completed', memo: '実施済み2' },
      { scheduleItemId: '3', status: 'completed', memo: '実施済み3' },
      { scheduleItemId: '4', status: 'completed', memo: '実施済み4' },
      { scheduleItemId: '5', status: 'completed', memo: '実施済み5' },
      { scheduleItemId: '6', status: 'completed', memo: '実施済み6' },
    ]);

    render(
      <MemoryRouter>
        <KioskProcedureListScreen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('実施状況: 6 / 17')).toBeInTheDocument();
      expect(screen.getByText('6 完了')).toBeInTheDocument();
      expect(screen.getAllByText('記録済み')).toHaveLength(6);
    });

    // Explicitly verify that 7th card (index 6) onwards are not completed
    for (let i = 6; i < 17; i++) {
      const card = screen.getByTestId(`kiosk-procedure-card-${i}`);
      expect(within(card).getByText('未実施')).toBeInTheDocument();
      expect(within(card).queryByText('記録済み')).toBeNull();
    }
  });

  describe('SharePoint Throttle Circuit Breaker UX Alert', () => {
    it('shows inline warning Alert with countdown and disabled button when circuit breaker is active', async () => {
      // Open the circuit breaker manually at t=0
      const startTime = Date.now();
      openThrottleCircuit(startTime);

      render(
        <MemoryRouter>
          <KioskProcedureListScreen />
        </MemoryRouter>
      );

      // Verify the alert is rendered with appropriate styling and text
      const alert = await screen.findByTestId('kiosk-throttle-alert');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText(/SharePointが一時的に混み合っています。/)).toBeInTheDocument();
      expect(screen.getByText(/安全のため、サーバーへの再接続を少し待っています。/)).toBeInTheDocument();

      // Verify the button is disabled and displays the countdown (30 seconds initially)
      const button = within(alert).getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('再試行（30秒）');

      // Advance time by 10 seconds - countdown should decrease
      vi.advanceTimersByTime(10000);
      await waitFor(() => {
        expect(button).toHaveTextContent('再試行（20秒）');
      });

      // Advance time by 20 more seconds (total 30 seconds) - breaker should close and alert should auto-hide/trigger refetch
      vi.advanceTimersByTime(20000);
      await waitFor(() => {
        expect(screen.queryByTestId('kiosk-throttle-alert')).toBeNull();
      });
    });
  });

  describe('SharePoint load failure representation', () => {
    it('shows "状態未確認" Chip and styling when SharePoint load fails and no local cache is available', async () => {
      mockGetRecords.mockRejectedValue(new Error('SharePoint fetch failed'));
      mockGetStoreRecords.mockReturnValue([]);

      render(
        <MemoryRouter>
          <KioskProcedureListScreen />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('kiosk-uncertain-chip-0')).toBeInTheDocument();
        expect(screen.getByTestId('kiosk-uncertain-chip-1')).toBeInTheDocument();
        expect(screen.queryByText('未実施')).toBeNull();
        expect(screen.queryByText('記録済み')).toBeNull();
      });
    });

    it('shows "同期状態未確認" Chip for slots with local cache and "状態未確認" for others when SharePoint load fails', async () => {
      mockGetRecords.mockRejectedValue(new Error('SharePoint fetch failed'));
      mockGetStoreRecords.mockReturnValue([
        {
          scheduleItemId: '1',
          status: 'completed',
          memo: '【様子】落ち着いていた\n【対応】見守り',
          recordedAt: '2026-05-08T10:00:00Z',
        }
      ]);

      render(
        <MemoryRouter>
          <KioskProcedureListScreen />
        </MemoryRouter>
      );

      await waitFor(() => {
        const firstCard = screen.getByTestId('kiosk-procedure-card-0');
        expect(within(firstCard).getByTestId('kiosk-uncertain-local-chip-0')).toBeInTheDocument();
        expect(within(firstCard).getByTestId('kiosk-procedure-record-summary-0')).toHaveTextContent('様子: 落ち着いていた');
        expect(within(firstCard).getByTestId('kiosk-procedure-record-summary-0')).toHaveTextContent('対応: 見守り');
        expect(screen.getByTestId('kiosk-uncertain-chip-1')).toBeInTheDocument();
        expect(screen.queryByText('未実施')).toBeNull();
        expect(screen.queryByText('記録済み')).toBeNull();
      });
    });

    it('robustly matches local cache records with ID/userId variations (prefixed, canonical, trailing match)', async () => {
      // routeUserId is mockRouteUserId = 'U001' (buildExecutionUserIdCandidates creates U001, 1, U1, U-001, etc)
      mockGetRecords.mockRejectedValue(new Error('SharePoint fetch failed'));

      // Store record has U-001 as userId (variation) and procedure match keys are evaluated
      mockGetStoreRecords.mockImplementation((_date, userId) => {
        if (userId === 'U-001') {
          return [
            { scheduleItemId: 'procedure-1', status: 'completed', recordedAt: '2026-05-08T10:00:00Z' }
          ];
        }
        return [];
      });

      render(
        <MemoryRouter>
          <KioskProcedureListScreen />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('kiosk-uncertain-local-chip-0')).toBeInTheDocument();
        expect(screen.getByTestId('kiosk-uncertain-chip-1')).toBeInTheDocument();
      });
    });
  });

  describe('Daily absence read and display (PR1)', () => {
    it('renders absence banner, "欠席のため記録対象外" chips, and hides progress bar when user is absent', async () => {
      mockKioskAttendance = {
        isAbsent: true,
        reason: '体調不良のためお休みします',
        isLoading: false,
        isError: false,
      };

      render(
        <MemoryRouter>
          <KioskProcedureListScreen />
        </MemoryRouter>
      );

      // Verify banner
      await waitFor(() => {
        expect(screen.getByTestId('kiosk-absence-banner')).toBeInTheDocument();
        expect(screen.getByText('本日は欠席として処理されています')).toBeInTheDocument();
        expect(screen.getByText(/体調不良のためお休みします/)).toBeInTheDocument();
      });

      // Verify unrecorded cards are absent
      expect(screen.getByTestId('kiosk-absent-chip-0')).toBeInTheDocument();
      expect(screen.getByTestId('kiosk-absent-chip-1')).toBeInTheDocument();
      expect(screen.queryByText('未実施')).toBeNull();

      // Verify progress summary
      expect(screen.getByText('実施状況: 欠席（記録対象外）')).toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('displays warning banner and keeps "recorded" status for existing executions when absent', async () => {
      mockKioskAttendance = {
        isAbsent: true,
        reason: '当日欠席',
        isLoading: false,
        isError: false,
      };
      // Mock one completed record
      mockGetRecords.mockResolvedValue([
        { scheduleItemId: '1', status: 'completed' },
      ]);

      render(
        <MemoryRouter>
          <KioskProcedureListScreen />
        </MemoryRouter>
      );

      // Verify banner warning
      await waitFor(() => {
        expect(screen.getByTestId('kiosk-absence-banner')).toBeInTheDocument();
        expect(screen.getByText('本日は欠席として処理されていますが、本日の実施記録が存在します')).toBeInTheDocument();
      });

      // Verify first card is recorded, second card is absent
      expect(screen.getByText('記録済み')).toBeInTheDocument();
      expect(screen.getByTestId('kiosk-absent-chip-1')).toBeInTheDocument();
      expect(screen.queryByText('未実施')).toBeNull();

      // Verify progress summary still indicates absence
      expect(screen.getByText('実施状況: 欠席（記録対象外）')).toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('falls back to "出欠状態未確認" (uncertain) when attendance load fails', async () => {
      mockKioskAttendance = {
        isAbsent: false,
        reason: undefined,
        isLoading: false,
        isError: true,
      };

      render(
        <MemoryRouter>
          <KioskProcedureListScreen />
        </MemoryRouter>
      );

      // Verify that error is integrated and unrecorded cards show "状態未確認" (uncertain) instead of "未実施"
      await waitFor(() => {
        expect(screen.getByTestId('kiosk-uncertain-chip-0')).toBeInTheDocument();
        expect(screen.getByTestId('kiosk-uncertain-chip-1')).toBeInTheDocument();
        expect(screen.queryByText('未実施')).toBeNull();
      });
    });
  });
});
