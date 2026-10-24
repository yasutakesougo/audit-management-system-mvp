/**
 * Real useKioskAttendance coverage for KioskProcedureDetailScreen.
 * This file does not mock useKioskAttendance.
 *
 * Strict Mode: OFF.
 * Configuration:
 * - @testing-library/react render() plus MemoryRouter only.
 * - No <React.StrictMode> wrapper.
 * - tests/helpers/renderWithAppProviders.tsx is not used; that helper wraps StrictMode.
 * - vitest.setup.ts and tests/setupTests.ts do not enable StrictMode.
 * Fetch counts below are for this single-effect mode. A StrictMode double
 * invoke would run the passive effect twice and is not accepted by these counts.
 */
import React, { useEffect, useRef } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { IUserMaster } from '@/features/users/types';
import { KioskProcedureDetailScreen } from '../KioskProcedureDetailScreen';

const STRICT_MODE_ENABLED = false;
const SELECTED_DATE_ISO = '2026-10-09';
const UPDATE_BOUND = 80;

type UserStatus = 'idle' | 'loading' | 'success' | 'error';
type UserHookState = { data: IUserMaster | null; status: UserStatus };
type DailyRow = {
  Key: string;
  UserCode: string;
  RecordDate: string;
  Status: string;
  AbsentReason?: string;
};

const loopGuard = vi.hoisted(() => ({
  setStateCalls: 0,
  boundHit: false,
  bound: 80,
}));

const harness = vi.hoisted(() => {
  const getDailyByDate = vi.fn(async (_params: { recordDate: string }): Promise<DailyRow[]> => []);
  const attendanceRepository = {
    getDailyByDate,
    getActiveUsers: vi.fn(async () => []),
    upsertDailyByKey: vi.fn(async () => undefined),
    getObservationsByDate: vi.fn(async () => []),
  };
  const userState: { current: UserHookState } = {
    current: { data: null, status: 'loading' },
  };
  const routeState = {
    userId: '6',
    slotKey: '0',
    search: '?date=2026-10-09',
  };
  const executionResult = {
    record: undefined,
    setStatus: vi.fn(),
    setMemo: vi.fn(),
    saveRecord: vi.fn(),
    deleteRecord: vi.fn(),
    isLoading: false,
    error: null,
    mutationBlocked: false,
    refresh: vi.fn(),
  };
  return { getDailyByDate, attendanceRepository, userState, routeState, executionResult };
});

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  const useState = ((initialState: unknown) => {
    const result = actual.useState(initialState);
    const setState = result[1] as (value: unknown) => void;
    const boundedSetState = (value: unknown) => {
      loopGuard.setStateCalls += 1;
      if (loopGuard.setStateCalls > loopGuard.bound) {
        loopGuard.boundHit = true;
        return;
      }
      setState(value);
    };
    return [result[0], boundedSetState];
  }) as typeof actual.useState;
  return {
    ...actual,
    useState,
    default: actual,
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ userId: harness.routeState.userId, slotKey: harness.routeState.slotKey }),
    useLocation: () => ({ search: harness.routeState.search }),
  };
});

vi.mock('@/features/users/useUsers', () => ({
  useUser: () => harness.userState.current,
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

vi.mock('@/features/daily/hooks/useExecutionRecord', () => ({
  useExecutionRecord: () => harness.executionResult,
}));

vi.mock('@/features/daily/hooks/useHistoricalRecords', () => ({
  useHistoricalRecords: () => ({
    records: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    isCached: false,
    lastFetchedAt: null,
  }),
}));

vi.mock('@/features/attendance/repositoryFactory', () => ({
  useAttendanceRepository: () => harness.attendanceRepository,
}));

const makeUser = (overrides: Partial<IUserMaster>): IUserMaster => ({
  Id: 6,
  UserID: 'U-006',
  FullName: '合成利用者6',
  ...overrides,
});

const absentRow = (userCode: string): DailyRow => ({
  Key: `${SELECTED_DATE_ISO}_${userCode}`,
  UserCode: userCode,
  RecordDate: SELECTED_DATE_ISO,
  Status: '欠席',
  AbsentReason: '通院',
});

const formatConsoleArgs = (args: unknown[]): string => args.map((arg) => {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.message;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}).join(' ');

function StrictModeProbe({ runs }: { runs: { count: number } }) {
  const runsRef = useRef(runs);
  runsRef.current = runs;
  useEffect(() => {
    runsRef.current.count += 1;
  }, []);
  return null;
}

function renderDetail(runs: { count: number }) {
  return render(
    <MemoryRouter>
      <StrictModeProbe runs={runs} />
      <KioskProcedureDetailScreen />
    </MemoryRouter>,
  );
}

describe('real useKioskAttendance through KioskProcedureDetailScreen', () => {
  const depthWarnings: string[] = [];
  const actWarnings: string[] = [];
  let restoreConsole: (() => void) | null = null;

  beforeEach(() => {
    loopGuard.setStateCalls = 0;
    loopGuard.boundHit = false;
    loopGuard.bound = UPDATE_BOUND;
    depthWarnings.length = 0;
    actWarnings.length = 0;
    harness.routeState.userId = '6';
    harness.routeState.slotKey = '0';
    harness.routeState.search = `?date=${SELECTED_DATE_ISO}`;
    harness.userState.current = { data: null, status: 'loading' };
    harness.getDailyByDate.mockReset();
    harness.getDailyByDate.mockResolvedValue([]);
    const original = console.error.bind(console);
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const text = formatConsoleArgs(args);
      if (text.includes('Maximum update depth exceeded')) depthWarnings.push(text);
      if (text.includes('not wrapped in act')) actWarnings.push(text);
      original(...args);
    });
    restoreConsole = () => spy.mockRestore();
  });

  afterEach(() => {
    cleanup();
    restoreConsole?.();
    restoreConsole = null;
  });

  it('does not loop or call getDailyByDate while the user result is pending', () => {
    const runs = { count: 0 };
    renderDetail(runs);

    expect(STRICT_MODE_ENABLED).toBe(false);
    expect(runs.count).toBe(1);
    expect(loopGuard.boundHit, `setState calls=${loopGuard.setStateCalls} depthWarnings=${depthWarnings.length}`).toBe(false);
    expect(depthWarnings).toEqual([]);
    expect(harness.getDailyByDate).not.toHaveBeenCalled();
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  }, 8_000);

  it('fetches attendance for the fresh history ids and selectedDateIso', async () => {
    const runs = { count: 0 };
    const { rerender } = renderDetail(runs);
    expect(loopGuard.boundHit).toBe(false);
    expect(harness.getDailyByDate).not.toHaveBeenCalled();
    loopGuard.bound = Number.POSITIVE_INFINITY;

    harness.getDailyByDate.mockResolvedValue([absentRow('U006')]);
    harness.userState.current = {
      data: makeUser({ Id: 6, UserID: 'U-006', FullName: '合成利用者6' }),
      status: 'success',
    };
    rerender(
      <MemoryRouter>
        <StrictModeProbe runs={runs} />
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    const expectedFetches = STRICT_MODE_ENABLED ? 2 : 1;
    await waitFor(() => {
      expect(harness.getDailyByDate).toHaveBeenCalledTimes(expectedFetches);
    });
    expect(harness.getDailyByDate).toHaveBeenCalledWith({ recordDate: SELECTED_DATE_ISO });
    await waitFor(() => {
      expect(screen.getByTestId('kiosk-procedure-detail-absence-alert')).toBeInTheDocument();
    });
    expect(loopGuard.boundHit).toBe(false);
    expect(depthWarnings).toEqual([]);
    expect(runs.count).toBe(1);
  }, 8_000);

  it('does not apply an in-flight attendance result after the user changes', async () => {
    const runs = { count: 0 };
    const { rerender } = renderDetail(runs);
    expect(loopGuard.boundHit).toBe(false);
    expect(depthWarnings).toEqual([]);
    expect(harness.getDailyByDate).not.toHaveBeenCalled();
    loopGuard.bound = Number.POSITIVE_INFINITY;

    let resolveStale: (rows: DailyRow[]) => void = () => {};
    let resolveNext: (rows: DailyRow[]) => void = () => {};
    const stalePromise = new Promise<DailyRow[]>((resolve) => {
      resolveStale = resolve;
    });
    const nextPromise = new Promise<DailyRow[]>((resolve) => {
      resolveNext = resolve;
    });
    harness.getDailyByDate
      .mockImplementationOnce(() => stalePromise)
      .mockImplementationOnce(() => nextPromise);

    harness.userState.current = {
      data: makeUser({ Id: 6, UserID: 'U-006', FullName: '合成利用者6' }),
      status: 'success',
    };
    rerender(
      <MemoryRouter>
        <StrictModeProbe runs={runs} />
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(harness.getDailyByDate).toHaveBeenCalledTimes(1);
    });

    harness.routeState.userId = '8';
    harness.userState.current = {
      data: makeUser({ Id: 8, UserID: 'U-008', FullName: '合成利用者8' }),
      status: 'success',
    };
    rerender(
      <MemoryRouter>
        <StrictModeProbe runs={runs} />
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(harness.getDailyByDate).toHaveBeenCalledTimes(STRICT_MODE_ENABLED ? 4 : 2);
    });
    expect(harness.getDailyByDate).toHaveBeenNthCalledWith(1, { recordDate: SELECTED_DATE_ISO });
    expect(harness.getDailyByDate).toHaveBeenNthCalledWith(2, { recordDate: SELECTED_DATE_ISO });
    expect(screen.getByText('合成利用者8 様')).toBeInTheDocument();

    await act(async () => {
      resolveStale([absentRow('U006')]);
      await stalePromise;
    });
    expect(screen.queryByTestId('kiosk-procedure-detail-absence-alert')).toBeNull();

    await act(async () => {
      resolveNext([]);
      await nextPromise;
    });
    await waitFor(() => {
      expect(screen.getByText('合成利用者8 様')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('kiosk-procedure-detail-absence-alert')).toBeNull();
    expect(loopGuard.boundHit).toBe(false);
    expect(depthWarnings).toEqual([]);
    expect(runs.count).toBe(1);
  }, 8_000);
});
