/**
 * Stale save ownership. An older save attempt on A ends after a later save
 * attempt on B has failed. The later attempt's notice and hold must survive,
 * and only the recheck that belongs to it may release them.
 *
 * Case 1 uses the normal UI only and records whether the precondition is
 * reachable. Case 2 is a defensive test: the save button's disabled prop is
 * dropped by a test-only Button wrapper, so handleSave is invoked while the
 * older save is still pending. It is not a normal-UI path.
 * Real screen, real useExecutionRecord. StrictMode ON.
 */
import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';
import type {
  ExecutionCandidateClassification,
  ExecutionRecordRepository,
} from '@/features/daily/domain/ExecutionRecordRepository';
import type { IUserMaster } from '@/features/users/types';
import { KioskProcedureDetailScreen } from '../KioskProcedureDetailScreen';

const DATE = '2026-10-23';
const LOADED_MEMO = '【様子】落ち着いていた\n【メモ】元の観察';
const NAVIGATION_DELAY_MS = 1500;

type UserStatus = 'idle' | 'loading' | 'success' | 'error';

type PendingClassify = {
  seq: number;
  date: string;
  userIds: string[];
  scheduleItemIds: string[];
  settled: boolean;
  resolve: (value: ExecutionCandidateClassification) => void;
  reject: (error: Error) => void;
};

type UpsertGate = {
  resolve: () => void;
  reject: (error: Error) => void;
};

const harness = vi.hoisted(() => {
  const navigate = vi.fn();
  const route = { userId: 'U001', slotKey: '0', search: '?date=2026-10-23' };
  const userState: { current: { data: IUserMaster | null; status: UserStatus } } = {
    current: { data: null, status: 'success' },
  };
  const gates: { upsert: UpsertGate | null; queue: UpsertGate[] } = { upsert: null, queue: [] };
  const counts = { screenMounts: 0, screenUnmounts: 0, classifySeq: 0, timerSeq: 0 };
  const heldTimers: { id: number; delay: number; callback: () => void }[] = [];
  const classifyCalls: PendingClassify[] = [];
  const upsertRecord = vi.fn((_record: ExecutionRecord) => new Promise<void>((resolve, reject) => {
    gates.upsert = {
      resolve: () => resolve(),
      reject: (error: Error) => reject(error),
    };
    gates.queue.push(gates.upsert);
  }));
  const classifyExecutionCandidates = vi.fn((
    date: string,
    userIds: readonly string[],
    scheduleItemIds: readonly string[],
  ) => new Promise<ExecutionCandidateClassification>((resolve, reject) => {
    const call: PendingClassify = {
      seq: ++counts.classifySeq,
      date,
      userIds: [...userIds],
      scheduleItemIds: [...scheduleItemIds],
      settled: false,
      resolve: (value) => {
        call.settled = true;
        resolve(value);
      },
      reject: (error) => {
        call.settled = true;
        reject(error);
      },
    };
    classifyCalls.push(call);
  }));
  const attendanceRepository = {
    getDailyByDate: vi.fn(async () => []),
    getActiveUsers: vi.fn(async () => []),
    upsertDailyByKey: vi.fn(async () => undefined),
    getObservationsByDate: vi.fn(async () => []),
  };
  const repository = {
    getRecords: vi.fn(async () => []),
    getRecord: vi.fn(async () => undefined),
    getRecordForCandidates: vi.fn(async () => undefined),
    classifyExecutionCandidates,
    upsertRecord,
    deleteRecord: vi.fn(async () => undefined),
    getCompletionRate: vi.fn(async () => ({ completed: 0, triggered: 0, rate: 0 })),
    getHistoricalRecords: vi.fn(async () => []),
    getRecordsInRange: vi.fn(async () => []),
  } satisfies ExecutionRecordRepository;
  return {
    navigate,
    route,
    userState,
    gates,
    counts,
    heldTimers,
    classifyCalls,
    upsertRecord,
    classifyExecutionCandidates,
    repository,
    attendanceRepository,
  };
});

function existingRecord(memo = LOADED_MEMO): ExecutionRecord {
  return {
    id: 'rec-a',
    date: DATE,
    userId: 'U001',
    scheduleItemId: 'procedure-1',
    status: 'completed',
    triggeredBipIds: [],
    memo,
    recordedBy: '',
    recordedAt: '2026-10-23T01:00:00.000Z',
  };
}

function makeUser(userId: string, id: number, fullName: string): IUserMaster {
  return { Id: id, UserID: userId, FullName: fullName };
}

vi.mock('@/features/daily/repositories/sharepoint/executionRepositoryFactory', () => ({
  getExecutionRepository: () => harness.repository,
}));

vi.mock('@/features/attendance/repositoryFactory', () => ({
  useAttendanceRepository: () => harness.attendanceRepository,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => harness.navigate,
    useParams: () => ({ userId: harness.route.userId, slotKey: harness.route.slotKey }),
    useLocation: () => ({
      search: harness.route.search,
      pathname: `/kiosk/users/${harness.route.userId}/procedures/${harness.route.slotKey}`,
    }),
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
        rowNo: 1,
        time: '10:00',
        activity: '朝の手順',
        instruction: '声をかけてから記録する',
        activityDetail: '朝の手順',
        instructionDetail: '声をかけてから記録する',
      },
    ],
  }),
}));

const buttonMode = vi.hoisted(() => ({ dropSubmitDisabled: false }));

vi.mock('@mui/material', async () => {
  const actual = await vi.importActual<typeof import('@mui/material')>('@mui/material');
  const React = await vi.importActual<typeof import('react')>('react');
  const ActualButton = actual.Button;
  const Button = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof ActualButton>>(
    function TestButton(props, ref) {
      const testId = (props as Record<string, unknown>)['data-testid'];
      if (buttonMode.dropSubmitDisabled && testId === 'kiosk-observation-submit') {
        const { disabled, ...rest } = props;
        return React.createElement(ActualButton, { ...rest, ref, 'data-disabled': String(Boolean(disabled)) });
      }
      return React.createElement(ActualButton, { ...props, ref, 'data-disabled': String(Boolean(props.disabled)) });
    },
  );
  return { ...actual, Button };
});

function applyTarget(target: 'A' | 'B') {
  if (target === 'B') {
    harness.route.userId = 'U002';
    harness.userState.current = {
      data: makeUser('U002', 2, '合成利用者B'),
      status: 'success',
    };
    return;
  }
  harness.route.userId = 'U001';
  harness.userState.current = {
    data: makeUser('U001', 1, '合成利用者A'),
    status: 'success',
  };
}

function ScreenHost() {
  const counts = useRef(harness.counts);
  counts.current = harness.counts;
  useEffect(() => {
    counts.current.screenMounts += 1;
    return () => {
      counts.current.screenUnmounts += 1;
    };
  }, []);
  return <KioskProcedureDetailScreen />;
}

function screenTree() {
  const body: ReactNode = <ScreenHost />;
  return (
    <MemoryRouter>
      <StrictMode>{body}</StrictMode>
    </MemoryRouter>
  );
}

function memoValue(): string | null {
  const field = screen.queryByTestId('kiosk-observation-memo');
  if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) return field.value;
  return null;
}

// Reads the disabled prop the screen passed, also when the defensive wrapper
// dropped it from the DOM.
function submitDisabled(): boolean | null {
  const submit = screen.queryByTestId('kiosk-observation-submit');
  if (!submit) return null;
  return submit.getAttribute('data-disabled') === 'true';
}

const realSetTimeout = globalThis.setTimeout.bind(globalThis);
const realClearTimeout = globalThis.clearTimeout.bind(globalThis);
let restoreTimers: (() => void) | null = null;

function installControlledTimers() {
  harness.heldTimers.length = 0;
  const setSpy = vi.spyOn(globalThis, 'setTimeout');
  setSpy.mockImplementation(((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const ms = typeof timeout === 'number' && Number.isFinite(timeout) ? timeout : 0;
    if (typeof handler === 'function' && ms === NAVIGATION_DELAY_MS) {
      harness.counts.timerSeq += 1;
      const id = 1_000_000_000 + harness.counts.timerSeq;
      harness.heldTimers.push({
        id,
        delay: ms,
        callback: () => {
          handler();
        },
      });
      return id as unknown as ReturnType<typeof setTimeout>;
    }
    return realSetTimeout(handler, timeout, ...(args as never[]));
  }) as typeof globalThis.setTimeout);
  const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
  clearSpy.mockImplementation(((id?: Parameters<typeof clearTimeout>[0]) => {
    const numeric = typeof id === 'number' ? id : null;
    const index = numeric === null ? -1 : harness.heldTimers.findIndex((timer) => timer.id === numeric);
    if (index >= 0) {
      harness.heldTimers.splice(index, 1);
      return;
    }
    realClearTimeout(id as ReturnType<typeof setTimeout>);
  }) as typeof clearTimeout);
  restoreTimers = () => {
    setSpy.mockRestore();
    clearSpy.mockRestore();
  };
}

async function drain() {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => {
        realSetTimeout(resolve, 0);
      });
    });
  }
}

function pendingFor(userId: string): PendingClassify[] {
  return harness.classifyCalls.filter((call) => !call.settled && call.userIds.includes(userId));
}

async function resolveCall(call: PendingClassify, value: ExecutionCandidateClassification) {
  await act(async () => {
    call.resolve(value);
  });
  await drain();
}

const SAVE_ERROR_TEXT = '記録の保存に失敗しました。再度お試しください。';
const UNCONFIRMED_TEXT = '保存結果を確認できませんでした';
const SNACKBAR_EXIT_WAIT_MS = 800;

async function settleAllPending(userId: string, value: ExecutionCandidateClassification) {
  for (let i = 0; i < 12 && pendingFor(userId).length > 0; i += 1) {
    await resolveCall(pendingFor(userId)[0], value);
  }
}

async function hydrateA() {
  applyTarget('A');
  const view = render(screenTree());
  await drain();
  for (let i = 0; i < 8 && memoValue() !== '元の観察'; i += 1) {
    const oldest = pendingFor('U001')[0];
    if (!oldest) break;
    await resolveCall(oldest, { kind: 'unique', internalId: 11, record: existingRecord() });
  }
  expect(memoValue()).toBe('元の観察');
  return view;
}

async function clickSubmit() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));
  });
  await drain();
}

async function startOldSaveOnAThenSwitchToB() {
  const view = await hydrateA();
  expect(submitDisabled()).toBe(false);
  await clickSubmit();
  expect(harness.upsertRecord.mock.calls.length).toBe(1);
  const oldGate = harness.gates.queue[0];
  expect(oldGate).toBeDefined();
  applyTarget('B');
  view.rerender(screenTree());
  await drain();
  await settleAllPending('U002', { kind: 'absent' });
  return { view, oldGate };
}

describe('KioskProcedureDetailScreen stale save ownership', () => {
  beforeEach(() => {
    installControlledTimers();
    buttonMode.dropSubmitDisabled = false;
    harness.navigate.mockClear();
    harness.upsertRecord.mockClear();
    harness.classifyExecutionCandidates.mockClear();
    harness.repository.deleteRecord.mockClear();
    harness.classifyCalls.length = 0;
    harness.counts.screenMounts = 0;
    harness.counts.screenUnmounts = 0;
    harness.counts.classifySeq = 0;
    harness.counts.timerSeq = 0;
    harness.gates.upsert = null;
    harness.gates.queue.length = 0;
    harness.heldTimers.length = 0;
    applyTarget('A');
  });

  afterEach(() => {
    cleanup();
    restoreTimers?.();
    buttonMode.dropSubmitDisabled = false;
  });

  it('NORMAL UI: a later save cannot start on B while the older A save is pending', async () => {
    await startOldSaveOnAThenSwitchToB();
    expect(screen.getByTestId('kiosk-observation-submit')).toBeDisabled();
    expect(submitDisabled()).toBe(true);
    await clickSubmit();
    expect(harness.upsertRecord.mock.calls.length).toBe(1);
    console.info('STALE_SAVE_OWNERSHIP_REACHABILITY normal-ui=unreached reason=isSaving-keeps-submit-disabled');
  });

  it('DEFENSIVE: an older save ending after a later failed save keeps the later notice and hold', async () => {
    buttonMode.dropSubmitDisabled = true;
    const { oldGate } = await startOldSaveOnAThenSwitchToB();

    await act(async () => {
      fireEvent.change(screen.getByTestId('kiosk-observation-memo'), { target: { value: '後の保存' } });
    });
    await drain();
    await clickSubmit();
    expect(harness.upsertRecord.mock.calls.length).toBe(2);
    const laterGate = harness.gates.queue[1];
    expect(laterGate).toBeDefined();

    const classifiesBeforeLaterFailure = harness.classifyCalls.length;
    await act(async () => {
      laterGate.reject(new Error('later save failed'));
    });
    await drain();
    expect(screen.getByText(SAVE_ERROR_TEXT)).toBeInTheDocument();
    expect(submitDisabled()).toBe(true);
    const laterRecheck = pendingFor('U002').filter((call) => call.seq > classifiesBeforeLaterFailure);
    expect(laterRecheck.length, 'later failure started no recheck').toBeGreaterThan(0);

    const classifiesBeforeOldEnd = harness.classifyCalls.length;
    await act(async () => {
      oldGate.reject(new Error('older save failed'));
    });
    await drain();
    // Wait past the Snackbar exit transition so a cleared notice has left the DOM.
    await act(async () => {
      await new Promise<void>((resolve) => {
        realSetTimeout(resolve, SNACKBAR_EXIT_WAIT_MS);
      });
    });
    expect(screen.getByText(SAVE_ERROR_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(UNCONFIRMED_TEXT)).toBeNull();
    expect(submitDisabled()).toBe(true);
    expect(harness.classifyCalls.length).toBe(classifiesBeforeOldEnd);

    await settleAllPending('U002', { kind: 'absent' });
    // The Snackbar text leaves the DOM after its exit transition.
    await waitFor(() => expect(screen.queryByText(SAVE_ERROR_TEXT)).toBeNull());
    expect(submitDisabled()).toBe(false);
    expect(harness.upsertRecord.mock.calls.length).toBe(2);
    expect(harness.navigate.mock.calls.length).toBe(0);
  });
  async function runSameTargetLaterFailsFirst(mode: 'normal-ui' | 'direct-handler') {
    if (mode === 'direct-handler') buttonMode.dropSubmitDisabled = true;
    await hydrateA();
    await act(async () => {
      fireEvent.change(screen.getByTestId('kiosk-observation-memo'), { target: { value: '同じ対象の保存' } });
    });
    await drain();
    expect(submitDisabled()).toBe(false);
    if (mode === 'normal-ui') {
      // Two clicks before React re-renders the disabled button.
      const submit = screen.getByTestId('kiosk-observation-submit');
      await act(async () => {
        submit.click();
        submit.click();
      });
      await drain();
    } else {
      await clickSubmit();
      await clickSubmit();
    }
    expect(harness.upsertRecord.mock.calls.length).toBe(2);
    const [olderGate, laterGate] = harness.gates.queue;
    expect(olderGate).toBeDefined();
    expect(laterGate).toBeDefined();
    expect(laterGate).not.toBe(olderGate);

    await act(async () => {
      laterGate.reject(new Error('later save failed'));
    });
    await drain();
    expect(screen.getByText(SAVE_ERROR_TEXT)).toBeInTheDocument();
    expect(submitDisabled()).toBe(true);

    const classifiesBeforeOlderEnd = harness.classifyCalls.length;
    await act(async () => {
      olderGate.reject(new Error('older save failed'));
    });
    await drain();
    await act(async () => {
      await new Promise<void>((resolve) => {
        realSetTimeout(resolve, SNACKBAR_EXIT_WAIT_MS);
      });
    });
    expect(screen.getByText(SAVE_ERROR_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(UNCONFIRMED_TEXT)).toBeNull();
    expect(submitDisabled()).toBe(true);

    // Fetches that started before the older save ended must not release the hold.
    const startedBeforeOlderEnd = pendingFor('U001').filter((call) => call.seq <= classifiesBeforeOlderEnd);
    for (const call of startedBeforeOlderEnd) {
      await resolveCall(call, { kind: 'unique', internalId: 11, record: existingRecord() });
      expect(submitDisabled()).toBe(true);
      expect(screen.getByText(SAVE_ERROR_TEXT)).toBeInTheDocument();
    }
    const startedAfterOlderEnd = pendingFor('U001').filter((call) => call.seq > classifiesBeforeOlderEnd);
    expect(startedAfterOlderEnd.length, 'no recheck started after the older save ended').toBeGreaterThan(0);
    console.info(`STALE_SAVE_SAME_TARGET ${JSON.stringify({
      mode,
      before: startedBeforeOlderEnd.map((call) => call.seq),
      after: startedAfterOlderEnd.map((call) => call.seq),
    })}`);
    for (const call of startedAfterOlderEnd) {
      await resolveCall(call, { kind: 'unique', internalId: 11, record: existingRecord() });
    }
    expect(submitDisabled()).toBe(false);
    await waitFor(() => expect(screen.queryByText(SAVE_ERROR_TEXT)).toBeNull());
    expect(harness.upsertRecord.mock.calls.length).toBe(2);
    expect(harness.navigate.mock.calls.length).toBe(0);
  }

  it('NORMAL UI same target: the later save fails first, then the older save fails', async () => {
    await runSameTargetLaterFailsFirst('normal-ui');
  });

  it('DEFENSIVE same target: the later save fails first, then the older save fails', async () => {
    await runSameTargetLaterFailsFirst('direct-handler');
  });
});
