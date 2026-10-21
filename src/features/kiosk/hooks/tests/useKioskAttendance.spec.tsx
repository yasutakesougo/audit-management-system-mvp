import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttendanceRepository } from '@/features/attendance/domain/AttendanceRepository';
import type { AttendanceDailyItem } from '@/features/attendance/infra/Legacy/attendanceDailyRepository';
import { isAbsentStatus, normalizeAttendanceStatus, useKioskAttendance, type KioskAbsenceState } from '../useKioskAttendance';

const boundary = vi.hoisted(() => ({ repository: undefined as AttendanceRepository | undefined }));
vi.mock('@/features/attendance/repositoryFactory', () => ({
  useAttendanceRepository: () => boundary.repository,
}));

type Props = { user?: string; date: string; candidates: string[]; refresh?: number };
const BASE: Props = { user: 'TEST-A', date: '2026-10-21', candidates: ['TEST-A'], refresh: 0 };
const U: KioskAbsenceState = { isAbsent: false, reason: undefined, isLoading: false, isError: false };
const L: KioskAbsenceState = { ...U, isLoading: true };
const F: KioskAbsenceState = { ...U, isError: true };
const ABSENT: KioskAbsenceState = { ...U, isAbsent: true, reason: 'reason-A - support-A' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const row = (overrides: Partial<AttendanceDailyItem> = {}): AttendanceDailyItem => ({
  Key: 'synthetic-A', UserCode: 'TEST-A', RecordDate: BASE.date, Status: '欠席',
  AbsentReason: 'reason-A', AbsentSupportContent: 'support-A', EveningNote: 'evening-A',
  ...overrides,
});
function repository() {
  const getDailyByDate = vi.fn<AttendanceRepository['getDailyByDate']>();
  const unexpected = () => { throw new Error('Unexpected repository operation'); };
  const value: AttendanceRepository = {
    getDailyByDate, getActiveUsers: unexpected, upsertDailyByKey: unexpected, getObservationsByDate: unexpected,
  };
  return { value, getDailyByDate };
}
function mount(initialProps: Props = BASE, strict = false) {
  const samples: Array<{ user?: string; date: string; state: KioskAbsenceState; reads: number }> = [];
  const hook = renderHook((props: Props) => {
    const state = useKioskAttendance(props.user, props.date, props.candidates, props.refresh);
    samples.push({ user: props.user, date: props.date, state: { ...state }, reads: repo.getDailyByDate.mock.calls.length });
    // A guard fails the test rather than allowing the original loop to hang the runner.
    if (samples.length > 150) throw new Error('Attendance render convergence exceeded');
    return state;
  }, { initialProps, wrapper: strict ? StrictMode : undefined });
  return { ...hook, samples };
}
async function complete(request: ReturnType<typeof deferred<AttendanceDailyItem[]>>, rows: AttendanceDailyItem[]) {
  await act(async () => { request.resolve(rows); await request.promise; });
}
async function fail(request: ReturnType<typeof deferred<AttendanceDailyItem[]>>) {
  await act(async () => { request.reject(new Error('synthetic attendance failure')); await request.promise.catch(() => undefined); });
}

let repo: ReturnType<typeof repository>;
beforeEach(() => {
  repo = repository();
  boundary.repository = repo.value;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  const unexpected = vi.mocked(console.error).mock.calls.filter(
    ([message]) => message !== '[useKioskAttendance] Failed to fetch daily attendance:',
  );
  expect(unexpected).toEqual([]);
  expect(globalThis.fetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe('real useKioskAttendance / locked Scope A', () => {
  it('[G01] converges for unresolved user and newly allocated empty arrays without reads', () => {
    const hook = mount({ ...BASE, user: undefined, candidates: [] });
    for (let i = 0; i < 20; i += 1) hook.rerender({ ...BASE, user: undefined, candidates: [] });
    expect(hook.result.current).toEqual(U);
    expect(hook.samples.every((sample) => JSON.stringify(sample.state) === JSON.stringify(U))).toBe(true);
    expect(hook.samples).toHaveLength(21);
    expect(repo.getDailyByDate).not.toHaveBeenCalled();
  });

  it.each([
    ['missing user', { ...BASE, user: undefined }],
    ['missing date', { ...BASE, date: '' }],
    ['missing candidates', { ...BASE, candidates: [] }],
    ['blank candidates', { ...BASE, candidates: [' ', ''] }],
  ])('[G02] remains unresolved with %s', (_name, props) => {
    const hook = mount(props);
    for (let i = 0; i < 10; i += 1) hook.rerender({ ...props, candidates: [...props.candidates] });
    expect(hook.result.current).toEqual(U);
    expect(hook.samples).toHaveLength(11);
    expect(repo.getDailyByDate).not.toHaveBeenCalled();
  });

  it.each(['欠席', '当日欠席', 'ABSENT'])('[G03] resolves an absence status %s and preserves reason composition', async (status) => {
    const request = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValue(request.promise);
    const hook = mount();
    expect(hook.samples[0].state).toEqual(L);
    expect(hook.result.current).toEqual(L);
    await complete(request, [row({ UserCode: ' test-a ', Status: status })]);
    expect(hook.result.current).toEqual(ABSENT);
    expect(repo.getDailyByDate).toHaveBeenCalledExactlyOnceWith({ recordDate: BASE.date });
  });

  it('[G04] resolves a non-absent record without a reason', async () => {
    const request = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValue(request.promise);
    const hook = mount();
    expect(hook.samples[0].state).toEqual(L);
    await complete(request, [row({ Status: '出席', AbsentReason: '', AbsentSupportContent: '', EveningNote: '' })]);
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['support wins', { AbsentSupportContent: 'support-A', EveningNote: 'evening-A' }, 'reason-A - support-A'],
    ['evening fallback', { AbsentSupportContent: '', EveningNote: 'evening-A' }, 'reason-A - evening-A'],
  ])('[G04 P2-001] non-absent reason is retained: %s', async (_name, fields, expectedReason) => {
    const request = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValue(request.promise);
    const hook = mount();
    expect(hook.samples[0].state).toEqual(L);
    await complete(request, [row({ Status: '出席', ...fields })]);
    expect(hook.result.current).toEqual({ ...U, reason: expectedReason });
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(1);
  });

  it('[G04 P2-001] preserves exported status normalization and absence predicates', () => {
    expect(normalizeAttendanceStatus({ Value: ' 当日欠席 ' })).toBe('当日欠席');
    expect(normalizeAttendanceStatus(' 出席 ')).toBe('出席');
    expect(isAbsentStatus('出席')).toBe(false);
    expect(isAbsentStatus('absent')).toBe(true);
    expect(isAbsentStatus('欠席')).toBe(true);
    expect(isAbsentStatus('当日欠席')).toBe(true);
    expect(repo.getDailyByDate).not.toHaveBeenCalled();
  });

  it.each([{ rows: [] }, { rows: [row({ UserCode: 'TEST-B' })] }])('[G05] resolves a successful lookup with no matching record', async ({ rows }) => {
    const request = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValue(request.promise);
    const hook = mount();
    expect(hook.samples[0].state).toEqual(L);
    await complete(request, rows);
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(1);
  });

  it('[G06] reports failure instead of successful non-absence', async () => {
    const request = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValue(request.promise);
    const hook = mount();
    expect(hook.result.current).toEqual(L);
    await fail(request);
    expect(hook.result.current).toEqual(F);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(1);
  });

  it.each(['success', 'failure'] as const)('[G07] masks old %s from the first B render, before its effect starts', async (outcome) => {
    const a = deferred<AttendanceDailyItem[]>(), b = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const hook = mount();
    if (outcome === 'success') await complete(a, [row()]); else await fail(a);
    const start = hook.samples.length;
    hook.rerender({ ...BASE, user: 'TEST-B', candidates: ['TEST-B'] });
    expect(hook.samples[start]).toMatchObject({ user: 'TEST-B', state: L });
    expect(hook.samples[start].reads).toBe(1);
    expect(hook.samples.slice(start).every((sample) => !sample.state.reason && !sample.state.isAbsent && !sample.state.isError)).toBe(true);
    expect(hook.result.current).toEqual(L);
    await complete(b, []);
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(2);
  });

  it('[G02 G08] clears a successful generation when becoming unresolved and does not restore it on return', async () => {
    const a = deferred<AttendanceDailyItem[]>(), again = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValueOnce(a.promise).mockReturnValueOnce(again.promise);
    const hook = mount();
    await complete(a, [row()]);
    let start = hook.samples.length;
    hook.rerender({ ...BASE, user: undefined, candidates: [] });
    expect(hook.samples[start].state).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(1);
    start = hook.samples.length;
    hook.rerender(BASE);
    expect(hook.samples[start].state).toEqual(L);
    await complete(again, []);
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(2);
  });

  it.each(['old success', 'old failure'] as const)('[G08] rejects %s from A1 and B after A2 has completed', async (outcome) => {
    const a1 = deferred<AttendanceDailyItem[]>(), b = deferred<AttendanceDailyItem[]>(), a2 = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValueOnce(a1.promise).mockReturnValueOnce(b.promise).mockReturnValueOnce(a2.promise);
    const hook = mount();
    hook.rerender({ ...BASE, user: 'TEST-B', candidates: ['TEST-B'] });
    const start = hook.samples.length;
    hook.rerender(BASE);
    expect(hook.samples[start].state).toEqual(L);
    await complete(a2, []);
    if (outcome === 'old success') {
      await complete(a1, [row()]);
      await fail(b);
    } else {
      await fail(a1);
      await complete(b, [row({ UserCode: 'TEST-B' })]);
    }
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(3);
  });

  it('[G08] does not restore already-resolved A when returning through B', async () => {
    const a1 = deferred<AttendanceDailyItem[]>(), b = deferred<AttendanceDailyItem[]>(), a2 = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValueOnce(a1.promise).mockReturnValueOnce(b.promise).mockReturnValueOnce(a2.promise);
    const hook = mount();
    await complete(a1, [row()]);
    hook.rerender({ ...BASE, user: 'TEST-B', candidates: ['TEST-B'] });
    const start = hook.samples.length;
    hook.rerender(BASE);
    expect(hook.samples[start].state).toEqual(L);
    await fail(b);
    expect(hook.result.current).toEqual(L);
    await complete(a2, []);
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(3);
  });

  it('[G07] treats a user-only change as a new target even with unchanged candidates', async () => {
    const a = deferred<AttendanceDailyItem[]>(), b = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const hook = mount();
    await complete(a, [row()]);
    const start = hook.samples.length;
    hook.rerender({ ...BASE, user: 'TEST-B' });
    expect(hook.samples[start].state).toEqual(L);
    expect(hook.samples[start].reads).toBe(1);
    await complete(b, []);
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['date', { ...BASE, date: '2026-10-22' }],
    ['candidates', { ...BASE, candidates: ['TEST-C'] }],
  ])('[G09] masks and refetches on %s change', async (_name, next) => {
    const old = deferred<AttendanceDailyItem[]>(), current = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const hook = mount();
    await complete(old, [row()]);
    const start = hook.samples.length;
    hook.rerender(next);
    expect(hook.samples[start].state).toEqual(L);
    await complete(current, []);
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenLastCalledWith({ recordDate: next.date });
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(2);
  });

  it('[G09] does not collide candidate keys containing separators', async () => {
    const first = deferred<AttendanceDailyItem[]>(), second = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const hook = mount({ ...BASE, candidates: ['A,B', 'C'] });
    await complete(first, [row({ UserCode: 'A,B' })]);
    const start = hook.samples.length;
    hook.rerender({ ...BASE, candidates: ['A', 'B,C'] });
    expect(hook.samples[start].state).toEqual(L);
    await complete(second, []);
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['date', { ...BASE, date: '2026-10-22', refresh: 1 }],
    ['candidates', { ...BASE, candidates: ['TEST-C'], refresh: 1 }],
  ])('[G09] ignores an old delayed failure while the new %s target is pending', async (_name, next) => {
    const first = deferred<AttendanceDailyItem[]>(), old = deferred<AttendanceDailyItem[]>(), current = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValueOnce(first.promise).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const hook = mount();
    await complete(first, [row()]);
    hook.rerender({ ...BASE, refresh: 1 });
    const start = hook.samples.length;
    hook.rerender(next);
    expect(hook.samples[start].state).toEqual(L);
    await fail(old);
    expect(hook.result.current).toEqual(L);
    await complete(current, []);
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(3);
  });

  it('[G10] masks state on repository replacement and ignores the old repository refresh', async () => {
    const first = deferred<AttendanceDailyItem[]>(), oldRefresh = deferred<AttendanceDailyItem[]>(), current = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValueOnce(first.promise).mockReturnValueOnce(oldRefresh.promise);
    const hook = mount();
    await complete(first, [row()]);
    hook.rerender({ ...BASE, refresh: 1 });
    const nextRepo = repository();
    nextRepo.getDailyByDate.mockReturnValue(current.promise);
    boundary.repository = nextRepo.value;
    const start = hook.samples.length;
    hook.rerender({ ...BASE, refresh: 1 });
    expect(hook.samples[start].state).toEqual(L);
    await complete(current, []);
    await complete(oldRefresh, [row()]);
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(2);
    expect(nextRepo.getDailyByDate).toHaveBeenCalledTimes(1);
  });

  it('[G11] keeps only same-generation success during refresh and after a failed refresh', async () => {
    const first = deferred<AttendanceDailyItem[]>(), refresh = deferred<AttendanceDailyItem[]>(), retry = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValueOnce(first.promise).mockReturnValueOnce(refresh.promise).mockReturnValueOnce(retry.promise);
    const hook = mount();
    await complete(first, [row()]);
    let start = hook.samples.length;
    hook.rerender({ ...BASE, refresh: 1 });
    expect(hook.samples[start].state).toEqual({ ...ABSENT, isLoading: true });
    await fail(refresh);
    expect(hook.result.current).toEqual(F);
    start = hook.samples.length;
    hook.rerender({ ...BASE, refresh: 2 });
    expect(hook.samples[start].state).toEqual({ ...ABSENT, isLoading: true });
    await complete(retry, []);
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(3);
  });

  it.each(['success', 'failure'] as const)('[G11] ignores an older refresh %s after the newest completes', async (outcome) => {
    const initial = deferred<AttendanceDailyItem[]>(), older = deferred<AttendanceDailyItem[]>(), latest = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValueOnce(initial.promise).mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    const hook = mount();
    await complete(initial, [row()]);
    hook.rerender({ ...BASE, refresh: 1 });
    hook.rerender({ ...BASE, refresh: 2 });
    expect(hook.result.current).toEqual({ ...ABSENT, isLoading: true });
    await complete(latest, []);
    if (outcome === 'success') await complete(older, [row()]); else await fail(older);
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(3);
  });

  it('[G11] exposes loading without a prior success and suppresses the initial request on refresh', async () => {
    const first = deferred<AttendanceDailyItem[]>(), refreshed = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValueOnce(first.promise).mockReturnValueOnce(refreshed.promise);
    const hook = mount();
    hook.rerender({ ...BASE, refresh: 1 });
    expect(hook.result.current).toEqual(L);
    await complete(first, [row()]);
    expect(hook.result.current).toEqual(L);
    await complete(refreshed, []);
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(2);
  });

  it('[G12] treats reordered, duplicate and freshly allocated normalized candidates as the same target', async () => {
    const request = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValue(request.promise);
    const hook = mount({ ...BASE, candidates: [' test-a ', 'ALIAS-A'] });
    hook.rerender({ ...BASE, candidates: ['alias-a', 'TEST-A', 'test-a', ' '] });
    expect(hook.result.current).toEqual(L);
    await complete(request, [row()]);
    for (let i = 0; i < 20; i += 1) hook.rerender({ ...BASE, candidates: [' TEST-A ', 'alias-a'] });
    expect(hook.result.current).toEqual(ABSENT);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(1);
  });

  it.each(['success', 'failure'] as const)('[G13] makes no further renders after unmount then delayed %s', async (outcome) => {
    const request = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValue(request.promise);
    const hook = mount();
    hook.unmount();
    const count = hook.samples.length;
    if (outcome === 'success') await complete(request, [row()]); else await fail(request);
    expect(hook.samples).toHaveLength(count);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(1);
  });

  it('[StrictMode] converges unresolved without reads', () => {
    const hook = mount({ ...BASE, user: undefined, candidates: [] }, true);
    expect(hook.result.current).toEqual(U);
    expect(hook.samples.length).toBeLessThan(10);
    expect(repo.getDailyByDate).not.toHaveBeenCalled();
  });

  it('[StrictMode] only applies the active setup response', async () => {
    const discarded = deferred<AttendanceDailyItem[]>(), current = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValueOnce(discarded.promise).mockReturnValueOnce(current.promise);
    const hook = mount(BASE, true);
    expect(hook.result.current).toEqual(L);
    await complete(current, []);
    await complete(discarded, [row()]);
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(2);
  });

  it('[StrictMode G08] masks A on B and on returning to a new A generation', async () => {
    const discarded = deferred<AttendanceDailyItem[]>(), a1 = deferred<AttendanceDailyItem[]>(), b = deferred<AttendanceDailyItem[]>(), a2 = deferred<AttendanceDailyItem[]>();
    repo.getDailyByDate.mockReturnValueOnce(discarded.promise).mockReturnValueOnce(a1.promise)
      .mockReturnValueOnce(b.promise).mockReturnValueOnce(a2.promise);
    const hook = mount(BASE, true);
    await complete(a1, [row()]);
    let start = hook.samples.length;
    hook.rerender({ ...BASE, user: 'TEST-B', candidates: ['TEST-B'] });
    expect(hook.samples[start].state).toEqual(L);
    start = hook.samples.length;
    hook.rerender(BASE);
    expect(hook.samples[start].state).toEqual(L);
    await fail(b);
    await complete(discarded, [row()]);
    expect(hook.result.current).toEqual(L);
    await complete(a2, []);
    expect(hook.result.current).toEqual(U);
    expect(repo.getDailyByDate).toHaveBeenCalledTimes(4);
  });
});

