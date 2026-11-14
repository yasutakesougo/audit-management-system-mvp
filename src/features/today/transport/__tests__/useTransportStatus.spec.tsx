import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransportLogEntry } from '../transportStatusLogic';
import { syncToAttendanceDaily } from '../transportRepo';
import { useTransportStatus } from '../useTransportStatus';

const harness = vi.hoisted(() => ({
  users: [{ UserID: 'U002', FullName: '鈴木 美子', IsActive: true }] as Array<Record<string, unknown>>,
  schedules: [] as Array<Record<string, unknown>>,
  logs: [] as TransportLogEntry[],
  visits: {} as Record<string, never>,
  staffRows: [] as unknown[],
  sp: { listItems: vi.fn() },
  save: vi.fn(),
  show: vi.fn(),
  ranges: [] as Array<{ from: string; to: string }>,
  loadDates: [] as string[],
  scheduleMode: 'settle' as 'settle' | 'hold' | 'error',
  scheduleNonce: 0,
  emptySchedules: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/features/today/domain', () => ({
  useTodaySummary: () => ({
    users: harness.users,
    visits: harness.visits,
  }),
}));

vi.mock('@/features/schedules/hooks/legacy/useSchedules', async () => {
  const React = await import('react');
  return {
    useSchedules: (range: { from: string; to: string }) => {
      const key = `${range.from}|${range.to}`;
      const [phase, setPhase] = React.useState({ key: '', loading: true, error: null as string | null });
      const nonce = harness.scheduleNonce;
      React.useEffect(() => {
        let alive = true;
        setPhase({ key, loading: true, error: null });
        harness.ranges.push(range);
        if (harness.scheduleMode === 'hold') return () => { alive = false; };
        void Promise.resolve().then(() => {
          if (!alive) return;
          setPhase({
            key,
            loading: false,
            error: harness.scheduleMode === 'error' ? 'schedule-failed' : null,
          });
        });
        return () => { alive = false; };
      }, [key, nonce]);
      const current = phase.key === key ? phase : { key, loading: true, error: null as string | null };
      return {
        items: current.loading || current.error ? harness.emptySchedules : harness.schedules,
        loading: current.loading,
        lastError: current.error ? { message: current.error } : null,
      };
    },
  };
});

vi.mock('@/features/staff/store', () => ({
  useStaffStore: () => ({ data: harness.staffRows }),
}));

vi.mock('@/lib/spClient', () => ({
  useSP: () => harness.sp,
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: harness.show }),
}));

vi.mock('@/features/attendance/infra/Legacy/attendanceUsersRepository', () => ({
  getActiveUsers: vi.fn().mockResolvedValue([]),
}));

vi.mock('../transportTelemetry', () => ({
  trackTransportEvent: vi.fn(),
  getTransportStaleDedupKey: vi.fn(() => 'dedup'),
}));

vi.mock('../transportRepo', () => ({
  loadTransportLogs: vi.fn(async (_client: unknown, dateKey: string) => {
    harness.loadDates.push(dateKey);
    return harness.logs;
  }),
  saveTransportLog: (...args: unknown[]) => harness.save(...args),
  syncToAttendanceDaily: vi.fn().mockResolvedValue(undefined),
}));

async function resetTransportLogLoader() {
  const { loadTransportLogs } = await import('../transportRepo');
  vi.mocked(loadTransportLogs).mockImplementation(async (_client: unknown, dateKey: string) => {
    harness.loadDates.push(dateKey);
    return harness.logs;
  });
}

function scheduleRow(userId: string, start: string) {
  return {
    userId,
    userName: userId === 'U002' ? '鈴木 美子' : '田中 太郎',
    title: '送迎（往路）',
    serviceType: 'transport',
    start,
    vehicleId: '車両1',
    assignedStaffId: 'STF001',
  };
}

async function flushEffects() {
  for (let step = 0; step < 6; step += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function legFor(result: { current: ReturnType<typeof useTransportStatus> }, userId: string) {
  return result.current.status.legs.find((leg) => leg.userId === userId && leg.direction === 'to');
}

describe('useTransportStatus schedule legs', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T08:00:00+09:00'));
    await resetTransportLogLoader();
    harness.users = [{ UserID: 'U002', FullName: '鈴木 美子', IsActive: true }];
    harness.schedules = [scheduleRow('U002', '2026-11-11T08:00:00+09:00')];
    harness.logs = [];
    harness.ranges = [];
    harness.loadDates = [];
    harness.save.mockReset();
    harness.save.mockResolvedValue(undefined);
    harness.show.mockReset();
    harness.scheduleMode = 'settle';
    harness.scheduleNonce = 0;
    vi.mocked(syncToAttendanceDaily).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets a schedule-only rider depart, arrive, and be saved to Transport_Log', async () => {
    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();

    expect(legFor(result, 'U002')?.status).toBe('pending');

    act(() => {
      result.current.markInProgress('U002', 'to');
    });
    expect(legFor(result, 'U002')?.status).toBe('in-progress');
    expect(harness.save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userCode: 'U002',
      recordDate: '2026-11-11',
      direction: 'to',
      status: 'in-progress',
    }));

    act(() => {
      result.current.markArrived('U002', 'to');
    });
    expect(legFor(result, 'U002')?.status).toBe('arrived');
    expect(legFor(result, 'U002')?.actualTime).toBeTruthy();
    await flushEffects();
    expect(harness.save).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
      userCode: 'U002',
      status: 'arrived',
      recordDate: '2026-11-11',
    }));
  });

  it('marks a schedule-only rider absent', async () => {
    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();

    act(() => {
      result.current.markAbsent('U002', 'to');
    });

    expect(legFor(result, 'U002')?.status).toBe('absent');
    expect(harness.save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'absent',
      userCode: 'U002',
    }));
  });

  it('rolls the displayed status back when Transport_Log save fails', async () => {
    harness.save.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();

    act(() => {
      result.current.markInProgress('U002', 'to');
    });
    expect(legFor(result, 'U002')?.status).toBe('in-progress');

    await flushEffects();
    expect(legFor(result, 'U002')?.status).toBe('pending');
  });

  it('restores an existing Transport_Log status and actual time', async () => {
    harness.logs = [{
      userId: 'U002',
      direction: 'to',
      status: 'in-progress',
      actualTime: '08:40',
      recordDate: '2026-11-11',
    }];
    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();

    expect(legFor(result, 'U002')).toMatchObject({
      status: 'in-progress',
      actualTime: '08:40',
      userName: '鈴木 美子',
    });
  });

  it('keeps one leg when the rider also has a transport master profile', async () => {
    harness.users = [{
      UserID: 'U002',
      FullName: '鈴木 美子',
      IsActive: true,
      TransportCourse: 'isogo',
    }];
    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();

    const matches = result.current.status.legs.filter((leg) => leg.userId === 'U002' && leg.direction === 'to');
    expect(matches).toHaveLength(1);
  });

  it('keeps the optimistic departure while the save is still in flight', async () => {
    let releaseSave: (() => void) | undefined;
    harness.save.mockImplementation(() => new Promise<void>((resolve) => {
      releaseSave = resolve;
    }));
    const { result, rerender } = renderHook(() => useTransportStatus());
    await flushEffects();

    act(() => {
      result.current.markInProgress('U002', 'to');
    });
    harness.schedules = [scheduleRow('U002', '2026-11-11T08:00:00+09:00')];
    rerender();
    await flushEffects();

    expect(legFor(result, 'U002')?.status).toBe('in-progress');
    expect(harness.save).toHaveBeenCalledTimes(1);

    harness.logs = [{
      userId: 'U002',
      direction: 'to',
      status: 'in-progress',
      actualTime: '08:41',
      recordDate: '2026-11-11',
    }];
    releaseSave?.();
    await flushEffects();
    harness.schedules = [scheduleRow('U002', '2026-11-11T08:00:00+09:00')];
    rerender();
    await flushEffects();

    expect(legFor(result, 'U002')).toMatchObject({ status: 'in-progress', actualTime: '08:41' });
  });

  it('reflects another staff member arriving after the local departure was saved', async () => {
    const { result, rerender } = renderHook(() => useTransportStatus());
    await flushEffects();

    act(() => {
      result.current.markInProgress('U002', 'to');
    });
    await flushEffects();
    expect(legFor(result, 'U002')?.status).toBe('in-progress');

    harness.logs = [{
      userId: 'U002',
      direction: 'to',
      status: 'arrived',
      actualTime: '09:10',
      recordDate: '2026-11-11',
    }];
    harness.schedules = [scheduleRow('U002', '2026-11-11T08:00:00+09:00')];
    rerender();
    await flushEffects();

    expect(legFor(result, 'U002')).toMatchObject({ status: 'arrived', actualTime: '09:10' });
  });

  it('does not let an older fetch replace a newer arrival', async () => {
    harness.logs = [{
      userId: 'U002',
      direction: 'to',
      status: 'in-progress',
      actualTime: '08:40',
      recordDate: '2026-11-11',
    }];
    const { result, rerender } = renderHook(() => useTransportStatus());
    await flushEffects();
    expect(legFor(result, 'U002')?.status).toBe('in-progress');

    const { loadTransportLogs } = await import('../transportRepo');
    let resolveLater: ((logs: TransportLogEntry[]) => void) | undefined;
    vi.mocked(loadTransportLogs).mockImplementation((_client: unknown, dateKey: string) => {
      harness.loadDates.push(dateKey);
      return new Promise((resolve) => {
        resolveLater = resolve;
      });
    });
    harness.schedules = [scheduleRow('U002', '2026-11-11T08:00:00+09:00')];
    rerender();
    await flushEffects();

    act(() => {
      result.current.markArrived('U002', 'to');
    });
    await flushEffects();
    expect(legFor(result, 'U002')?.status).toBe('arrived');

    await act(async () => {
      resolveLater?.([{
        userId: 'U002',
        direction: 'to',
        status: 'in-progress',
        actualTime: '08:40',
        recordDate: '2026-11-11',
      }]);
    });
    await flushEffects();

    expect(legFor(result, 'U002')?.status).toBe('arrived');
    expect(vi.mocked(syncToAttendanceDaily)).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userCode: 'U002',
      recordDate: '2026-11-11',
      status: 'arrived',
    }));
  });

  it('does not roll back a later arrival when the earlier departure save fails', async () => {
    const rejectors: Array<(error: Error) => void> = [];
    harness.save.mockImplementation(() => new Promise<void>((_resolve, reject) => {
      rejectors.push(reject);
    }));
    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();

    act(() => {
      result.current.markInProgress('U002', 'to');
    });
    act(() => {
      result.current.markArrived('U002', 'to');
    });
    expect(legFor(result, 'U002')?.status).toBe('arrived');

    await act(async () => {
      rejectors[0]?.(new Error('departure failed'));
    });
    await flushEffects();

    expect(legFor(result, 'U002')?.status).toBe('arrived');
    expect(harness.show).toHaveBeenCalled();
  });

  it('does not save while the new schedules request is still loading', async () => {
    harness.scheduleMode = 'hold';
    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();

    expect(result.current.boardPhase).toBe('loading');
    let accepted = true;
    act(() => {
      accepted = result.current.markInProgress('U002', 'to');
    });
    expect(accepted).toBe(false);
    expect(harness.save).not.toHaveBeenCalled();
  });

  it('does not save while Transport_Log is still loading', async () => {
    const { loadTransportLogs } = await import('../transportRepo');
    vi.mocked(loadTransportLogs).mockImplementation((_client: unknown, dateKey: string) => {
      harness.loadDates.push(dateKey);
      return new Promise(() => undefined);
    });
    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();

    expect(result.current.boardPhase).toBe('loading');
    let accepted = true;
    act(() => {
      accepted = result.current.markInProgress('U002', 'to');
    });
    expect(accepted).toBe(false);
    expect(harness.save).not.toHaveBeenCalled();
  });

  it('does not save when schedules fail', async () => {
    harness.scheduleMode = 'error';
    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();

    expect(result.current.boardPhase).toBe('error');
    let accepted = true;
    act(() => {
      accepted = result.current.markInProgress('U002', 'to');
    });
    expect(accepted).toBe(false);
    expect(harness.save).not.toHaveBeenCalled();
  });

  it('does not save when Transport_Log fails', async () => {
    const { loadTransportLogs } = await import('../transportRepo');
    vi.mocked(loadTransportLogs).mockImplementation((_client: unknown, dateKey: string) => {
      harness.loadDates.push(dateKey);
      return Promise.reject(new Error('log failed'));
    });
    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();

    expect(result.current.boardPhase).toBe('error');
    let accepted = true;
    act(() => {
      accepted = result.current.markInProgress('U002', 'to');
    });
    expect(accepted).toBe(false);
    expect(harness.save).not.toHaveBeenCalled();
  });

  it('writes departure before arrival and leaves the persisted status arrived', async () => {
    const writes: Array<{ status: string; recordDate: string }> = [];
    let releaseDeparture: (() => void) | undefined;
    harness.save.mockImplementation((_client: unknown, input: { status: string; recordDate: string }) => {
      writes.push({ status: input.status, recordDate: input.recordDate });
      if (input.status === 'in-progress') {
        return new Promise<void>((resolve) => {
          releaseDeparture = resolve;
        });
      }
      return Promise.resolve();
    });
    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();
    expect(result.current.boardPhase).toBe('ready');

    act(() => {
      result.current.markInProgress('U002', 'to');
    });
    act(() => {
      result.current.markArrived('U002', 'to');
    });

    expect(legFor(result, 'U002')?.status).toBe('arrived');
    expect(writes.map((write) => write.status)).toEqual(['in-progress']);

    await act(async () => {
      releaseDeparture?.();
    });
    await flushEffects();

    expect(writes).toEqual([
      { status: 'in-progress', recordDate: '2026-11-11' },
      { status: 'arrived', recordDate: '2026-11-11' },
    ]);
    expect(legFor(result, 'U002')?.status).toBe('arrived');
    expect(vi.mocked(syncToAttendanceDaily)).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userCode: 'U002',
      status: 'arrived',
      recordDate: '2026-11-11',
    }));
  });

  it('lets a different rider save without waiting for the first rider', async () => {
    harness.users = [
      { UserID: 'U001', FullName: '田中 太郎', IsActive: true },
      { UserID: 'U002', FullName: '鈴木 美子', IsActive: true },
    ];
    harness.schedules = [
      scheduleRow('U001', '2026-11-11T08:00:00+09:00'),
      scheduleRow('U002', '2026-11-11T08:00:00+09:00'),
    ];
    const started: string[] = [];
    harness.save.mockImplementation((_client: unknown, input: { userCode: string }) => {
      started.push(input.userCode);
      return new Promise(() => undefined);
    });
    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();

    act(() => {
      result.current.markInProgress('U001', 'to');
    });
    act(() => {
      result.current.markInProgress('U002', 'to');
    });

    expect(started).toEqual(['U001', 'U002']);
    expect(legFor(result, 'U001')?.status).toBe('in-progress');
    expect(legFor(result, 'U002')?.status).toBe('in-progress');
  });
});

describe('useTransportStatus JST date boundary', () => {
  beforeEach(async () => {
    await resetTransportLogLoader();
    harness.users = [
      { UserID: 'U001', FullName: '田中 太郎', IsActive: true },
      { UserID: 'U002', FullName: '鈴木 美子', IsActive: true },
    ];
    harness.schedules = [
      scheduleRow('U001', '2026-03-25T08:00:00+09:00'),
      scheduleRow('U002', '2026-03-26T08:00:00+09:00'),
    ];
    harness.logs = [];
    harness.ranges = [];
    harness.loadDates = [];
    harness.save.mockReset();
    harness.save.mockResolvedValue(undefined);
    harness.show.mockReset();
    harness.scheduleMode = 'settle';
    harness.scheduleNonce = 0;
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-03-25T14:59:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('switches the schedule range at JST midnight and ignores a late previous-day fetch', async () => {
    const pending = new Map<string, (logs: TransportLogEntry[]) => void>();
    const { loadTransportLogs } = await import('../transportRepo');
    vi.mocked(loadTransportLogs).mockImplementation((_client, dateKey: string) => {
      harness.loadDates.push(dateKey);
      return new Promise((resolve) => {
        pending.set(dateKey, resolve);
      });
    });

    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();

    expect(harness.ranges.at(-1)).toEqual({
      from: '2026-03-25T00:00:00+09:00',
      to: '2026-03-25T23:59:59+09:00',
    });

    vi.setSystemTime(new Date('2026-03-25T15:00:30.000Z'));
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await flushEffects();
    pending.get('2026-03-26')?.([{
      userId: 'U002',
      direction: 'to',
      status: 'arrived',
      actualTime: '09:05',
      recordDate: '2026-03-26',
    }]);
    await flushEffects();

    expect(harness.loadDates).toContain('2026-03-26');
    expect(harness.ranges.at(-1)).toEqual({
      from: '2026-03-26T00:00:00+09:00',
      to: '2026-03-26T23:59:59+09:00',
    });
    expect(legFor(result, 'U001')).toBeUndefined();
    expect(legFor(result, 'U002')).toMatchObject({ status: 'arrived', actualTime: '09:05' });

    pending.get('2026-03-25')?.([{
      userId: 'U001',
      direction: 'to',
      status: 'in-progress',
      actualTime: '08:10',
      recordDate: '2026-03-25',
    }]);
    await flushEffects();

    expect(legFor(result, 'U002')).toMatchObject({ status: 'arrived', actualTime: '09:05' });
    expect(legFor(result, 'U001')).toBeUndefined();
  });

  it('clears yesterday from the board at the JST midnight timeout, before the 60s clock', async () => {
    vi.setSystemTime(new Date('2026-03-25T14:59:30.000Z'));
    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();

    expect(legFor(result, 'U001')?.status).toBe('pending');
    expect(harness.ranges.at(-1)?.from).toBe('2026-03-25T00:00:00+09:00');

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await flushEffects();

    expect(legFor(result, 'U001')).toBeUndefined();
    expect(harness.loadDates).toContain('2026-03-26');
    expect(harness.ranges.at(-1)).toEqual({
      from: '2026-03-26T00:00:00+09:00',
      to: '2026-03-26T23:59:59+09:00',
    });
  });

  it('refuses a save when the clock has passed midnight and the timer has not run', async () => {
    const { result, rerender } = renderHook(() => useTransportStatus());
    await flushEffects();
    expect(legFor(result, 'U001')?.status).toBe('pending');

    vi.setSystemTime(new Date('2026-03-25T15:00:30.000Z'));
    rerender();

    expect(legFor(result, 'U001')).toBeUndefined();
    let accepted = true;
    act(() => {
      accepted = result.current.markInProgress('U001', 'to');
    });

    expect(accepted).toBe(false);
    expect(harness.save).not.toHaveBeenCalled();
    expect(legFor(result, 'U001')).toBeUndefined();
    await flushEffects();
  });

  it('does not operate yesterday while the new date is still loading', async () => {
    vi.setSystemTime(new Date('2026-03-25T14:59:30.000Z'));
    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();

    const { loadTransportLogs } = await import('../transportRepo');
    let releaseNextDay: ((logs: TransportLogEntry[]) => void) | undefined;
    vi.mocked(loadTransportLogs).mockImplementation((_client: unknown, dateKey: string) => {
      harness.loadDates.push(dateKey);
      return new Promise((resolve) => {
        releaseNextDay = resolve;
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(legFor(result, 'U001')).toBeUndefined();
    let accepted = true;
    act(() => {
      accepted = result.current.markInProgress('U001', 'to');
    });
    expect(accepted).toBe(false);
    expect(harness.save).not.toHaveBeenCalled();

    await act(async () => {
      releaseNextDay?.([]);
    });
    await flushEffects();
    expect(harness.save).not.toHaveBeenCalled();
  });

  it('does not let a failed save from the previous JST date change the next day leg', async () => {
    harness.schedules = [
      scheduleRow('U001', '2026-03-25T08:00:00+09:00'),
      scheduleRow('U001', '2026-03-26T08:00:00+09:00'),
    ];
    harness.logs = [{
      userId: 'U001',
      direction: 'to',
      status: 'arrived',
      actualTime: '09:05',
      recordDate: '2026-03-26',
    }];
    let rejectSave: ((error: Error) => void) | undefined;
    harness.save.mockImplementation(() => new Promise<void>((_resolve, reject) => {
      rejectSave = reject;
    }));

    const { result } = renderHook(() => useTransportStatus());
    await flushEffects();
    expect(legFor(result, 'U001')?.status).toBe('pending');

    act(() => {
      result.current.markInProgress('U001', 'to');
    });
    expect(legFor(result, 'U001')?.status).toBe('in-progress');
    expect(harness.save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userCode: 'U001',
      recordDate: '2026-03-25',
      status: 'in-progress',
    }));

    vi.setSystemTime(new Date('2026-03-25T15:00:00.000Z'));
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await flushEffects();

    expect(legFor(result, 'U001')).toMatchObject({ status: 'arrived', actualTime: '09:05' });

    await act(async () => {
      rejectSave?.(new Error('yesterday failed'));
    });
    await flushEffects();

    expect(legFor(result, 'U001')).toMatchObject({ status: 'arrived', actualTime: '09:05' });
    expect(harness.show).toHaveBeenCalled();
    expect(harness.save).toHaveBeenCalledTimes(1);
  });
});
