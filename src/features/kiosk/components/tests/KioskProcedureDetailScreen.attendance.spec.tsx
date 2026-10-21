import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { IUserMaster } from '@/features/users/types';
import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';
import type { AttendanceDailyItem } from '@/features/attendance/infra/Legacy/attendanceDailyRepository';
import { KioskProcedureDetailScreen } from '../KioskProcedureDetailScreen';

const control = vi.hoisted(() => ({
  route: '9001', user: null as IUserMaster | null,
  status: 'success' as 'loading' | 'success' | 'error',
  record: undefined as ExecutionRecord | undefined,
  recordLoading: false, recordError: null as Error | null,
  read: vi.fn<(params: { recordDate: string }) => Promise<AttendanceDailyItem[]>>(),
  save: vi.fn(), remove: vi.fn(), navigate: vi.fn(),
}));
const attendanceRepository = { getDailyByDate: control.read };
vi.mock('@/features/attendance/repositoryFactory', () => ({
  useAttendanceRepository: () => attendanceRepository,
}));
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual<typeof import('react-router-dom')>('react-router-dom'),
  useParams: () => ({ userId: control.route, slotKey: '0' }),
  useNavigate: () => control.navigate,
}));
vi.mock('@/features/users/useUsers', () => ({
  useUser: () => ({ data: control.user, status: control.status }),
}));
const procedures = [{
  id: 'procedure-1', rowNo: 1, time: '10:00', activity: 'synthetic activity',
  instruction: 'synthetic instruction', activityDetail: 'synthetic body', instructionDetail: 'synthetic supporter',
}];
vi.mock('@/features/daily/hooks/useProcedureData', () => ({
  useProcedureData: () => ({ getByUser: () => procedures }),
}));
vi.mock('@/features/daily/hooks/useExecutionRecord', () => ({
  useExecutionRecord: () => ({
    record: control.record, isLoading: control.recordLoading, error: control.recordError,
    saveRecord: control.save, deleteRecord: control.remove, refresh: () => undefined,
  }),
}));
vi.mock('../KioskProcedureHistoryPanel', () => ({ KioskProcedureHistoryPanel: () => null }));

function deferred() {
  let resolve!: (rows: AttendanceDailyItem[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<AttendanceDailyItem[]>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const absent = (): AttendanceDailyItem[] => [{
  Key: 'synthetic-A', UserCode: 'TEST-A', RecordDate: '2026-10-21', Status: '欠席',
  AbsentReason: 'reason-A', AbsentSupportContent: 'support-A',
}];
const view = () => (
  <MemoryRouter initialEntries={['/kiosk/users/9001/procedures/0?date=2026-10-21']}>
    <KioskProcedureDetailScreen />
  </MemoryRouter>
);
async function finish(request: ReturnType<typeof deferred>, rows: AttendanceDailyItem[]) {
  await act(async () => { request.resolve(rows); await request.promise; });
}
async function reject(request: ReturnType<typeof deferred>) {
  await act(async () => { request.reject(new Error('synthetic attendance failure')); await request.promise.catch(() => undefined); });
}
beforeEach(() => {
  vi.clearAllMocks();
  control.route = '9001';
  control.user = { Id: 9001, UserID: 'TEST-A', FullName: 'Synthetic A' };
  control.status = 'success';
  control.recordLoading = false;
  control.recordError = null;
  control.record = {
    id: 'synthetic-record', date: '2026-10-21', userId: 'TEST-A', scheduleItemId: 'procedure-1',
    status: 'completed', memo: 'synthetic saved memo', recordedAt: '2026-10-21T00:00:00Z',
    recordedBy: '', triggeredBipIds: [],
  };
  control.read.mockReset();
  // These write spies never communicate or complete a production operation.
  control.save.mockImplementation(() => new Promise<void>(() => undefined));
  control.remove.mockImplementation(() => new Promise<void>(() => undefined));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  expect(vi.mocked(console.error).mock.calls.filter(
    ([message]) => message !== '[useKioskAttendance] Failed to fetch daily attendance:',
  )).toEqual([]);
  expect(globalThis.fetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe('detail screen with the real attendance hook', () => {
  it('[G01 G02] keeps cached-but-unconfirmed user renders convergent and attendance reads at zero', () => {
    control.status = 'loading';
    const app = render(view());
    for (let i = 0; i < 20; i += 1) app.rerender(view());
    expect(screen.getByText('synthetic body')).toBeInTheDocument();
    expect(screen.getByTestId('kiosk-observation-submit')).toBeDisabled();
    expect(control.read).not.toHaveBeenCalled();
    expect(control.save).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('[G07] removes A absence UI while B attendance is still pending', async () => {
    const a = deferred(), b = deferred();
    control.read.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const app = render(view());
    await finish(a, absent());
    expect(screen.getByTestId('kiosk-procedure-detail-absence-alert')).toBeInTheDocument();
    control.route = '9002';
    control.user = { Id: 9002, UserID: 'TEST-B', FullName: 'Synthetic B' };
    control.record = { ...control.record!, userId: 'TEST-B' };
    app.rerender(view());
    expect(screen.queryByTestId('kiosk-procedure-detail-absence-alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/reason-A/)).not.toBeInTheDocument();
    await finish(b, []);
    expect(control.read).toHaveBeenCalledTimes(2);
  });

  it('[G15] keeps confirmed absence save/delete/ABC guards unchanged', async () => {
    const request = deferred();
    control.read.mockReturnValue(request.promise);
    render(view());
    await finish(request, absent());
    for (const id of ['kiosk-observation-submit', 'kiosk-observation-revert', 'kiosk-procedure-detail-abc-record']) {
      expect(screen.getByTestId(id)).toBeDisabled();
      fireEvent.click(screen.getByTestId(id));
    }
    expect(control.save).not.toHaveBeenCalled();
    expect(control.remove).not.toHaveBeenCalled();
    expect(control.read).toHaveBeenCalledTimes(1);
  });

  it('[G15] does not start attendance or permit mutations without canonical UserID', () => {
    control.user = { ...control.user!, UserID: '' };
    render(view());
    expect(screen.getByTestId('kiosk-observation-submit')).toBeDisabled();
    expect(control.read).not.toHaveBeenCalled();
    expect(control.save).not.toHaveBeenCalled();
    expect(control.remove).not.toHaveBeenCalled();
  });

  it('[G15] preserves the unknown execution-record guard on an already-open cancellation dialog', async () => {
    const request = deferred();
    control.read.mockReturnValue(request.promise);
    const app = render(view());
    await finish(request, []);
    await waitFor(() => expect(screen.getByTestId('kiosk-observation-revert')).toBeEnabled());
    fireEvent.click(screen.getByTestId('kiosk-observation-revert'));
    expect(screen.getByTestId('kiosk-observation-revert-confirm')).toBeEnabled();
    control.recordError = new Error('synthetic record failure');
    app.rerender(view());
    expect(screen.getByTestId('kiosk-observation-submit')).toBeDisabled();
    expect(screen.getByTestId('kiosk-observation-revert-confirm')).toBeDisabled();
    fireEvent.click(screen.getByTestId('kiosk-observation-revert-confirm'));
    expect(control.remove).not.toHaveBeenCalled();
    expect(control.save).not.toHaveBeenCalled();
    expect(control.read).toHaveBeenCalledTimes(1);
  });

  it.each(['pending', 'failed'] as const)('[G15] retains existing save eligibility when attendance is %s and record identity is ready', async (state) => {
    const request = deferred();
    control.read.mockReturnValue(request.promise);
    render(view());
    if (state === 'failed') await reject(request);
    await waitFor(() => expect(screen.getByTestId('kiosk-observation-submit')).toBeEnabled());
    fireEvent.click(screen.getByTestId('kiosk-observation-submit'));
    expect(control.save).toHaveBeenCalledExactlyOnceWith('completed', expect.stringContaining('synthetic saved memo'));
    expect(control.read).toHaveBeenCalledTimes(1);
  });

  it.each(['pending', 'failed'] as const)('[G15] retains existing delete eligibility when attendance is %s and record identity is ready', async (state) => {
    const request = deferred();
    control.read.mockReturnValue(request.promise);
    render(view());
    if (state === 'failed') await reject(request);
    await waitFor(() => expect(screen.getByTestId('kiosk-observation-revert')).toBeEnabled());
    fireEvent.click(screen.getByTestId('kiosk-observation-revert'));
    expect(screen.getByTestId('kiosk-observation-revert-confirm')).toBeEnabled();
    fireEvent.click(screen.getByTestId('kiosk-observation-revert-confirm'));
    expect(control.remove).toHaveBeenCalledTimes(1);
    expect(control.read).toHaveBeenCalledTimes(1);
  });
});

