/**
 * Strict-mode and extra cases for the kiosk save confirmation.
 * The p2SaveConflict witness file is left unchanged.
 * Real screen, real useExecutionRecord. Only the execution repository is mocked.
 */
import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type {
  ExecutionRecordRepository,
} from '@/features/daily';
import type { IUserMaster } from '@/features/users/types';
import { KioskProcedureDetailScreen } from '../KioskProcedureDetailScreen';

type ExecutionRecord = Awaited<ReturnType<ExecutionRecordRepository['getRecords']>>[number];
type ExecutionRecordUpsertOptions = NonNullable<Parameters<ExecutionRecordRepository['upsertRecord']>[1]>;
type ExecutionCandidateClassification =
  NonNullable<ExecutionRecordRepository['classifyExecutionCandidates']> extends (...args: any[]) => Promise<infer R>
    ? R
    : never;

const DATE = '2026-10-23';
const DRAFT_MEMO = '編集後の観察';
const LATER_MEMO = '保存開始後の観察';
const PENDING_EDIT_NOTICE = '保存開始時の内容を保存しました。追加の編集は未保存です。';
const LOADED_MEMO = '【様子】落ち着いていた\n【メモ】元の観察';
const NAVIGATION_DELAY_MS = 1500;
const RETURN_URL = '/kiosk/users/U001/procedures?date=2026-10-23';

type UserStatus = 'idle' | 'loading' | 'success' | 'error';
type RecheckKind = 'absent' | 'unique' | 'duplicate' | 'error';

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

type DeleteGate = {
  resolve: () => void;
  reject: (error: Error) => void;
};

const harness = vi.hoisted(() => {
  const navigate = vi.fn();
  const route = { userId: 'U001', slotKey: '0', search: '?date=2026-10-23' };
  const userState: { current: { data: IUserMaster | null; status: UserStatus } } = {
    current: { data: null, status: 'success' },
  };
  const gates: { upsert: UpsertGate | null; delete: DeleteGate | null } = { upsert: null, delete: null };
  const counts = { screenMounts: 0, classifySeq: 0, timerSeq: 0 };
  const heldTimers: { id: number; delay: number; callback: () => void }[] = [];
  const classifyCalls: PendingClassify[] = [];
  const upsertRecord = vi.fn((
    _record: ExecutionRecord,
    _options?: ExecutionRecordUpsertOptions,
  ) => new Promise<void>((resolve, reject) => {
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
    deleteRecord: vi.fn(() => new Promise<void>((resolve, reject) => {
      gates.delete = {
        resolve: () => resolve(),
        reject: (error: Error) => reject(error),
      };
    })),
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
  useUsers: () => ({ users: [], loading: false, error: null }),
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
  }, []);
  return <KioskProcedureDetailScreen />;
}

function screenTree(strict: boolean) {
  const body: ReactNode = <ScreenHost />;
  return (
    <MemoryRouter>
      {strict ? <StrictMode>{body}</StrictMode> : body}
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
    return realSetTimeout((...cbArgs: unknown[]) => {
      act(() => {
        if (typeof handler === 'function') {
          handler(...(cbArgs.length > 0 ? cbArgs : args));
        }
      });
    }, timeout);
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

async function releaseHeldNavigation() {
  expect(harness.navigate.mock.calls).toEqual([]);
  expect(harness.heldTimers.map((timer) => timer.delay)).toEqual([NAVIGATION_DELAY_MS]);
  const callback = harness.heldTimers[0]?.callback;
  expect(typeof callback).toBe('function');
  await act(async () => {
    callback?.();
  });
  expect(harness.navigate.mock.calls).toEqual([[RETURN_URL]]);
}

function pendingFor(userId: string): PendingClassify[] {
  return harness.classifyCalls.filter((call) => !call.settled && call.userIds.includes(userId));
}

async function settleOldest(userId: string, value: ExecutionCandidateClassification): Promise<PendingClassify | null> {
  const oldest = pendingFor(userId)[0];
  if (!oldest) return null;
  await act(async () => {
    oldest.resolve(value);
  });
  await drain();
  return oldest;
}

async function hydrateLoadedRecord(strict: boolean) {
  applyTarget('A');
  const view = render(screenTree(strict));
  await drain();
  for (let i = 0; i < 8 && memoValue() !== '元の観察'; i += 1) {
    const settled = await settleOldest('U001', { kind: 'unique', internalId: 11, record: existingRecord() });
    if (!settled) break;
  }
  expect(memoValue(), `hydrated memo classify=${JSON.stringify(harness.classifyCalls.map((call) => call.seq))}`).toBe('元の観察');
  return view;
}

function editObservation(value = DRAFT_MEMO) {
  fireEvent.change(screen.getByTestId('kiosk-observation-memo'), { target: { value } });
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

const SAVED_DRAFT_MEMO = '【様子】落ち着いていた\n【メモ】編集後の観察';
const SAVED_LATER_MEMO = '【様子】落ち着いていた\n【メモ】保存開始後の観察';

function observedUpserts() {
  return harness.upsertRecord.mock.calls.map((call) => {
    const record = call[0];
    return {
      id: record.id,
      date: record.date,
      userId: record.userId,
      scheduleItemId: record.scheduleItemId,
      status: record.status,
      memo: record.memo,
      options: call[1],
    };
  });
}

function expectSameRecordUpdate(memos: string[]) {
  expect(observedUpserts()).toEqual(memos.map((memo) => ({
    id: 'rec-a',
    date: DATE,
    userId: 'U001',
    scheduleItemId: 'procedure-1',
    status: 'completed',
    memo,
    options: { memoMode: 'overwrite' },
  })));
  expect(harness.repository.deleteRecord.mock.calls).toEqual([]);
}

async function resolveUpsertOnly() {
  const classifyCount = harness.classifyCalls.length;
  await act(async () => {
    harness.gates.upsert?.resolve();
  });
  await drain();
  expect(harness.classifyCalls.length).toBe(classifyCount);
}

async function resolveUpsertAndUniqueClassify() {
  const before = harness.classifyCalls.length;
  await act(async () => {
    harness.gates.upsert?.resolve();
  });
  await drain();
  const postSave = harness.classifyCalls.slice(before).filter((call) => !call.settled && call.userIds.includes('U001'));
  expect(postSave.length).toBeGreaterThan(0);
  for (const call of postSave) {
    await act(async () => {
      call.resolve({ kind: 'unique', internalId: 12, record: existingRecord() });
    });
    await drain();
  }
}

describe('KioskProcedureDetailScreen strict save confirmation', () => {
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
    harness.counts.classifySeq = 0;
    harness.counts.timerSeq = 0;
    harness.gates.upsert = null;
    harness.gates.delete = null;
    harness.heldTimers.length = 0;
    applyTarget('A');
  });

  afterEach(() => {
    cleanup();
    restoreTimers?.();
    vi.mocked(globalThis.fetch).mockRestore();
  });

  it('STRICT Case1 does not show a conflict from its own unique save', async () => {
    await hydrateLoadedRecord(true);
    const mountsAfterLoad = harness.counts.screenMounts;
    editObservation();
    await startSave();
    await resolveUpsertAndUniqueClassify();

    expect(screen.queryByTestId('kiosk-conflict-alert')).toBeNull();
    expect(screen.queryByTestId('kiosk-record-missing-conflict-alert')).toBeNull();
    expect(memoValue()).toBe(DRAFT_MEMO);
    expect(harness.upsertRecord.mock.calls.length).toBe(1);
    expect(harness.navigate.mock.calls.length).toBe(0);
    expect(harness.counts.screenMounts).toBe(mountsAfterLoad);
    expect(screen.getByText('記録を保存しました')).toBeInTheDocument();
    await releaseHeldNavigation();
  });

  it.each(['absent', 'unique', 'duplicate', 'error'] as const)(
    'STRICT Case2 %s recheck follows the held target',
    async (kind: RecheckKind) => {
      const view = await hydrateLoadedRecord(true);
      const mountsAfterLoad = harness.counts.screenMounts;
      editObservation();
      await startSave();

      applyTarget('B');
      view.rerender(screenTree(true));
      await drain();
      expectNoNavigationTimer();
      await act(async () => {
        harness.gates.upsert?.reject(new Error('save failed'));
      });
      await drain();
      expect(screen.queryByText('記録の保存に失敗しました。再度お試しください。')).toBeNull();
      expect(screen.queryByText('保存結果を確認できませんでした')).toBeNull();
      expectNoNavigationTimer();
      for (let i = 0; i < 6 && pendingFor('U002').length > 0; i += 1) {
        await settleOldest('U002', { kind: 'absent' });
      }

      applyTarget('A');
      view.rerender(screenTree(true));
      await drain();
      const recheck = pendingFor('U001').at(-1);
      expect(recheck, 'recheck classify was not started').toBeDefined();
      expect(submitDisabled()).toBe(true);
      expectNoNavigationTimer();

      if (kind === 'error') {
        await act(async () => {
          recheck?.reject(new Error('recheck failed'));
        });
        await drain();
        for (const extra of pendingFor('U001')) {
          await act(async () => {
            extra.reject(new Error('stale recheck failed'));
          });
          await drain();
        }
      } else if (kind === 'unique') {
        await act(async () => {
          recheck?.resolve({ kind: 'unique', internalId: 21, record: confirmedRecord() });
        });
        await drain();
        for (const extra of pendingFor('U001')) {
          await act(async () => {
            extra.resolve({ kind: 'unique', internalId: 21, record: confirmedRecord() });
          });
          await drain();
        }
      } else if (kind === 'duplicate') {
        await act(async () => {
          recheck?.resolve({ kind: 'duplicate' });
        });
        await drain();
        for (const extra of pendingFor('U001')) {
          await act(async () => {
            extra.resolve({ kind: 'duplicate' });
          });
          await drain();
        }
      } else {
        await act(async () => {
          recheck?.resolve({ kind: 'absent' });
        });
        await drain();
        for (const extra of pendingFor('U001')) {
          await act(async () => {
            extra.resolve({ kind: 'absent' });
          });
          await drain();
        }
      }

      expect(harness.counts.screenMounts).toBe(mountsAfterLoad);
      expect(harness.repository.deleteRecord.mock.calls.length).toBe(0);
      expectNoNavigationTimer();
      if (kind === 'absent') {
        expect(submitDisabled()).toBe(false);
        expect(revertState().present).toBe(false);
        expect(screen.queryByText('実施記録の読み込みに失敗しました')).toBeNull();
      } else if (kind === 'unique') {
        expect(submitDisabled()).toBe(false);
        expect(revertState()).toEqual({ present: true, disabled: false });
        expect(screen.queryAllByText('照合で確認した記録').length).toBeGreaterThan(0);
      } else {
        expect(screen.queryByText('実施記録の読み込みに失敗しました')).toBeInTheDocument();
        expect(submitDisabled()).toBe(true);
        expect(revertState().present && revertState().disabled === false).toBe(false);
      }
    },
  );

  async function settlePending(userId: string, value: ExecutionCandidateClassification) {
    for (let i = 0; i < 8 && pendingFor(userId).length > 0; i += 1) {
      const settled = await settleOldest(userId, value);
      if (!settled) break;
    }
  }

  it('does not apply an in-flight save success that settles on B', async () => {
    const view = await hydrateLoadedRecord(true);
    const mountsAfterLoad = harness.counts.screenMounts;
    editObservation();
    await startSave();

    applyTarget('B');
    view.rerender(screenTree(true));
    await drain();
    const classifiesBeforeResolve = harness.classifyCalls.length;
    await act(async () => {
      harness.gates.upsert?.resolve();
    });
    await drain();
    await settlePending('U002', { kind: 'absent' });

    expect(screen.queryByText('記録を保存しました')).toBeNull();
    expect(screen.queryByText('記録の保存に失敗しました。再度お試しください。')).toBeNull();
    expect(screen.queryByText('保存結果を確認できませんでした')).toBeNull();
    expect(screen.getByText('合成利用者B 様')).toBeInTheDocument();
    expect(submitDisabled()).toBe(false);
    expectNoNavigationTimer();
    expect(harness.classifyCalls.length).toBe(classifiesBeforeResolve);
    expect(harness.upsertRecord.mock.calls.length).toBe(1);
    expect(harness.repository.deleteRecord.mock.calls).toEqual([]);
    expect(harness.counts.screenMounts).toBe(mountsAfterLoad);
  });

  async function returnToADuringSave(view: { rerender: (node: ReactNode) => void }) {
    applyTarget('B');
    view.rerender(screenTree(true));
    await drain();
    expect(screen.queryByText('記録を保存しました')).toBeNull();
    expect(screen.queryByText('記録の保存に失敗しました。再度お試しください。')).toBeNull();
    expect(screen.queryByText('保存結果を確認できませんでした')).toBeNull();
    applyTarget('A');
    view.rerender(screenTree(true));
    await drain();
    await settlePending('U001', { kind: 'unique', internalId: 11, record: existingRecord() });
    expect(memoValue()).toBe('元の観察');
    expect(screen.getByText('合成利用者A 様')).toBeInTheDocument();
    expect(pendingFor('U001')).toEqual([]);
  }

  async function expectOneRecheckThenRelease(classifiesBeforeSettle: number) {
    const started = harness.classifyCalls.slice(classifiesBeforeSettle).filter((call) => !call.settled && call.userIds.includes('U001'));
    expect(started).toHaveLength(1);
    expect(submitDisabled()).toBe(true);
    expect(revertState()).toEqual({ present: true, disabled: true });
    expect(screen.queryByText('記録を保存しました')).toBeNull();
    expect(screen.queryByText('記録の保存に失敗しました。再度お試しください。')).toBeNull();
    expect(screen.getByText('保存結果を確認できませんでした')).toBeInTheDocument();
    expect(harness.upsertRecord.mock.calls.length).toBe(1);
    expect(harness.repository.deleteRecord.mock.calls).toEqual([]);

    await act(async () => {
      started[0]?.resolve({ kind: 'unique', internalId: 11, record: existingRecord() });
    });
    await drain();

    expect(harness.classifyCalls.length).toBe(classifiesBeforeSettle + 1);
    expect(submitDisabled()).toBe(false);
    expect(revertState()).toEqual({ present: true, disabled: false });
    expect(memoValue()).toBe('元の観察');
    expect(screen.queryByText('保存結果を確認できませんでした')).toBeNull();
    expect(screen.queryByText('記録を保存しました')).toBeNull();
    expect(harness.upsertRecord.mock.calls.length).toBe(1);
    expect(harness.repository.deleteRecord.mock.calls).toEqual([]);
    expectNoNavigationTimer();
  }

  it('does not accept an in-flight save success that settles after A→B→A', async () => {
    const view = await hydrateLoadedRecord(true);
    const mountsAfterLoad = harness.counts.screenMounts;
    editObservation();
    await startSave();
    await returnToADuringSave(view);
    const classifiesBeforeSettle = harness.classifyCalls.length;

    await act(async () => {
      harness.gates.upsert?.resolve();
    });
    await drain();
    await expectOneRecheckThenRelease(classifiesBeforeSettle);
    expect(harness.counts.screenMounts).toBe(mountsAfterLoad);
  });

  it('blocks returned A until a recheck started after the old save failure settles', async () => {
    const view = await hydrateLoadedRecord(true);
    const mountsAfterLoad = harness.counts.screenMounts;
    editObservation();
    await startSave();
    await returnToADuringSave(view);
    const classifiesBeforeSettle = harness.classifyCalls.length;

    await act(async () => {
      harness.gates.upsert?.reject(new Error('save failed'));
    });
    await drain();
    await expectOneRecheckThenRelease(classifiesBeforeSettle);
    expect(harness.counts.screenMounts).toBe(mountsAfterLoad);
  });

  it('starts one read-only recheck after a current-target save rejection and releases the hold', async () => {
    await hydrateLoadedRecord(true);
    const mountsAfterLoad = harness.counts.screenMounts;
    editObservation();
    await startSave();
    const classifiesBeforeReject = harness.classifyCalls.length;

    await act(async () => {
      harness.gates.upsert?.reject(new Error('save failed'));
    });
    await drain();

    const started = harness.classifyCalls.slice(classifiesBeforeReject).filter((call) => !call.settled && call.userIds.includes('U001'));
    expect(started).toHaveLength(1);
    expect(screen.getByText('記録の保存に失敗しました。再度お試しください。')).toBeInTheDocument();
    expect(submitDisabled()).toBe(true);
    expect(revertState()).toEqual({ present: true, disabled: true });
    expect(harness.upsertRecord.mock.calls.length).toBe(1);
    expect(harness.repository.deleteRecord.mock.calls).toEqual([]);

    await act(async () => {
      started[0]?.resolve({ kind: 'unique', internalId: 11, record: existingRecord() });
    });
    await drain();

    expect(harness.classifyCalls.length).toBe(classifiesBeforeReject + 1);
    await waitFor(() => {
      expect(screen.queryByText('記録の保存に失敗しました。再度お試しください。')).toBeNull();
    });
    expect(submitDisabled()).toBe(false);
    expect(revertState()).toEqual({ present: true, disabled: false });
    expect(memoValue()).toBe(DRAFT_MEMO);
    expect(harness.upsertRecord.mock.calls.length).toBe(1);
    expect(harness.repository.deleteRecord.mock.calls).toEqual([]);
    expectNoNavigationTimer();
    expect(harness.counts.screenMounts).toBe(mountsAfterLoad);
  });

  it('keeps the hold when the automatic recheck fails and does not fetch again', async () => {
    await hydrateLoadedRecord(true);
    const mountsAfterLoad = harness.counts.screenMounts;
    editObservation();
    await startSave();
    const classifiesBeforeReject = harness.classifyCalls.length;

    await act(async () => {
      harness.gates.upsert?.reject(new Error('save failed'));
    });
    await drain();
    const started = harness.classifyCalls.slice(classifiesBeforeReject).filter((call) => !call.settled && call.userIds.includes('U001'));
    expect(started).toHaveLength(1);

    await act(async () => {
      started[0]?.reject(new Error('recheck failed'));
    });
    await drain();

    expect(harness.classifyCalls.length).toBe(classifiesBeforeReject + 1);
    expect(submitDisabled()).toBe(true);
    expect(revertState().present && revertState().disabled === false).toBe(false);
    expect(screen.getByRole('button', { name: '再読み込み' })).toBeInTheDocument();
    expect(screen.getByText('実施記録の読み込みに失敗しました')).toBeInTheDocument();
    expect(memoValue()).toBe(DRAFT_MEMO);
    expect(harness.upsertRecord.mock.calls.length).toBe(1);
    expect(harness.repository.deleteRecord.mock.calls).toEqual([]);
    expectNoNavigationTimer();
    expect(harness.counts.screenMounts).toBe(mountsAfterLoad);
  });

  it('keeps an edit made after the save starts and does not mark it clean', async () => {
    await hydrateLoadedRecord(true);
    editObservation();
    await startSave();
    // A real in-flight save disables the observation inputs. The change below is a
    // synthetic edit event on that disabled control, not a normal user keystroke.
    expect(screen.getByTestId('kiosk-observation-memo')).toBeDisabled();
    editObservation(LATER_MEMO);
    expect(memoValue()).toBe(LATER_MEMO);
    await resolveUpsertAndUniqueClassify();

    expect(screen.queryByTestId('kiosk-conflict-alert')).toBeNull();
    expect(memoValue()).toBe(LATER_MEMO);
    expect(harness.upsertRecord.mock.calls.length).toBe(1);
    expect(screen.queryByText('記録を保存しました')).toBeNull();
    expect(screen.getByText(PENDING_EDIT_NOTICE)).toBeInTheDocument();
    expect(submitDisabled()).toBe(false);
    expectNoNavigationTimer();

    await act(async () => {
      fireEvent.click(screen.getByTestId('kiosk-observation-submit'));
    });
    await drain();
    expectSameRecordUpdate([SAVED_DRAFT_MEMO, SAVED_LATER_MEMO]);
    expectNoNavigationTimer();
  });

  it('keeps an edit made after save resolves and before the navigation callback', async () => {
    await hydrateLoadedRecord(true);
    editObservation();
    await startSave();
    await resolveUpsertAndUniqueClassify();

    expect(screen.getByText('記録を保存しました')).toBeInTheDocument();
    expect(harness.heldTimers.map((timer) => timer.delay)).toEqual([NAVIGATION_DELAY_MS]);
    expect(harness.navigate.mock.calls).toEqual([]);
    expect(screen.getByTestId('kiosk-observation-memo')).not.toBeDisabled();

    editObservation(LATER_MEMO);

    expect(screen.queryByTestId('kiosk-conflict-alert')).toBeNull();
    expect(memoValue()).toBe(LATER_MEMO);
    expect(screen.queryByText('記録を保存しました')).toBeNull();
    expect(screen.getByText(PENDING_EDIT_NOTICE)).toBeInTheDocument();
    expect(submitDisabled()).toBe(false);
    expectNoNavigationTimer();

    await act(async () => {
      fireEvent.click(screen.getByTestId('kiosk-observation-submit'));
    });
    await drain();
    expectSameRecordUpdate([SAVED_DRAFT_MEMO, SAVED_LATER_MEMO]);
    expectNoNavigationTimer();
  });

  it('drops the old target success notice and navigation timer on target switch without unmounting', async () => {
    const view = await hydrateLoadedRecord(true);
    const mountsAfterLoad = harness.counts.screenMounts;
    editObservation();
    await startSave();
    await resolveUpsertAndUniqueClassify();

    expect(screen.getByText('記録を保存しました')).toBeInTheDocument();
    expect(harness.heldTimers.map((timer) => timer.delay)).toEqual([NAVIGATION_DELAY_MS]);

    applyTarget('B');
    view.rerender(screenTree(true));
    await drain();

    expect(screen.queryByText('記録を保存しました')).toBeNull();
    expect(screen.queryByText(PENDING_EDIT_NOTICE)).toBeNull();
    expectNoNavigationTimer();
    expect(harness.counts.screenMounts).toBe(mountsAfterLoad);
  });

  it('clears the navigation timer on unmount', async () => {
    const view = await hydrateLoadedRecord(true);
    editObservation();
    await startSave();
    await resolveUpsertAndUniqueClassify();

    expect(harness.heldTimers.map((timer) => timer.delay)).toEqual([NAVIGATION_DELAY_MS]);
    expect(harness.navigate.mock.calls).toEqual([]);

    view.unmount();

    expect(harness.heldTimers.map((timer) => timer.delay)).toEqual([]);
    expect(harness.navigate.mock.calls).toEqual([]);
  });

  async function startDelete() {
    fireEvent.click(screen.getByTestId('kiosk-observation-revert'));
    const confirm = screen.getByTestId('kiosk-observation-revert-confirm');
    expect(confirm).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(confirm);
    });
    await drain();
    expect(harness.gates.delete).not.toBeNull();
  }

  async function confirmDelete() {
    await startDelete();
    await act(async () => {
      harness.gates.delete?.resolve();
    });
    await drain();
  }

  it('navigates exactly once after delete success', async () => {
    await hydrateLoadedRecord(true);
    await confirmDelete();

    expect(harness.repository.deleteRecord.mock.calls).toEqual([[DATE, 'U001', 'procedure-1']]);
    expect(screen.getByText('記録を取り消しました')).toBeInTheDocument();
    await releaseHeldNavigation();
    expect(harness.navigate.mock.calls).toEqual([[RETURN_URL]]);
  });

  it('clears the delete navigation timer and success notice on target switch', async () => {
    const view = await hydrateLoadedRecord(true);
    const mountsAfterLoad = harness.counts.screenMounts;
    await confirmDelete();

    expect(screen.getByText('記録を取り消しました')).toBeInTheDocument();
    expect(harness.heldTimers.map((timer) => timer.delay)).toEqual([NAVIGATION_DELAY_MS]);

    applyTarget('B');
    view.rerender(screenTree(true));
    await drain();

    expect(screen.queryByText('記録を取り消しました')).toBeNull();
    expect(screen.queryByText('記録を保存しました')).toBeNull();
    expectNoNavigationTimer();
    expect(harness.counts.screenMounts).toBe(mountsAfterLoad);
  });

  it('clears the delete navigation timer on unmount', async () => {
    const view = await hydrateLoadedRecord(true);
    await confirmDelete();

    expect(harness.heldTimers.map((timer) => timer.delay)).toEqual([NAVIGATION_DELAY_MS]);
    expect(harness.navigate.mock.calls).toEqual([]);

    view.unmount();

    expect(harness.heldTimers.map((timer) => timer.delay)).toEqual([]);
    expect(harness.navigate.mock.calls).toEqual([]);
  });

  it('shows no old delete notice when the in-flight delete resolves after a target switch', async () => {
    const view = await hydrateLoadedRecord(true);
    const mountsAfterLoad = harness.counts.screenMounts;
    await startDelete();

    applyTarget('B');
    view.rerender(screenTree(true));
    await drain();
    await act(async () => {
      harness.gates.delete?.resolve();
    });
    await drain();

    expect(screen.queryByText('記録を取り消しました')).toBeNull();
    expect(screen.queryByText('記録の取り消しに失敗しました。再度お試しください。')).toBeNull();
    expectNoNavigationTimer();
    expect(harness.counts.screenMounts).toBe(mountsAfterLoad);
  });

  it('shows no old delete notice when the in-flight delete rejects after a target switch', async () => {
    const view = await hydrateLoadedRecord(true);
    const mountsAfterLoad = harness.counts.screenMounts;
    await startDelete();

    applyTarget('B');
    view.rerender(screenTree(true));
    await drain();
    await act(async () => {
      harness.gates.delete?.reject(new Error('delete failed'));
    });
    await drain();

    expect(screen.queryByText('記録を取り消しました')).toBeNull();
    expect(screen.queryByText('記録の取り消しに失敗しました。再度お試しください。')).toBeNull();
    expectNoNavigationTimer();
    expect(harness.counts.screenMounts).toBe(mountsAfterLoad);
  });

  async function rehydrateReturnedTarget() {
    for (let i = 0; i < 8 && (memoValue() !== '元の観察' || pendingFor('U001').length > 0); i += 1) {
      const settled = await settleOldest('U001', { kind: 'unique', internalId: 11, record: existingRecord() });
      if (!settled) break;
    }
    expect(memoValue()).toBe('元の観察');
    expect(revertState().present).toBe(true);
    expect(screen.getByText('合成利用者A 様')).toBeInTheDocument();
  }

  async function returnToOriginalTargetDuringDelete(
    view: { rerender: (node: ReactNode) => void },
  ) {
    const mountsAfterLoad = harness.counts.screenMounts;
    await startDelete();

    applyTarget('B');
    view.rerender(screenTree(true));
    await drain();
    applyTarget('A');
    view.rerender(screenTree(true));
    await drain();

    expect(harness.counts.screenMounts).toBe(mountsAfterLoad);
    await rehydrateReturnedTarget();

    expect(harness.repository.deleteRecord.mock.calls).toEqual([[DATE, 'U001', 'procedure-1']]);
    expect(screen.queryByText('記録を取り消しました')).toBeNull();
    expect(screen.queryByText('記録の取り消しに失敗しました。再度お試しください。')).toBeNull();
    expect(screen.queryByText('実施記録の読み込みに失敗しました')).toBeNull();
    expectNoNavigationTimer();
    return {
      mountsAfterLoad,
      deleteCalls: harness.repository.deleteRecord.mock.calls.length,
      upsertCalls: harness.upsertRecord.mock.calls.length,
    };
  }

  async function expectOldDeleteIgnored(
    settlement: 'resolve' | 'reject',
    snapshot: {
      mountsAfterLoad: number;
      deleteCalls: number;
      upsertCalls: number;
    },
  ) {
    await act(async () => {
      if (settlement === 'resolve') harness.gates.delete?.resolve();
      else harness.gates.delete?.reject(new Error('delete failed'));
    });
    await drain();

    expect(screen.queryByText('記録を取り消しました')).toBeNull();
    expect(screen.queryByText('記録の取り消しに失敗しました。再度お試しください。')).toBeNull();
    expect(screen.queryByText('実施記録の読み込みに失敗しました')).toBeNull();
    expectNoNavigationTimer();
    expect(memoValue()).toBe('元の観察');
    expect(revertState()).toEqual({ present: true, disabled: false });
    expect(screen.getByText('合成利用者A 様')).toBeInTheDocument();
    expect(harness.repository.deleteRecord.mock.calls).toEqual([[DATE, 'U001', 'procedure-1']]);
    expect(harness.repository.deleteRecord.mock.calls.length).toBe(snapshot.deleteCalls);
    expect(harness.upsertRecord.mock.calls.length).toBe(snapshot.upsertCalls);
    expect(harness.counts.screenMounts).toBe(snapshot.mountsAfterLoad);
  }

  it('does not accept an in-flight delete resolve after A→B→A', async () => {
    const view = await hydrateLoadedRecord(true);
    const snapshot = await returnToOriginalTargetDuringDelete(view);
    await expectOldDeleteIgnored('resolve', snapshot);
  });

  it('does not accept an in-flight delete reject after A→B→A', async () => {
    const view = await hydrateLoadedRecord(true);
    const snapshot = await returnToOriginalTargetDuringDelete(view);
    await expectOldDeleteIgnored('reject', snapshot);
  });

  it('treats an unclassified local save as success and navigates once', async () => {
    const view = await hydrateLoadedRecord(true);
    const classify = harness.repository.classifyExecutionCandidates;
    try {
      Reflect.deleteProperty(harness.repository, 'classifyExecutionCandidates');
      view.rerender(screenTree(true));
      await drain();
      editObservation();
      await startSave();
      await resolveUpsertOnly();

      expect(screen.queryByTestId('kiosk-conflict-alert')).toBeNull();
      expect(screen.queryByTestId('kiosk-record-missing-conflict-alert')).toBeNull();
      expect(screen.getByText('記録を保存しました')).toBeInTheDocument();
      expect(submitDisabled()).toBe(true);
      expect(memoValue()).toBe(DRAFT_MEMO);
      await releaseHeldNavigation();
    } finally {
      harness.repository.classifyExecutionCandidates = classify;
    }
  });

  it('keeps an edit made during an unclassified local save and updates the same record', async () => {
    const view = await hydrateLoadedRecord(true);
    const classify = harness.repository.classifyExecutionCandidates;
    try {
      Reflect.deleteProperty(harness.repository, 'classifyExecutionCandidates');
      view.rerender(screenTree(true));
      await drain();
      editObservation();
      await startSave();
      expect(screen.getByTestId('kiosk-observation-memo')).toBeDisabled();
      editObservation(LATER_MEMO);
      await resolveUpsertOnly();

      expect(screen.queryByText('記録を保存しました')).toBeNull();
      expect(screen.getByText(PENDING_EDIT_NOTICE)).toBeInTheDocument();
      expect(submitDisabled()).toBe(false);
      expect(memoValue()).toBe(LATER_MEMO);
      expectNoNavigationTimer();

      await act(async () => {
        fireEvent.click(screen.getByTestId('kiosk-observation-submit'));
      });
      await drain();
      expectSameRecordUpdate([SAVED_DRAFT_MEMO, SAVED_LATER_MEMO]);
      expectNoNavigationTimer();
    } finally {
      harness.repository.classifyExecutionCandidates = classify;
    }
  });

  it('does not let a fetch that started before the save ended release the hold', async () => {
    const seen: UpsertGate[] = [];
    const originalImpl = harness.upsertRecord.getMockImplementation();
    harness.upsertRecord.mockImplementation((record, options) => {
      const pending = originalImpl?.(record, options) ?? Promise.resolve();
      const upsertGate = harness.gates.upsert;
      if (upsertGate) seen.push(upsertGate);
      return pending;
    });
    const failure = '記録の保存に失敗しました。再度お試しください。';
    try {
      await hydrateLoadedRecord(true);
      editObservation();
      expect(submitDisabled()).toBe(false);

      const submit = screen.getByTestId('kiosk-observation-submit');
      await act(async () => {
        submit.click();
        submit.click();
      });
      await drain();
      expect(harness.upsertRecord.mock.calls.length).toBe(2);
      expect(seen).toHaveLength(2);
      const olderGate = seen[0];
      const laterGate = seen[1];

      const classifiesBeforeOlderEnd = harness.classifyCalls.length;
      await act(async () => {
        olderGate?.reject(new Error('older save failed'));
      });
      await drain();

      expect(screen.getByText(failure)).toBeInTheDocument();
      expect(submitDisabled()).toBe(true);
      const startedBeforeLaterEnd = harness.classifyCalls[classifiesBeforeOlderEnd];
      expect(startedBeforeLaterEnd).toBeDefined();
      expect(startedBeforeLaterEnd?.settled).toBe(false);

      const classifiesBeforeLaterEnd = harness.classifyCalls.length;
      await act(async () => {
        laterGate?.reject(new Error('later save failed'));
      });
      await drain();

      const startedAfterLaterEnd = harness.classifyCalls[classifiesBeforeLaterEnd];
      expect(startedAfterLaterEnd).toBeDefined();
      expect(startedAfterLaterEnd?.settled).toBe(false);

      // Settle the fetch that started before the later save ended
      await act(async () => {
        startedBeforeLaterEnd?.resolve({ kind: 'unique', internalId: 11, record: existingRecord() });
      });
      await drain();

      expect(startedBeforeLaterEnd?.settled).toBe(true);
      expect(submitDisabled()).toBe(true);
      expect(revertState()).toEqual({ present: true, disabled: true });
      expect(screen.getByText(failure)).toBeInTheDocument();
      expectNoNavigationTimer();

      // Settle the fetch that started after the later save ended
      await act(async () => {
        startedAfterLaterEnd?.resolve({ kind: 'unique', internalId: 11, record: existingRecord() });
      });
      await drain();

      expect(startedAfterLaterEnd?.settled).toBe(true);
      expect(submitDisabled()).toBe(false);
      expect(revertState()).toEqual({ present: true, disabled: false });
      await waitFor(() => {
        expect(screen.queryByText(failure)).toBeNull();
      });
      expect(harness.upsertRecord.mock.calls.length).toBe(2);
      expect(harness.repository.deleteRecord.mock.calls).toEqual([]);
      expectNoNavigationTimer();
    } finally {
      if (originalImpl) harness.upsertRecord.mockImplementation(originalImpl);
    }
  });

  it('does not release the later hold for a fetch that started after the older save and settled after the later save', async () => {
    const seen: UpsertGate[] = [];
    const originalImpl = harness.upsertRecord.getMockImplementation();
    harness.upsertRecord.mockImplementation((record, options) => {
      const pending = originalImpl?.(record, options) ?? Promise.resolve();
      const upsertGate = harness.gates.upsert;
      if (upsertGate) seen.push(upsertGate);
      return pending;
    });
    const failure = '記録の保存に失敗しました。再度お試しください。';
    try {
      await hydrateLoadedRecord(true);
      editObservation();
      expect(submitDisabled()).toBe(false);
      const submit = screen.getByTestId('kiosk-observation-submit');
      await act(async () => {
        submit.click();
        submit.click();
      });
      await drain();
      expect(harness.upsertRecord.mock.calls.length).toBe(2);
      expect(seen).toHaveLength(2);
      const olderGate = seen[0];
      const laterGate = seen[1];
      expect(olderGate).toBeDefined();
      expect(laterGate).toBeDefined();
      expect(laterGate).not.toBe(olderGate);

      const classifiesBeforeOlderEnd = harness.classifyCalls.length;
      await act(async () => {
        olderGate?.reject(new Error('older save failed'));
      });
      await drain();
      expect(screen.getByText(failure)).toBeInTheDocument();
      expect(submitDisabled()).toBe(true);

      const earlyFetch = harness.classifyCalls[classifiesBeforeOlderEnd];
      expect(earlyFetch).toBeDefined();
      expect(earlyFetch?.settled).toBe(false);

      const classifiesBeforeLaterEnd = harness.classifyCalls.length;
      await act(async () => {
        laterGate?.reject(new Error('later save failed'));
      });
      await drain();
      expect(screen.getByText(failure)).toBeInTheDocument();
      expect(earlyFetch?.settled).toBe(false);

      const lateFetch = harness.classifyCalls[classifiesBeforeLaterEnd];
      expect(lateFetch).toBeDefined();
      expect(lateFetch?.settled).toBe(false);

      // Settle early fetch (started before later save ended)
      await act(async () => {
        earlyFetch?.resolve({ kind: 'unique', internalId: 11, record: existingRecord() });
      });
      await drain();
      expect(earlyFetch?.settled).toBe(true);
      await new Promise((resolve) => realSetTimeout(resolve, 500));
      expect(screen.getByText(failure)).toBeInTheDocument();
      expect(submitDisabled()).toBe(true);
      expectNoNavigationTimer();

      // Settle late fetch (started after later save ended)
      await act(async () => {
        lateFetch?.resolve({ kind: 'unique', internalId: 11, record: existingRecord() });
      });
      await drain();
      expect(lateFetch?.settled).toBe(true);
      expect(submitDisabled()).toBe(false);
      await waitFor(() => {
        expect(screen.queryByText(failure)).toBeNull();
      });
      expectNoNavigationTimer();
    } finally {
      if (originalImpl) harness.upsertRecord.mockImplementation(originalImpl);
    }
  });
});

describe('KioskProcedureDetailScreen late stale classify', () => {
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
    harness.counts.classifySeq = 0;
    harness.counts.timerSeq = 0;
    harness.gates.upsert = null;
    harness.gates.delete = null;
    harness.heldTimers.length = 0;
    applyTarget('A');
  });

  afterEach(() => {
    cleanup();
    restoreTimers?.();
    vi.mocked(globalThis.fetch).mockRestore();
  });

  async function holdAWithStaleClassifyInFlight() {
    const view = await hydrateLoadedRecord(false);
    editObservation();
    await startSave();

    applyTarget('B');
    view.rerender(screenTree(false));
    await drain();
    expectNoNavigationTimer();
    applyTarget('A');
    view.rerender(screenTree(false));
    await drain();
    expectNoNavigationTimer();
    const staleA = pendingFor('U001').at(-1);
    expect(staleA, 'in-flight A classify before the hold').toBeDefined();

    applyTarget('B');
    view.rerender(screenTree(false));
    await drain();
    expectNoNavigationTimer();
    await act(async () => {
      harness.gates.upsert?.reject(new Error('save failed'));
    });
    await drain();
    expectNoNavigationTimer();
    for (let i = 0; i < 4 && pendingFor('U002').length > 0; i += 1) {
      const call = pendingFor('U002')[0];
      if (call === staleA) break;
      await settleOldest('U002', { kind: 'absent' });
    }

    applyTarget('A');
    view.rerender(screenTree(false));
    await drain();
    const recheck = pendingFor('U001').filter((call) => call !== staleA).at(-1);
    expect(recheck, 'post-hold recheck').toBeDefined();
    expect(staleA && staleA.seq < (recheck?.seq ?? 0)).toBe(true);
    expect(submitDisabled()).toBe(true);
    expectNoNavigationTimer();
    return { view, staleA: staleA as PendingClassify, recheck: recheck as PendingClassify };
  }

  it('a stale classify that arrives before the new recheck does not release the hold', async () => {
    const { staleA, recheck } = await holdAWithStaleClassifyInFlight();
    await act(async () => {
      staleA.resolve({ kind: 'unique', internalId: 99, record: confirmedRecord() });
    });
    await drain();

    expect(staleA.settled).toBe(true);
    expect(recheck.settled).toBe(false);
    expect(submitDisabled()).toBe(true);
    expect(screen.queryAllByText('照合で確認した記録')).toHaveLength(0);
    expectNoNavigationTimer();

    await act(async () => {
      recheck.resolve({ kind: 'absent' });
    });
    await drain();
    expect(submitDisabled()).toBe(false);
    expect(revertState().present).toBe(false);
    expectNoNavigationTimer();
  });

  it('a stale classify that arrives after the new recheck does not replace it', async () => {
    const { staleA, recheck } = await holdAWithStaleClassifyInFlight();
    await act(async () => {
      recheck.resolve({ kind: 'unique', internalId: 21, record: confirmedRecord() });
    });
    await drain();
    expect(submitDisabled()).toBe(false);
    expect(screen.queryAllByText('照合で確認した記録').length).toBeGreaterThan(0);
    expectNoNavigationTimer();

    await act(async () => {
      staleA.resolve({ kind: 'absent' });
    });
    await drain();
    expect(submitDisabled()).toBe(false);
    expect(screen.queryAllByText('照合で確認した記録').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('kiosk-conflict-alert')).toBeNull();
    expect(harness.repository.deleteRecord.mock.calls.length).toBe(0);
    expectNoNavigationTimer();
  });
});
