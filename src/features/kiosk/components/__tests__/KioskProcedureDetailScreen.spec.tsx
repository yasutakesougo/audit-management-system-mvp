import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KioskProcedureDetailScreen } from '../KioskProcedureDetailScreen';
import { MemoryRouter } from 'react-router-dom';
import { resolveProcedureUserQueryCandidates } from '../../utils/resolveProcedureUserQuery';
import type { IUserMaster } from '@/features/users/types';
import type { useExecutionRecord as useExecutionRecordHook } from '@/features/daily/hooks/useExecutionRecord';
import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';

type UserHookState = {
  data: IUserMaster | null;
  status: 'idle' | 'loading' | 'success' | 'error';
};

type ExecutionRecordHookResult = ReturnType<typeof useExecutionRecordHook>;

const makeUser = (overrides: Partial<IUserMaster> = {}): IUserMaster => ({
  Id: 1,
  UserID: 'U001',
  FullName: '田中 太郎',
  ...overrides,
});

const makeExecutionRecord = (overrides: Partial<ExecutionRecord> = {}): ExecutionRecord => ({
  id: 'rec-1',
  date: '2026-05-28',
  userId: 'U001',
  scheduleItemId: 'P001',
  status: 'completed',
  triggeredBipIds: [],
  memo: '',
  recordedBy: '',
  recordedAt: '2026-05-28T10:00:00.000Z',
  ...overrides,
});

const makeExecutionRecordHookResult = (
  overrides: Partial<ExecutionRecordHookResult> = {},
): ExecutionRecordHookResult => ({
  record: undefined,
  setStatus: vi.fn(),
  setMemo: vi.fn(),
  saveRecord: mockSaveRecord,
  deleteRecord: mockDeleteRecord,
  isLoading: false,
  error: null,
  refresh: mockRefreshRecord,
  ...overrides,
});

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

const mockUseUser = vi.fn<() => UserHookState>(() => ({ data: makeUser(), status: 'success' }));
vi.mock('@/features/users/useUsers', () => ({
  useUser: () => mockUseUser(),
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
const mockDeleteRecord = vi.fn().mockResolvedValue(undefined);
const mockRefreshRecord = vi.fn();
const mockUseExecutionRecord = vi.fn<(
  _date?: string,
  _userId?: string,
  _scheduleItemId?: string,
  _fallbackScheduleItemIds?: string[],
  _fallbackUserIds?: string[],
) => ExecutionRecordHookResult>((
  _date?: string,
  _userId?: string,
  _scheduleItemId?: string,
  _fallbackScheduleItemIds?: string[],
  _fallbackUserIds?: string[],
) => makeExecutionRecordHookResult());
vi.mock('@/features/daily/hooks/useExecutionRecord', () => ({
  useExecutionRecord: (
    date: string,
    userId: string,
    scheduleItemId: string,
    fallbackScheduleItemIds?: string[],
    fallbackUserIds?: string[],
  ) => mockUseExecutionRecord(date, userId, scheduleItemId, fallbackScheduleItemIds, fallbackUserIds),
}));

const mockUseKioskAttendance = vi.fn();
vi.mock('../../hooks/useKioskAttendance', () => ({
  useKioskAttendance: (
    userId: string | undefined,
    selectedDateIso: string,
    userCandidates: string[],
    refreshTrigger?: number,
  ) => mockUseKioskAttendance(userId, selectedDateIso, userCandidates, refreshTrigger),
}));

describe('KioskProcedureDetailScreen (memory provider URL for local UI behavior tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({ search: '?kiosk=1&provider=memory' });
    mockUseUser.mockReturnValue({ data: makeUser(), status: 'success' });
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult());
    mockUseKioskAttendance.mockReturnValue({
      isAbsent: false,
      reason: undefined,
      isLoading: false,
      isError: false,
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
    await waitFor(() => {
      expect(mockSaveRecord).toHaveBeenCalledWith('completed', expectedMemo);
    });
    await waitFor(() => {
      expect(screen.getByText('記録を保存しました')).toBeInTheDocument();
    });
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

    expect(mockUseExecutionRecord).toHaveBeenCalledWith(
      '2026-05-07',
      'U001',
      'procedure-1',
      expect.arrayContaining(['1', 'base-1', 'row-1', 'procedure-1', 'slot-1', 'slot_1', 'step-1']),
      expect.arrayContaining(['U001', '1', 'U1', 'U-001']),
    );

    fireEvent.click(screen.getByTestId('mood-chip-不安そう'));
    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));
    await waitFor(() => {
      expect(mockSaveRecord).toHaveBeenCalled();
    });
  });

  it('preserves date query in return URL after save', async () => {
    mockUseLocation.mockReturnValue({ search: '?kiosk=1&provider=memory&date=2026-05-07' });

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('mood-chip-不安そう'));
    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));
    await waitFor(() => {
      expect(mockSaveRecord).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/kiosk/users/U001/procedures?kiosk=1&provider=memory&date=2026-05-07');
    }, { timeout: 2500 });
    await waitFor(() => {
      expect(screen.getByText('記録を保存しました')).toBeInTheDocument();
    });
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

  it('shows unknown saved-state feedback and blocks save when the execution record cannot be loaded', () => {
    mockUseExecutionRecord.mockReturnValue(
      makeExecutionRecordHookResult({
        error: new Error('failed to load execution record'),
      }),
    );

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    expect(screen.getByText('保存状態未確認')).toBeInTheDocument();
    expect(screen.getByText('実施記録の読み込みに失敗しました')).toBeInTheDocument();
    expect(screen.getByText(/保存済みかどうかを確認できません/)).toBeInTheDocument();
    expect(screen.getByTestId('kiosk-observation-submit')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }));
    expect(mockRefreshRecord).toHaveBeenCalledTimes(1);
    expect(mockSaveRecord).not.toHaveBeenCalled();
  });

  it('shows a saved-record confirmation panel while keeping the editable form restored', async () => {
    mockUseExecutionRecord.mockReturnValue(
      makeExecutionRecordHookResult({
        record: makeExecutionRecord({
          memo: '【様子】落ち着いていた\n【対応】見守り\n【変化】改善した\n【メモ】問題なく実施完了',
        }),
      }),
    );

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    const panel = screen.getByTestId('kiosk-saved-record-summary');
    expect(panel).toHaveTextContent('保存済みの記録内容');
    expect(panel).toHaveTextContent('様子');
    expect(panel).toHaveTextContent('落ち着いていた');
    expect(panel).toHaveTextContent('対応');
    expect(panel).toHaveTextContent('見守り');
    expect(panel).toHaveTextContent('変化');
    expect(panel).toHaveTextContent('改善した');
    expect(panel).toHaveTextContent('メモ');
    expect(panel).toHaveTextContent('問題なく実施完了');

    await waitFor(() => {
      expect(screen.getByTestId('mood-chip-落ち着いていた').className).toContain('MuiChip-filledWarning');
      expect(screen.getByTestId('action-chip-見守り').className).toContain('MuiChip-filledWarning');
      expect(screen.getByTestId('result-chip-改善した').className).toContain('MuiChip-filledWarning');
      expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('問題なく実施完了');
    });
  });

  it('shows raw saved memo as memo fallback in the saved-record confirmation panel', async () => {
    mockUseExecutionRecord.mockReturnValue(
      makeExecutionRecordHookResult({
        record: makeExecutionRecord({
          memo: '自由入力だけの保存済みメモ',
        }),
      }),
    );

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    const panel = screen.getByTestId('kiosk-saved-record-summary');
    expect(panel).toHaveTextContent('保存済みの記録内容');
    expect(panel).toHaveTextContent('メモ');
    expect(panel).toHaveTextContent('自由入力だけの保存済みメモ');

    await waitFor(() => {
      expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('自由入力だけの保存済みメモ');
    });
  });

  it('postpones form state initialization and populates form from saved record after user load transitions from loading to success', async () => {
    mockUseUser.mockReturnValue({ data: null, status: 'loading' });

    mockUseExecutionRecord.mockImplementation((
      _date,
      userId,
    ) => {
      const isLoaded = userId === 'U001';
      return makeExecutionRecordHookResult({
        record: isLoaded
          ? makeExecutionRecord({
              memo: '【様子】落ち着いていた\n【対応】見守り\n【変化】改善した\n【メモ】問題なく実施完了',
            })
          : undefined,
        isLoading: !isLoaded,
      });
    });

    const { rerender } = render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    // Initial render during user loading shows spinner
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();

    // Transition useUser status to success
    mockUseUser.mockReturnValue({ data: makeUser(), status: 'success' });
    rerender(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    // Form should render once loaded
    await waitFor(() => {
      expect(screen.queryByText('読み込み中...')).toBeNull();
      expect(screen.getByText('10:00 - 朝のバイタルチェック')).toBeInTheDocument();
    });

    // Check if chips and memo are populated from the saved record
    await waitFor(() => {
      const moodChip = screen.getByTestId('mood-chip-落ち着いていた');
      expect(moodChip.className).toContain('MuiChip-filledWarning');
      const actionChip = screen.getByTestId('action-chip-見守り');
      expect(actionChip.className).toContain('MuiChip-filledWarning');
      const resultChip = screen.getByTestId('result-chip-改善した');
      expect(resultChip.className).toContain('MuiChip-filledWarning');
      const memoInput = screen.getByTestId('kiosk-observation-memo');
      expect(memoInput).toHaveValue('問題なく実施完了');
    });
  });

  describe('resolveProcedureUserQueryCandidates alias resolution logic', () => {
    it('resolves correct candidates and prevents route and user code collision', () => {
      // Case 1: user has canonical UserID (e.g. U-006)
      expect(resolveProcedureUserQueryCandidates({ UserID: 'U-006' } as any, '7')).toBe('U-006');

      // Case 2: no user loaded, falls back to route id
      expect(resolveProcedureUserQueryCandidates(null, '7')).toBe('7');

      // Case 3: query parameter override is present
      expect(resolveProcedureUserQueryCandidates({ UserID: 'U-006' } as any, '7', 'override-id')).toBe('override-id');
    });
  });

  describe('when the user is absent', () => {
    beforeEach(() => {
      mockUseKioskAttendance.mockReturnValue({
        isAbsent: true,
        reason: '風邪のため',
        isLoading: false,
        isError: false,
      });
    });

    it('renders the absence warning alert and disables save/delete/abc actions', () => {
      mockUseExecutionRecord.mockReturnValue(
        makeExecutionRecordHookResult({
          record: makeExecutionRecord({
            memo: '【様子】落ち着いていた\n【対応】見守り\n【変化】改善した\n【メモ】テスト記録',
          }),
        }),
      );

      render(
        <MemoryRouter>
          <KioskProcedureDetailScreen />
        </MemoryRouter>
      );

      // 1. 警告アラートが表示されているか
      const alert = screen.getByTestId('kiosk-procedure-detail-absence-alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('本日は欠席として処理されています。');
      expect(alert).toHaveTextContent('欠席日のため、この手順の保存・取消・ABC記録はできません。');

      // 2. ボタンが disabled か
      expect(screen.getByTestId('kiosk-procedure-detail-abc-record')).toBeDisabled();
      expect(screen.getByTestId('kiosk-observation-submit')).toBeDisabled();
      expect(screen.getByTestId('kiosk-observation-revert')).toBeDisabled();
    });
  });
});
