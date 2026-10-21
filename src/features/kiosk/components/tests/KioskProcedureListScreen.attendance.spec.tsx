import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { IUserMaster } from '@/features/users/types';
import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';
import type { AttendanceDailyItem } from '@/features/attendance/infra/Legacy/attendanceDailyRepository';
import { KioskProcedureListScreen } from '../KioskProcedureListScreen';
import { __clearSharePointThrottleCircuitBreakerForTests } from '@/lib/sp';

const control = vi.hoisted(() => ({
  route: '9001', user: null as IUserMaster | null,
  read: vi.fn<(params: { recordDate: string }) => Promise<AttendanceDailyItem[]>>(),
  records: vi.fn<() => Promise<ExecutionRecord[]>>(),
}));
const attendanceRepository = { getDailyByDate: control.read };
vi.mock('@/features/attendance/repositoryFactory', () => ({
  useAttendanceRepository: () => attendanceRepository,
}));
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual<typeof import('react-router-dom')>('react-router-dom'),
  useParams: () => ({ userId: control.route }),
}));
vi.mock('@/features/users/useUsers', () => ({
  useUser: () => ({ data: control.user, status: 'success' }),
  useUsers: () => ({ data: [], status: 'success' }),
}));
vi.mock('@/features/users/hooks/useUsersQuery', () => ({
  useUsersQuery: () => ({ data: [], status: 'success', refresh: () => undefined }),
}));
const procedures = [{ id: 'procedure-1', rowNo: 1, time: '10:00', activity: 'synthetic activity', instruction: 'synthetic instruction', isKey: true }];
vi.mock('@/features/daily/hooks/useProcedureData', () => ({
  useProcedureData: () => ({ getByUser: () => procedures }),
}));
const store = { getRecords: () => [] };
vi.mock('@/features/daily/stores/executionStore', () => ({ useExecutionStore: () => store }));
const executionRepository = { getRecords: control.records, getRecord: async () => undefined };
vi.mock('@/features/daily/hooks/useExecutionData', () => ({ useExecutionData: () => executionRepository }));
vi.mock('@/features/daily/repositories/sharepoint/executionRepositoryFactory', () => ({
  getCurrentExecutionRepositoryKind: () => 'local',
}));
vi.mock('@/features/planning-sheet/hooks/usePlanningSheetData', () => ({
  usePlanningSheetData: () => ({ data: null, isLoading: false, error: null }),
}));
vi.mock('@/features/planning-sheet/hooks/useCurrentPlanningSheet', () => ({
  useCurrentPlanningSheet: () => ({ currentSheet: null, allCurrentSheets: [], isLoading: false, error: null }),
}));
vi.mock('@/features/planning-sheet/hooks/usePlanningSheetRepositories', () => ({
  usePlanningSheetRepositories: () => ({}),
}));
vi.mock('@/lib/env', async () => ({
  ...await vi.importActual<typeof import('@/lib/env')>('@/lib/env'),
  isDemoModeEnabled: () => false,
  shouldSkipSharePoint: () => false,
  shouldSkipLogin: () => false,
}));

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
  <MemoryRouter initialEntries={['/kiosk/users/9001/procedures?date=2026-10-21']}>
    <KioskProcedureListScreen />
  </MemoryRouter>
);
async function finish(request: ReturnType<typeof deferred>, rows: AttendanceDailyItem[]) {
  await act(async () => { request.resolve(rows); await request.promise; });
}
beforeEach(() => {
  vi.clearAllMocks();
  __clearSharePointThrottleCircuitBreakerForTests();
  control.route = '9001';
  control.user = { Id: 9001, UserID: 'TEST-A', FullName: 'Synthetic A' };
  control.read.mockReset();
  control.records.mockResolvedValue([]);
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

describe('list screen with the real attendance hook', () => {
  it('[G14] retries an attendance failure through retryCount and displays the recovered absence result', async () => {
    const initial = deferred(), retry = deferred();
    control.read.mockReturnValueOnce(initial.promise).mockReturnValueOnce(retry.promise);
    render(view());
    await act(async () => {
      initial.reject(new Error('synthetic attendance failure'));
      await initial.promise.catch(() => undefined);
    });
    await waitFor(() => expect(screen.getByTestId('kiosk-uncertain-chip-0')).toBeInTheDocument());
    expect(screen.queryByText('未実施')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '再試行する' }));
    expect(control.read).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('出欠情報の取得に失敗しました。再試行ボタンを押してデータを読み込んでください。')).not.toBeInTheDocument();
    await finish(retry, absent());
    expect(screen.getByTestId('kiosk-absence-banner')).toHaveTextContent('reason-A - support-A');
    expect(screen.getByTestId('kiosk-absent-chip-0')).toBeInTheDocument();
    expect(control.read).toHaveBeenNthCalledWith(1, { recordDate: '2026-10-21' });
    expect(control.read).toHaveBeenNthCalledWith(2, { recordDate: '2026-10-21' });
  });

  it('[G14] keeps existing recorded status alongside the absence warning', async () => {
    const request = deferred();
    control.read.mockReturnValue(request.promise);
    control.records.mockResolvedValue([{
      id: 'synthetic-record', date: '2026-10-21', userId: 'TEST-A', scheduleItemId: 'procedure-1',
      status: 'completed', memo: 'synthetic saved memo', recordedAt: '2026-10-21T00:00:00Z',
      recordedBy: '', triggeredBipIds: [],
    }]);
    render(view());
    await finish(request, absent());
    await waitFor(() => expect(screen.getByText('記録済み')).toBeInTheDocument());
    expect(screen.getByTestId('kiosk-absence-banner')).toHaveTextContent('本日の実施記録が存在します');
    expect(control.read).toHaveBeenCalledTimes(1);
  });

  it('[G07 G14] does not keep the previous user absence banner during a new user lookup', async () => {
    const a = deferred(), b = deferred();
    control.read.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const app = render(view());
    await finish(a, absent());
    expect(screen.getByTestId('kiosk-absence-banner')).toBeInTheDocument();
    control.route = '9002';
    control.user = { Id: 9002, UserID: 'TEST-B', FullName: 'Synthetic B' };
    app.rerender(view());
    expect(screen.queryByTestId('kiosk-absence-banner')).not.toBeInTheDocument();
    expect(screen.queryByText(/reason-A/)).not.toBeInTheDocument();
    await finish(b, []);
    expect(control.read).toHaveBeenCalledTimes(2);
  });
});

