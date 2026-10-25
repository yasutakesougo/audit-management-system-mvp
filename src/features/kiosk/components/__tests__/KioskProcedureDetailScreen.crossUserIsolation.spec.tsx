/**
 * Cross-user isolation regression tests for KioskProcedureDetailScreen.
 * Tests the real screen flow:
 * URL userId ('6') -> Users_Master lookup (Id: 6, UserID: 'I005') -> Procedure Detail Screen
 * Verifies isolation from User 17 ('17' / 'I017') and blocks mutations on mismatch.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { KioskProcedureDetailScreen } from '../KioskProcedureDetailScreen';
import type { IUserMaster } from '@/features/users/types';
import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';
import type { useExecutionRecord as useExecutionRecordHook } from '@/features/daily/hooks/useExecutionRecord';

type ExecutionRecordHookResult = ReturnType<typeof useExecutionRecordHook>;

const mockSaveRecord = vi.fn();
const mockDeleteRecord = vi.fn();
const mockRefreshRecord = vi.fn();
const mockUseExecutionRecord = vi.fn();

let mockRouteUserId = '6';
let mockRouteSlotKey = '0';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ userId: mockRouteUserId, slotKey: mockRouteSlotKey }),
    useLocation: () => ({ search: '?date=2026-10-24' }),
  };
});

let mockUserData: IUserMaster | null = null;
let mockUserStatus: 'idle' | 'loading' | 'success' | 'error' = 'success';

vi.mock('@/features/users/useUsers', () => ({
  useUser: () => ({
    data: mockUserData,
    status: mockUserStatus,
    error: null,
  }),
}));

const mockProcedures = [
  {
    id: 'procedure-1',
    rowNo: 1,
    time: '10:00',
    activity: '朝のバイタルチェック',
    instruction: '体温と血圧を測ります',
    planningSheetId: 'sheet-1',
    isKey: true,
  },
];

vi.mock('@/features/daily/hooks/useProcedureData', () => ({
  useProcedureData: () => ({
    getByUser: () => mockProcedures,
  }),
}));

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

function makeHookResult(record?: ExecutionRecord, overrides: Partial<ExecutionRecordHookResult> = {}): ExecutionRecordHookResult {
  return {
    record,
    setStatus: vi.fn(),
    setMemo: vi.fn(),
    saveRecord: mockSaveRecord,
    deleteRecord: mockDeleteRecord,
    isLoading: false,
    error: null,
    mutationBlocked: false,
    refresh: mockRefreshRecord,
    identityKey: 'identity-key',
    identityGeneration: 1,
    startedFetchSeq: 1,
    settledFetch: null,
    requestSeqRef: { current: 1 },
    ...overrides,
  };
}

describe('KioskProcedureDetailScreen - Real Screen Cross-User Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouteUserId = '6';
    mockRouteSlotKey = '0';
    mockUserData = {
      Id: 6,
      UserID: 'I005',
      FullName: '利用者6',
    } as IUserMaster;
    mockUserStatus = 'success';
  });

  it('passes verified master UserID and Item ID candidates to useExecutionRecord without synthetic aliasing', async () => {
    mockUseExecutionRecord.mockReturnValue(makeHookResult());

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    // Primary UserID must be 'I005' (canonical from Users_Master)
    // Fallback ID must be ['6'] (Item ID from Users_Master)
    // Synthetic aliases (U-006, 7, 17, I017) must NEVER be included
    expect(mockUseExecutionRecord).toHaveBeenCalledWith(
      '2026-10-24',
      'I005',
      'procedure-1',
      expect.any(Array),
      ['6'],
    );
  });

  it('rejects foreign User 17 record when accessed via User 6 URL, disabling submit and blocking save', async () => {
    // Backend inadvertently returned User 17's record for this slot
    const foreignRecord: ExecutionRecord = {
      id: 'foreign-rec-1017',
      date: '2026-10-24',
      userId: 'I017', // Foreign User 17 ID
      scheduleItemId: 'procedure-1',
      status: 'completed',
      memo: '利用者17の記録本文',
    };
    mockUseExecutionRecord.mockReturnValue(makeHookResult(foreignRecord));

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    // Screen must detect mismatch: submit button must be disabled
    const submitBtn = screen.getByTestId('kiosk-observation-submit');
    expect(submitBtn).toBeDisabled();

    // Clicking disabled submit does NOT call saveRecord
    fireEvent.click(submitBtn);
    expect(mockSaveRecord).not.toHaveBeenCalled();

    // Target mismatch warning alert should be displayed
    expect(screen.getByText('実施記録を確認できません')).toBeInTheDocument();
    expect(screen.getByText(/再読み込みするまで記録の保存・取消はできません/)).toBeInTheDocument();
  });

  it('accepts authentic User 6 record and enables editing/saving', async () => {
    const authenticRecord: ExecutionRecord = {
      id: 'authentic-rec-1006',
      date: '2026-10-24',
      userId: 'I005',
      scheduleItemId: 'procedure-1',
      status: 'completed',
      memo: '【様子】良好',
    };
    mockUseExecutionRecord.mockReturnValue(makeHookResult(authenticRecord));

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    const submitBtn = screen.getByTestId('kiosk-observation-submit');
    expect(submitBtn).not.toBeDisabled();
    expect(screen.queryByTestId('kiosk-execution-target-mismatch-alert')).toBeNull();
  });

  it('does not match a padded master UserID to an unpadded route ID', () => {
    mockRouteUserId = 'U001';
    mockUserData = {
      Id: 6,
      UserID: ' U001 ',
      FullName: '別の完全一致ではない行',
    } as IUserMaster;
    mockUseExecutionRecord.mockReturnValue(makeHookResult());

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText('情報が見つかりません')).toBeInTheDocument();
  });

  it('accepts authentic legacy record keyed by Item ID (6) backed by the same Users_Master row', async () => {
    const legacyRecord: ExecutionRecord = {
      id: 'legacy-rec-1006',
      date: '2026-10-24',
      userId: '6', // Item ID form
      scheduleItemId: 'procedure-1',
      status: 'completed',
      memo: '【様子】良好',
    };
    mockUseExecutionRecord.mockReturnValue(makeHookResult(legacyRecord));

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    const submitBtn = screen.getByTestId('kiosk-observation-submit');
    expect(submitBtn).not.toBeDisabled();
    expect(screen.queryByTestId('kiosk-execution-target-mismatch-alert')).toBeNull();
  });

  it('reverse isolation: User 17 screen route strictly rejects User 6 records', async () => {
    mockRouteUserId = '17';
    mockUserData = {
      Id: 17,
      UserID: 'I017',
      FullName: '利用者17',
    } as IUserMaster;

    // Backend inadvertently returned User 6's record
    const user6Record: ExecutionRecord = {
      id: 'rec-6',
      date: '2026-10-24',
      userId: 'I005',
      scheduleItemId: 'procedure-1',
      status: 'completed',
    };
    mockUseExecutionRecord.mockReturnValue(makeHookResult(user6Record));

    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    expect(mockUseExecutionRecord).toHaveBeenCalledWith(
      '2026-10-24',
      'I017',
      'procedure-1',
      expect.any(Array),
      ['17'],
    );

    // Mismatch detected, save blocked
    const submitBtn = screen.getByTestId('kiosk-observation-submit');
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText('実施記録を確認できません')).toBeInTheDocument();
  });
});
