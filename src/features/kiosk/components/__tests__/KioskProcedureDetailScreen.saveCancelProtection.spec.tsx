/**
 * Hotfix B observation save/cancel protection.
 * Test-only. Does not change production behavior.
 */
import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';
import type { useExecutionRecord as useExecutionRecordHook } from '@/features/daily/hooks/useExecutionRecord';
import type { IUserMaster } from '@/features/users/types';
import { formatDateIso } from '@/lib/dateFormat';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KioskProcedureDetailScreen } from '../KioskProcedureDetailScreen';

type UserHookState = {
  data: IUserMaster | null;
  status: 'idle' | 'loading' | 'success' | 'error';
};

type ExecutionRecordHookResult = ReturnType<typeof useExecutionRecordHook>;

const DRAFT_MEMO = '保護対象の下書き';

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
  memo: '【メモ】既存メモ',
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
  mutationBlocked: false,
  refresh: mockRefreshRecord,
  ...overrides,
});

const mockNavigate = vi.fn();
const mockUseLocation = vi.fn(() => ({ search: '?kiosk=1&provider=memory' }));
const mockUseParams = vi.fn(() => ({ userId: 'U001', slotKey: '0' }));
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

vi.mock('@/features/daily/hooks/useProcedureData', () => ({
  useProcedureData: () => ({
    getByUser: () => [
      {
        id: 'P001',
        time: '10:00',
        activity: '朝のバイタルチェック',
        instruction: '体温と血圧を測ります。',
        activityDetail: '体温と血圧を測る',
        instructionDetail: '測定の声かけと記録を行う',
      },
    ],
  }),
}));

const mockSaveRecord = vi.fn().mockResolvedValue(undefined);
const mockDeleteRecord = vi.fn().mockResolvedValue(undefined);
const mockRefreshRecord = vi.fn();
const mockUseExecutionRecord = vi.fn<
  (
    date: string,
    userId: string,
    scheduleItemId: string,
    fallbackScheduleItemIds?: string[],
    fallbackUserIds?: string[],
  ) => ExecutionRecordHookResult
>(() => makeExecutionRecordHookResult());
vi.mock('@/features/daily/hooks/useExecutionRecord', () => ({
  useExecutionRecord: (
    date: string,
    userId: string,
    scheduleItemId: string,
    fallbackScheduleItemIds?: string[],
    fallbackUserIds?: string[],
  ) => mockUseExecutionRecord(date, userId, scheduleItemId, fallbackScheduleItemIds, fallbackUserIds),
}));

vi.mock('../../hooks/useKioskAttendance', () => ({
  useKioskAttendance: () => ({
    isAbsent: false,
    reason: undefined,
    isLoading: false,
    isError: false,
  }),
}));

const renderScreen = () => render(
  <MemoryRouter>
    <KioskProcedureDetailScreen />
  </MemoryRouter>,
);

const enterDraft = () => {
  fireEvent.click(screen.getByTestId('mood-chip-落ち着いていた'));
  fireEvent.change(screen.getByTestId('kiosk-observation-memo'), { target: { value: DRAFT_MEMO } });
};

const expectDraftRetained = () => {
  expect(screen.getByTestId('mood-chip-落ち着いていた').className).toContain('MuiChip-filledWarning');
  expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue(DRAFT_MEMO);
};

const expectSaveAndCancelBlocked = () => {
  const saveButton = screen.getByTestId('kiosk-observation-submit');
  const cancelButton = screen.getByTestId('kiosk-observation-revert');
  expect(saveButton).toBeDisabled();
  expect(cancelButton).toBeDisabled();
  fireEvent.click(saveButton);
  fireEvent.click(cancelButton);
  expect(screen.queryByTestId('kiosk-observation-revert-confirm')).toBeNull();
  expect(mockSaveRecord).not.toHaveBeenCalled();
  expect(mockDeleteRecord).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  expectDraftRetained();
};

describe('Hotfix B observation save/cancel protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockImplementation(() => ({ userId: 'U001', slotKey: '0' }));
    mockUseLocation.mockReturnValue({ search: '?kiosk=1&provider=memory' });
    mockUseUser.mockReturnValue({ data: makeUser(), status: 'success' });
    mockSaveRecord.mockReset();
    mockSaveRecord.mockResolvedValue(undefined);
    mockDeleteRecord.mockReset();
    mockDeleteRecord.mockResolvedValue(undefined);
    mockUseExecutionRecord.mockReset();
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult());
  });

  afterEach(() => {
    cleanup();
  });

  it('blocks save and cancel while the execution record is loading and retains the draft', () => {
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({
      record: makeExecutionRecord(),
      isLoading: true,
    }));

    renderScreen();
    enterDraft();

    expect(screen.getByText('実施記録を確認中です')).toBeInTheDocument();
    expectSaveAndCancelBlocked();
  });

  it('blocks save and cancel on execution-record load failure and retains the draft', () => {
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({
      record: makeExecutionRecord(),
      error: new Error('failed to load execution record'),
    }));

    renderScreen();
    enterDraft();

    expect(screen.getByText('実施記録の読み込みに失敗しました')).toBeInTheDocument();
    expectSaveAndCancelBlocked();
  });

  it('blocks save and cancel while a failing save is in flight and retains the draft', async () => {
    mockSaveRecord.mockImplementation(() => new Promise(() => {}));
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({
      record: makeExecutionRecord(),
      isLoading: false,
    }));

    renderScreen();
    await waitFor(() => {
      expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('既存メモ');
    });
    enterDraft();

    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));

    expect(screen.getByTestId('kiosk-observation-submit')).toBeDisabled();
    expect(screen.getByTestId('kiosk-observation-revert')).toBeDisabled();
    expectDraftRetained();
    expect(mockSaveRecord).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));
    fireEvent.click(screen.getByTestId('kiosk-observation-revert'));
    expect(mockSaveRecord).toHaveBeenCalledTimes(1);
    expect(mockDeleteRecord).not.toHaveBeenCalled();
    expect(screen.queryByTestId('kiosk-observation-revert-confirm')).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('keeps save and cancel blocked after save failure is reported and retains the draft', async () => {
    mockSaveRecord.mockRejectedValueOnce(new Error('save failed'));
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({
      record: makeExecutionRecord(),
      isLoading: false,
    }));

    renderScreen();
    await waitFor(() => {
      expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('既存メモ');
    });
    enterDraft();
    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));

    await waitFor(() => {
      expect(screen.getByText('記録の保存に失敗しました。再度お試しください。')).toBeInTheDocument();
    });
    expectDraftRetained();
    expect(mockDeleteRecord).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockSaveRecord).toHaveBeenCalledTimes(1);

    const saveButton = screen.getByTestId('kiosk-observation-submit');
    const cancelButton = screen.getByTestId('kiosk-observation-revert');
    const buttonState = {
      saveDisabled: saveButton.hasAttribute('disabled'),
      cancelDisabled: cancelButton.hasAttribute('disabled'),
    };
    expect(buttonState, `post-save-failure buttons ${JSON.stringify(buttonState)}`).toEqual({
      saveDisabled: true,
      cancelDisabled: true,
    });
    fireEvent.click(saveButton);
    fireEvent.click(cancelButton);
    expect(mockSaveRecord).toHaveBeenCalledTimes(1);
    expect(mockDeleteRecord).not.toHaveBeenCalled();
    expect(screen.queryByTestId('kiosk-observation-revert-confirm')).toBeNull();
  });

  it('blocks save and cancel on record conflict and retains the draft', async () => {
    let currentHookResult = makeExecutionRecordHookResult({
      record: makeExecutionRecord({ memo: '【メモ】初回メモ' }),
      isLoading: false,
    });
    mockUseExecutionRecord.mockImplementation(() => currentHookResult);

    const { rerender } = renderScreen();
    await waitFor(() => {
      expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('初回メモ');
    });
    enterDraft();

    currentHookResult = makeExecutionRecordHookResult({
      record: makeExecutionRecord({ memo: '【メモ】別端末で変更されたメモ' }),
      isLoading: false,
    });
    rerender(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('kiosk-conflict-alert')).toBeInTheDocument();
    });
    expectSaveAndCancelBlocked();
  });

  it('keeps the draft and does not save again after a post-save check failure', async () => {
    const postSaveFailure = Object.assign(new Error('EXECUTION_POST_SAVE_CHECK_FAILED'), {
      code: 'EXECUTION_POST_SAVE_CHECK_FAILED',
    });
    mockSaveRecord.mockRejectedValueOnce(postSaveFailure);
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({
      record: makeExecutionRecord(),
      isLoading: false,
    }));

    renderScreen();
    await waitFor(() => {
      expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('既存メモ');
    });
    enterDraft();
    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));

    await waitFor(() => {
      expect(screen.getByText('記録の保存に失敗しました。再度お試しください。')).toBeInTheDocument();
    });
    expectDraftRetained();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockSaveRecord).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));
    fireEvent.click(screen.getByTestId('kiosk-observation-revert'));
    expect(mockSaveRecord).toHaveBeenCalledTimes(1);
    expect(mockDeleteRecord).not.toHaveBeenCalled();
    expect(screen.queryByTestId('kiosk-observation-revert-confirm')).toBeNull();
  });

  it('keeps the original target blocked after switching users and coming back', async () => {
    mockSaveRecord.mockRejectedValueOnce(new Error('save failed'));
    mockUseExecutionRecord.mockReturnValue(makeExecutionRecordHookResult({
      record: makeExecutionRecord(),
      isLoading: false,
    }));

    const { rerender } = renderScreen();
    await waitFor(() => {
      expect(screen.getByTestId('kiosk-observation-memo')).toHaveValue('既存メモ');
    });
    enterDraft();
    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));
    await waitFor(() => {
      expect(screen.getByText('記録の保存に失敗しました。再度お試しください。')).toBeInTheDocument();
    });
    expect(mockSaveRecord).toHaveBeenCalledTimes(1);

    mockUseParams.mockImplementation(() => ({ userId: 'U002', slotKey: '0' }));
    mockUseUser.mockReturnValue({
      data: makeUser({ Id: 2, UserID: 'U002', FullName: '佐藤 花子' }),
      status: 'success',
    });
    rerender(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    mockUseParams.mockImplementation(() => ({ userId: 'U001', slotKey: '0' }));
    mockUseUser.mockReturnValue({ data: makeUser(), status: 'success' });
    rerender(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    const saveButton = screen.getByTestId('kiosk-observation-submit');
    const cancelButton = screen.getByTestId('kiosk-observation-revert');
    expect(saveButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
    fireEvent.click(saveButton);
    fireEvent.click(cancelButton);
    expect(mockSaveRecord).toHaveBeenCalledTimes(1);
    expect(mockDeleteRecord).not.toHaveBeenCalled();
    expect(screen.queryByTestId('kiosk-observation-revert-confirm')).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
