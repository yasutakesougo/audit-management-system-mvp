import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KioskProcedureDetailScreen } from '../KioskProcedureDetailScreen';
import { MemoryRouter } from 'react-router-dom';
import { resolveProcedureUserQueryCandidates } from '../../utils/resolveProcedureUserQuery';
import { formatDateIso } from '@/lib/dateFormat';
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
  date: formatDateIso(new Date()),
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
let mockRouteUserId = 'U001';
const mockUseParams = vi.fn(() => ({ userId: mockRouteUserId, slotKey: '0' }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
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
  },
  {
    id: 'P002',
    time: '11:00',
    activity: '昼食準備',
    instruction: '配膳を手伝います。',
    activityDetail: '配膳を手伝う',
    instructionDetail: '安全に配慮して見守る',
  },
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
    mockRouteUserId = 'U001';
    mockUseParams.mockImplementation(() => ({ userId: mockRouteUserId, slotKey: '0' }));
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

  it('does not look up or save execution records without a canonical user code', () => {
    mockRouteUserId = '1';
    mockUseUser.mockReturnValue({ data: makeUser({ UserID: '' }), status: 'success' });

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    expect(screen.getByText('田中 太郎 様')).toBeInTheDocument();
    expect(mockUseExecutionRecord).toHaveBeenCalledWith(
      expect.any(String),
      '',
      'procedure-1',
      expect.any(Array),
      [],
    );
    expect(screen.getByTestId('kiosk-observation-submit')).toBeDisabled();
    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));
    expect(mockSaveRecord).not.toHaveBeenCalled();
  });

  it('keeps cached user content visible after lookup failure but leaves identity and execution state unconfirmed', () => {
    mockUseUser.mockReturnValue({ data: makeUser(), status: 'error' });
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({
      record: makeExecutionRecord({ memo: 'cached-record-must-not-show' }),
    }));

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    expect(screen.getByText('田中 太郎 様')).toBeInTheDocument();
    expect(screen.getByTestId('kiosk-user-freshness-unconfirmed-alert')).toBeInTheDocument();
    expect(mockUseExecutionRecord).toHaveBeenCalledWith(expect.any(String), '', 'procedure-1', expect.any(Array), []);
    expect(screen.getByText('保存状態未確認')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('cached-record-must-not-show')).toBeNull();
    expect(screen.getByTestId('kiosk-observation-submit')).toBeDisabled();
    expect(screen.getByTestId('kiosk-procedure-detail-abc-record')).toBeDisabled();
  });

  it('hides a record returned for another user and keeps its status unconfirmed', () => {
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({
      record: makeExecutionRecord({ userId: 'U999', memo: '別利用者の記録内容' }),
    }));

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    expect(screen.getByText('保存状態未確認')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('別利用者の記録内容')).toBeNull();
    expect(screen.getByTestId('kiosk-observation-submit')).toBeDisabled();
  });

  it('clears the previous user form and blocks actions until the new user record lookup completes', async () => {
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({
      record: makeExecutionRecord({ memo: 'previous-user-test-memo' }),
    }));

    const { rerender } = render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('previous-user-test-memo'));

    mockRouteUserId = 'U002';
    mockUseUser.mockReturnValue({ data: makeUser({ Id: 2, UserID: 'U002', FullName: '別利用者' }), status: 'success' });
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({
      record: makeExecutionRecord({ memo: 'previous-user-test-memo' }),
      isLoading: true,
    }));
    rerender(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    expect(screen.getByText('別利用者 様')).toBeInTheDocument();
    expect(screen.getByText('体温と血圧を測る')).toBeInTheDocument();
    expect(screen.queryByText('読み込み中...')).toBeNull();
    expect(screen.queryByDisplayValue('previous-user-test-memo')).toBeNull();
    expect(screen.queryByTestId('kiosk-saved-record-summary')).toBeNull();
    expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('');
    expect(screen.getByTestId('kiosk-observation-memo')).toBeDisabled();
    expect(screen.getByTestId('kiosk-observation-submit')).toBeDisabled();
    expect(screen.getByTestId('kiosk-procedure-detail-abc-record')).toBeDisabled();

    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult());
    rerender(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue(''));
    expect(screen.queryByDisplayValue('previous-user-test-memo')).toBeNull();
    fireEvent.change(screen.getByTestId('kiosk-observation-memo'), { target: { value: 'new-user-only-test' } });
    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));
    await waitFor(() => expect(mockSaveRecord).toHaveBeenCalledWith('completed', '【メモ】new-user-only-test'));
  });

  it('drops the old-code record when the same route resolves to a new canonical user code', async () => {
    mockRouteUserId = '1';
    mockUseUser.mockReturnValue({ data: makeUser({ Id: 1, UserID: 'U001' }), status: 'success' });
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({
      record: makeExecutionRecord({ memo: 'old-code-test-memo' }),
    }));

    const { rerender } = render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('old-code-test-memo'));

    mockUseUser.mockReturnValue({ data: makeUser({ Id: 1, UserID: 'U009' }), status: 'success' });
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({
      record: makeExecutionRecord({ userId: 'U001', memo: 'old-code-test-memo' }),
      isLoading: true,
    }));
    rerender(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    expect(mockUseExecutionRecord).toHaveBeenLastCalledWith(
      expect.any(String),
      'U009',
      'procedure-1',
      expect.any(Array),
      expect.arrayContaining(['U009']),
    );
    expect(screen.queryByDisplayValue('old-code-test-memo')).toBeNull();
    expect(screen.getByText('体温と血圧を測る')).toBeInTheDocument();
    expect(screen.queryByText('読み込み中...')).toBeNull();
    expect(screen.queryByTestId('kiosk-saved-record-summary')).toBeNull();
    expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('');
    expect(screen.getByTestId('kiosk-observation-memo')).toBeDisabled();
    expect(screen.getByTestId('kiosk-observation-submit')).toBeDisabled();
    expect(screen.getByTestId('kiosk-procedure-detail-abc-record')).toBeDisabled();

    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult());
    rerender(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue(''));
    expect(screen.queryByDisplayValue('old-code-test-memo')).toBeNull();
  });

  it('hides a same-user record from a different selected date', () => {
    mockUseLocation.mockReturnValue({ search: '?kiosk=1&provider=memory&date=2026-05-07' });
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({
      record: makeExecutionRecord({ date: '2026-05-06', memo: 'previous-date-test-memo' }),
    }));

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    expect(screen.getByText('保存状態未確認')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('previous-date-test-memo')).toBeNull();
    expect(screen.getByTestId('kiosk-observation-submit')).toBeDisabled();
  });

  it('disables an already-open cancellation confirmation if record status becomes unknown', () => {
    const currentRecord = makeExecutionRecord({ memo: 'current-record-test-memo' });
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({ record: currentRecord }));

    const { rerender } = render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('kiosk-observation-revert'));
    expect(screen.getByTestId('kiosk-observation-revert-confirm')).toBeEnabled();

    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({
      record: currentRecord,
      error: new Error('refresh failed'),
    }));
    rerender(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>
    );

    const confirmButton = screen.getByTestId('kiosk-observation-revert-confirm');
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);
    expect(mockDeleteRecord).not.toHaveBeenCalled();
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

  it('resets observation chips when the procedure slot identity changes', async () => {
    mockUseParams.mockReturnValue({ userId: 'U001', slotKey: '0' });
    const { rerender } = render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('mood-chip-不安そう'));
    fireEvent.click(screen.getByTestId('action-chip-見守り'));
    fireEvent.click(screen.getByTestId('result-chip-改善した'));
    fireEvent.change(screen.getByTestId('kiosk-observation-memo'), {
      target: { value: 'スロット0のメモ' },
    });
    expect(screen.getByTestId('mood-chip-不安そう').className).toContain('MuiChip-filledWarning');
    expect(screen.getByTestId('action-chip-見守り').className).toContain('MuiChip-filledWarning');
    expect(screen.getByTestId('result-chip-改善した').className).toContain('MuiChip-filledWarning');
    expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('スロット0のメモ');

    mockUseParams.mockReturnValue({ userId: 'U001', slotKey: '1' });
    rerender(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('11:00 - 昼食準備')).toBeInTheDocument();
    });
    expect(screen.getByTestId('mood-chip-不安そう').className).not.toContain('MuiChip-filledWarning');
    expect(screen.getByTestId('action-chip-見守り').className).not.toContain('MuiChip-filledWarning');
    expect(screen.getByTestId('result-chip-改善した').className).not.toContain('MuiChip-filledWarning');
    expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('');
  });

  it('resets observation chips and memo when the selected date changes', async () => {
    mockUseLocation.mockReturnValue({ search: '?kiosk=1&provider=memory&date=2026-05-28' });
    const { rerender } = render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('mood-chip-不安そう'));
    fireEvent.click(screen.getByTestId('action-chip-見守り'));
    fireEvent.click(screen.getByTestId('result-chip-改善した'));
    fireEvent.change(screen.getByTestId('kiosk-observation-memo'), {
      target: { value: '前日のメモ' },
    });

    mockUseLocation.mockReturnValue({ search: '?kiosk=1&provider=memory&date=2026-05-29' });
    rerender(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mockUseExecutionRecord).toHaveBeenLastCalledWith(
      '2026-05-29', 'U001', 'procedure-1', expect.any(Array), expect.any(Array),
    ));
    expect(screen.getByTestId('mood-chip-不安そう').className).not.toContain('MuiChip-filledWarning');
    expect(screen.getByTestId('action-chip-見守り').className).not.toContain('MuiChip-filledWarning');
    expect(screen.getByTestId('result-chip-改善した').className).not.toContain('MuiChip-filledWarning');
    expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('');
  });

  it('resets observation chips and memo when the selected user changes', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('mood-chip-不安そう'));
    fireEvent.click(screen.getByTestId('action-chip-見守り'));
    fireEvent.click(screen.getByTestId('result-chip-改善した'));
    fireEvent.change(screen.getByTestId('kiosk-observation-memo'), {
      target: { value: '利用者U001のメモ' },
    });

    mockUseParams.mockReturnValue({ userId: 'U002', slotKey: '0' });
    mockUseUser.mockReturnValue({ data: makeUser({ Id: 2, UserID: 'U002', FullName: '佐藤 花子' }), status: 'success' });
    rerender(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('佐藤 花子 様')).toBeInTheDocument());
    expect(screen.getByTestId('mood-chip-不安そう').className).not.toContain('MuiChip-filledWarning');
    expect(screen.getByTestId('action-chip-見守り').className).not.toContain('MuiChip-filledWarning');
    expect(screen.getByTestId('result-chip-改善した').className).not.toContain('MuiChip-filledWarning');
    expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('');
  });

  it('shows procedure content during the initial record lookup while blocking record actions until restoration', async () => {
    const savedRecord = makeExecutionRecord({
      memo: '【様子】落ち着いていた\n【対応】見守り\n【変化】改善した\n【メモ】照合後に復元するメモ',
    });
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({
      record: savedRecord,
      isLoading: true,
    }));

    const { rerender } = render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText('体温と血圧を測る')).toBeInTheDocument();
    expect(screen.getByText('測定の声かけと記録を行う')).toBeInTheDocument();
    expect(screen.queryByText('読み込み中...')).toBeNull();
    expect(screen.getByText('保存状態未確認')).toBeInTheDocument();
    for (const prefix of ['mood-chip-', 'action-chip-', 'result-chip-']) {
      for (const chip of screen.getAllByTestId(new RegExp(`^${prefix}`))) {
        expect(chip).toHaveClass('Mui-disabled');
      }
    }
    expect(screen.getByTestId('kiosk-observation-memo')).toBeDisabled();
    expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('');
    expect(screen.queryByTestId('kiosk-saved-record-summary')).toBeNull();
    for (const testId of [
      'kiosk-observation-submit',
      'kiosk-observation-revert',
      'kiosk-procedure-detail-abc-record',
    ]) {
      const button = screen.getByTestId(testId);
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(mockSaveRecord).not.toHaveBeenCalled();
    expect(mockDeleteRecord).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();

    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({ record: savedRecord }));
    rerender(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('照合後に復元するメモ');
      expect(screen.getByTestId('kiosk-observation-submit')).toBeEnabled();
      expect(screen.getByTestId('kiosk-observation-revert')).toBeEnabled();
      expect(screen.getByTestId('kiosk-procedure-detail-abc-record')).toBeEnabled();
    });
    expect(screen.getByTestId('mood-chip-落ち着いていた')).toHaveClass('MuiChip-filledWarning');
    expect(screen.getByTestId('action-chip-見守り')).toHaveClass('MuiChip-filledWarning');
    expect(screen.getByTestId('result-chip-改善した')).toHaveClass('MuiChip-filledWarning');
    expect(screen.queryByText('保存状態未確認')).toBeNull();
    expect(screen.getByTestId('kiosk-saved-record-summary')).toHaveTextContent('照合後に復元するメモ');
  });

  it('disables save while a refreshed execution-record lookup is loading', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    const saveButton = screen.getByTestId('kiosk-observation-submit');
    await waitFor(() => expect(saveButton).toBeEnabled());

    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({ isLoading: true }));
    rerender(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('kiosk-observation-submit')).toBeDisabled();
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
