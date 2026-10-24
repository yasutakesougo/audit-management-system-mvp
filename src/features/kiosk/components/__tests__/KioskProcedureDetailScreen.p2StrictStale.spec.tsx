/**
 * StrictMode ON for every render and rerender.
 * A classify captured on an earlier visit to A is resolved either before or
 * after the return visit's recheck. Real screen, real useExecutionRecord.
 * Only the execution repository is mocked. The 1500 ms navigation timer is held.
 */
import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
const STALE_MARKER = '古い照合の記録';
const NAVIGATION_DELAY_MS = 1500;

type UserStatus = 'idle' | 'loading' | 'success' | 'error';
type RecheckKind = 'absent' | 'unique' | 'duplicate' | 'error';
type StaleTiming = 'before' | 'after';

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
  const gates: { upsert: UpsertGate | null } = { upsert: null };
  const counts = { screenMounts: 0, screenUnmounts: 0, classifySeq: 0, timerSeq: 0 };
  const heldTimers: { id: number; delay: number; callback: () => void }[] = [];
  const classifyCalls: PendingClassify[] = [];
  const upsertRecord = vi.fn((_record: ExecutionRecord) => new Promise<void>((resolve, reject) => {
    gates.upsert = {
      resolve: () => resolve(),
      reject: (error: Error) => reject(error),
    };
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

function staleRecord(): ExecutionRecord {
  return existingRecord(`【様子】落ち着いていた\n【メモ】${STALE_MARKER}`);
}

function confirmedRecord(): ExecutionRecord {
  return existingRecord('【様子】落ち着いていた\n【メモ】照合で確認した記録');
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

function submitDisabled(): boolean | null {
  const submit = screen.queryByTestId('kiosk-observation-submit');
  return submit instanceof HTMLButtonElement ? submit.disabled : null;
}

function revertState(): { present: boolean; disabled: boolean | null } {
  const revert = screen.queryByTestId('kiosk-observation-revert');
  return {
    present: revert !== null,
    disabled: revert instanceof HTMLButtonElement ? revert.disabled : null,
  };
}

function blockState() {
  return {
    submitDisabled: submitDisabled(),
    revertPresent: revertState().present,
    revertDisabled: revertState().disabled,
    loadError: screen.queryByText('実施記録の読み込みに失敗しました') !== null,
    checking: screen.queryByText('実施記録を確認中です') !== null,
    conflict: screen.queryByTestId('kiosk-conflict-alert') !== null,
    staleVisible: screen.queryAllByText(STALE_MARKER).length,
    confirmedVisible: screen.queryAllByText('照合で確認した記録').length,
    upsertCalls: harness.upsertRecord.mock.calls.length,
    deleteCalls: harness.repository.deleteRecord.mock.calls.length,
    navigateCalls: harness.navigate.mock.calls.length,
    screenMounted: screen.queryByTestId('kiosk-observation-submit') !== null,
  };
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

function expectNoNavigationTimer() {
  expect(harness.heldTimers.map((timer) => timer.delay)).toEqual([]);
  expect(harness.navigate.mock.calls).toEqual([]);
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

async function settleOldest(userId: string, value: ExecutionCandidateClassification): Promise<PendingClassify | null> {
  const oldest = pendingFor(userId)[0];
  if (!oldest) return null;
  await resolveCall(oldest, value);
  return oldest;
}

async function hydrateLoadedRecord() {
  applyTarget('A');
  const view = render(screenTree());
  await drain();
  for (let i = 0; i < 8 && memoValue() !== '元の観察'; i += 1) {
    const settled = await settleOldest('U001', { kind: 'unique', internalId: 11, record: existingRecord() });
    if (!settled) break;
  }
  expect(memoValue(), `hydrated memo seqs=${harness.classifyCalls.map((call) => call.seq).join(',')}`).toBe('元の観察');
  return view;
}

async function startSave() {
  expect(submitDisabled()).toBe(false);
  await act(async () => {
    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));
  });
  await drain();
  expect(harness.upsertRecord.mock.calls.length).toBe(1);
  expect(harness.gates.upsert).not.toBeNull();
  expectNoNavigationTimer();
}

function expectStillThisScreen(mountsAfterLoad: number, unmountsAfterLoad: number) {
  expect(harness.counts.screenMounts).toBe(mountsAfterLoad);
  expect(harness.counts.screenUnmounts).toBe(unmountsAfterLoad);
  expect(screen.getByTestId('kiosk-observation-submit')).toBeInTheDocument();
  expect(harness.navigate.mock.calls.length).toBe(0);
  expect(harness.upsertRecord.mock.calls.length).toBe(1);
  expect(harness.repository.deleteRecord.mock.calls.length).toBe(0);
  expectNoNavigationTimer();
}

function expectRecheckOutcome(kind: RecheckKind) {
  expect(screen.queryAllByText(STALE_MARKER)).toHaveLength(0);
  expectNoNavigationTimer();
  expect(harness.navigate.mock.calls.length).toBe(0);
  expect(harness.upsertRecord.mock.calls.length).toBe(1);
  expect(harness.repository.deleteRecord.mock.calls.length).toBe(0);
  if (kind === 'absent') {
    expect(submitDisabled()).toBe(false);
    expect(revertState().present).toBe(false);
    expect(screen.queryByText('実施記録の読み込みに失敗しました')).toBeNull();
    expect(screen.queryByText('実施記録を確認中です')).toBeNull();
  } else if (kind === 'unique') {
    expect(submitDisabled()).toBe(false);
    expect(revertState()).toEqual({ present: true, disabled: false });
    expect(screen.queryAllByText('照合で確認した記録').length).toBeGreaterThan(0);
    expect(screen.queryByText('実施記録の読み込みに失敗しました')).toBeNull();
  } else {
    expect(screen.queryByText('実施記録の読み込みに失敗しました')).toBeInTheDocument();
    expect(submitDisabled()).toBe(true);
    expect(revertState().present && revertState().disabled === false).toBe(false);
    expect(screen.queryAllByText('照合で確認した記録')).toHaveLength(0);
  }
}

async function settleRecheck(kind: RecheckKind, call: PendingClassify) {
  if (kind === 'error') {
    await act(async () => {
      call.reject(new Error('recheck failed'));
    });
    await drain();
    return;
  }
  if (kind === 'unique') {
    await resolveCall(call, { kind: 'unique', internalId: 21, record: confirmedRecord() });
    return;
  }
  if (kind === 'duplicate') {
    await resolveCall(call, { kind: 'duplicate' });
    return;
  }
  await resolveCall(call, { kind: 'absent' });
}

const KINDS = ['absent', 'unique', 'duplicate', 'error'] as const;

describe('KioskProcedureDetailScreen StrictMode stale classify', () => {
  beforeEach(() => {
    installControlledTimers();
    const fetchBeforeSpy = globalThis.fetch.bind(globalThis);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      return fetchBeforeSpy(input, init);
    });
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
    harness.heldTimers.length = 0;
    applyTarget('A');
  });

  afterEach(() => {
    cleanup();
    restoreTimers?.();
    vi.mocked(globalThis.fetch).mockRestore();
  });

  async function captureStaleVisitAndReturn() {
    const view = await hydrateLoadedRecord();
    const mountsAfterLoad = harness.counts.screenMounts;
    const unmountsAfterLoad = harness.counts.screenUnmounts;
    await startSave();

    applyTarget('B');
    view.rerender(screenTree());
    await drain();
    expectNoNavigationTimer();
    applyTarget('A');
    view.rerender(screenTree());
    await drain();
    expectNoNavigationTimer();
    const staleA = pendingFor('U001').slice();
    expect(staleA.length, 'earlier A visit produced no classify').toBeGreaterThan(0);

    applyTarget('B');
    view.rerender(screenTree());
    await drain();
    expectNoNavigationTimer();
    await act(async () => {
      harness.gates.upsert?.reject(new Error('save failed'));
    });
    await drain();
    expectNoNavigationTimer();
    for (let i = 0; i < 8 && pendingFor('U002').length > 0; i += 1) {
      const oldest = pendingFor('U002')[0];
      if (!oldest || staleA.includes(oldest)) break;
      await resolveCall(oldest, { kind: 'absent' });
    }

    const classifiesBeforeReturn = harness.classifyCalls.length;
    applyTarget('A');
    view.rerender(screenTree());
    await drain();
    const recheckCalls = pendingFor('U001').filter((call) => !staleA.includes(call));
    expect(recheckCalls.length, 'return visit produced no recheck').toBeGreaterThan(0);
    const liveRecheck = recheckCalls.reduce((latest, call) => (call.seq > latest.seq ? call : latest));
    const recheckExtras = recheckCalls.filter((call) => call !== liveRecheck);
    expect(staleA.every((call) => call.seq < liveRecheck.seq)).toBe(true);
    expect(harness.classifyCalls.length).toBeGreaterThan(classifiesBeforeReturn);
    expectStillThisScreen(mountsAfterLoad, unmountsAfterLoad);
    expect(submitDisabled()).toBe(true);
    expect(screen.queryAllByText(STALE_MARKER)).toHaveLength(0);

    console.info(`STRICT_STALE_CAPTURE ${JSON.stringify({
      mountsAfterLoad,
      unmountsAfterLoad,
      staleCount: staleA.length,
      staleSeqs: staleA.map((call) => call.seq),
      recheckCount: recheckCalls.length,
      recheckSeqs: recheckCalls.map((call) => call.seq),
      liveSeq: liveRecheck.seq,
      extraSeqs: recheckExtras.map((call) => call.seq),
      classifyTotal: harness.classifyCalls.length,
    })}`);

    return { mountsAfterLoad, unmountsAfterLoad, staleA, liveRecheck, recheckExtras };
  }

  async function resolveEarlierVisit(staleA: PendingClassify[]) {
    const classifyCount = harness.classifyCalls.length;
    for (const call of staleA) {
      await resolveCall(call, { kind: 'unique', internalId: 99, record: staleRecord() });
    }
    expect(harness.classifyCalls.length).toBe(classifyCount);
    expect(staleA.every((call) => call.settled)).toBe(true);
  }

  it.each(KINDS)(
    'STRICT stale A classify resolves before the %s recheck',
    async (kind: RecheckKind) => {
      const { mountsAfterLoad, unmountsAfterLoad, staleA, liveRecheck, recheckExtras } = await captureStaleVisitAndReturn();
      await resolveEarlierVisit(staleA);

      expect(liveRecheck.settled).toBe(false);
      expect(submitDisabled()).toBe(true);
      expect(screen.queryAllByText(STALE_MARKER)).toHaveLength(0);
      expect(screen.queryByText('実施記録を確認中です')).toBeInTheDocument();
      expectStillThisScreen(mountsAfterLoad, unmountsAfterLoad);

      for (const extra of recheckExtras) {
        await resolveCall(extra, { kind: 'unique', internalId: 98, record: staleRecord() });
        expect(liveRecheck.settled).toBe(false);
        expect(submitDisabled()).toBe(true);
        expect(screen.queryAllByText(STALE_MARKER)).toHaveLength(0);
        expectNoNavigationTimer();
      }

      await settleRecheck(kind, liveRecheck);
      expectRecheckOutcome(kind);
      expectStillThisScreen(mountsAfterLoad, unmountsAfterLoad);
    },
  );

  it.each(KINDS)(
    'STRICT stale A classify resolves after the %s recheck',
    async (kind: RecheckKind) => {
      const { mountsAfterLoad, unmountsAfterLoad, staleA, liveRecheck, recheckExtras } = await captureStaleVisitAndReturn();
      await settleRecheck(kind, liveRecheck);
      expectRecheckOutcome(kind);
      const afterRecheck = blockState();

      await resolveEarlierVisit(staleA);
      expect(blockState()).toEqual(afterRecheck);
      expectRecheckOutcome(kind);
      expectStillThisScreen(mountsAfterLoad, unmountsAfterLoad);

      for (const extra of recheckExtras) {
        await resolveCall(extra, { kind: 'unique', internalId: 98, record: staleRecord() });
        expect(blockState()).toEqual(afterRecheck);
        expect(screen.queryAllByText(STALE_MARKER)).toHaveLength(0);
        expectNoNavigationTimer();
      }
      expectStillThisScreen(mountsAfterLoad, unmountsAfterLoad);
    },
  );
});
