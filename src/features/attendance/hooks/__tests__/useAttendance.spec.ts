import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AttendanceRepository, ObservationTemperatureItem } from '../../domain/AttendanceRepository';
import type { AttendanceDailyItem } from '../../infra/attendanceDailyRepository';
import type { AttendanceUserItem } from '../../infra/attendanceUsersRepository';

const repository = {
  getActiveUsers: vi.fn<() => Promise<AttendanceUserItem[]>>(),
  getDailyByDate: vi.fn<() => Promise<AttendanceDailyItem[]>>(),
  upsertDailyByKey: vi.fn<() => Promise<void>>(),
  getObservationsByDate: vi.fn<() => Promise<ObservationTemperatureItem[]>>(),
} satisfies AttendanceRepository;

vi.mock('../../repositoryFactory', () => ({
  useAttendanceRepository: () => repository,
}));

// ── Nurse SP mocks for saveTemperature ──
const mockUpsertObservation = vi.fn();
vi.mock('@/features/nurse', () => ({
  upsertObservation: (...args: unknown[]) => mockUpsertObservation(...args),
}));
vi.mock('@/features/nurse/sp/client', () => ({
  makeSharePointListApi: () => ({ mode: 'stub' }),
}));
vi.mock('@/features/nurse/sp/constants', () => ({
  NURSE_LISTS: { observation: 'Nurse_Observation' },
}));

import { useAttendance } from '../../useAttendance';

const usersFixture: AttendanceUserItem[] = [
  {
    Id: 1,
    Title: '田中太郎',
    UserCode: 'U001',
    IsTransportTarget: true,
    StandardMinutes: 360,
    IsActive: true,
  },
  {
    Id: 2,
    Title: '佐藤花子',
    UserCode: 'U002',
    IsTransportTarget: false,
    StandardMinutes: 300,
    IsActive: true,
  },
];

const dailyFixture: AttendanceDailyItem[] = [
  {
    Key: 'U001|2026-02-24',
    UserCode: 'U001',
    RecordDate: '2026-02-24',
    Status: '通所中',
    CheckInAt: '2026-02-24T00:30:00.000Z',
    CntAttendIn: 1,
    CntAttendOut: 0,
  },
];

describe('useAttendance', () => {
  beforeEach(() => {
    repository.getActiveUsers.mockReset();
    repository.getDailyByDate.mockReset();
    repository.upsertDailyByKey.mockReset();
    repository.getObservationsByDate.mockReset();
    mockUpsertObservation.mockReset();

    repository.getActiveUsers.mockResolvedValue(usersFixture);
    repository.getDailyByDate.mockResolvedValue(dailyFixture);
    repository.upsertDailyByKey.mockResolvedValue();
    repository.getObservationsByDate.mockResolvedValue([]);
    mockUpsertObservation.mockResolvedValue({ id: 999, created: true });
  });

  it('loads initial rows as merged AttendanceRowVM data', async () => {
    const { result } = renderHook(() => useAttendance());

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.rows).toHaveLength(2);

    const row1 = result.current.rows.find((row) => row.userCode === 'U001');
    const row2 = result.current.rows.find((row) => row.userCode === 'U002');

    expect(row1?.FullName).toBe('田中太郎');
    expect(row1?.status).toBe('通所中');
    expect(row1?.cntAttendIn).toBe(1);

    expect(row2?.FullName).toBe('佐藤花子');
    expect(row2?.status).toBe('未');
  });

  it('filters rows by query via setFilters', async () => {
    const { result } = renderHook(() => useAttendance());

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    act(() => {
      result.current.actions.setFilters({ query: '花子' });
    });

    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]?.FullName).toBe('佐藤花子');
  });

  it('updates row status optimistically on updateStatus', async () => {
    let resolveUpsert: (() => void) | undefined;
    repository.upsertDailyByKey.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpsert = resolve;
        }),
    );

    const { result } = renderHook(() => useAttendance());

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    act(() => {
      void result.current.actions.updateStatus('U002', '通所中');
    });

    const target = result.current.rows.find((row) => row.userCode === 'U002');
    expect(target?.status).toBe('通所中');

    if (resolveUpsert) {
      resolveUpsert();
    }

    await waitFor(() => {
      expect(repository.upsertDailyByKey).toHaveBeenCalledTimes(1);
    });
  });

  it('re-fetches latest data on refresh', async () => {
    const changed: AttendanceDailyItem[] = [
      {
        Key: 'U001|2026-02-24',
        UserCode: 'U001',
        RecordDate: '2026-02-24',
        Status: '退所済',
        CheckInAt: '2026-02-24T00:30:00.000Z',
        CheckOutAt: '2026-02-24T07:00:00.000Z',
        CntAttendIn: 1,
        CntAttendOut: 1,
      },
    ];

    repository.getDailyByDate
      .mockResolvedValueOnce(dailyFixture)
      .mockResolvedValueOnce(changed);

    const { result } = renderHook(() => useAttendance());

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.rows.find((row) => row.userCode === 'U001')?.status).toBe('通所中');

    await act(async () => {
      await result.current.actions.refresh();
    });

    expect(result.current.rows.find((row) => row.userCode === 'U001')?.status).toBe('退所済');
    expect(repository.getDailyByDate).toHaveBeenCalledTimes(2);
  });

  // ── saveTemperature tests ──

  it('saveTemperature success → success notification with temperature', async () => {
    const { result } = renderHook(() => useAttendance());

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    await act(async () => {
      await result.current.actions.saveTemperature('U001', 36.5);
    });

    expect(mockUpsertObservation).toHaveBeenCalledTimes(1);
    expect(result.current.notification.open).toBe(true);
    expect(result.current.notification.severity).toBe('success');
    expect(result.current.notification.message).toContain('36.5℃');
    expect(result.current.notification.message).toContain('田中太郎');
    // Normal temp: no action button
    expect(result.current.notification.actionLabel).toBeUndefined();
  });

  it('saveTemperature high temp (≥37.5) → warning notification with 看護記録へ action', async () => {
    const onHighTemp = vi.fn();

    const { result } = renderHook(() => useAttendance());

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    await act(async () => {
      await result.current.actions.saveTemperature('U001', 37.8, onHighTemp);
    });

    expect(mockUpsertObservation).toHaveBeenCalledTimes(1);
    expect(result.current.notification.open).toBe(true);
    expect(result.current.notification.severity).toBe('warning');
    expect(result.current.notification.message).toContain('高体温');
    expect(result.current.notification.message).toContain('37.8');
    expect(result.current.notification.message).toContain('田中太郎');
    expect(result.current.notification.actionLabel).toBe('看護記録へ');
    expect(typeof result.current.notification.onAction).toBe('function');

    // Clicking the action should call the navigate callback
    act(() => {
      result.current.notification.onAction!();
    });
    expect(onHighTemp).toHaveBeenCalledTimes(1);
  });

  it('saveTemperature 37.5 exact → still triggers high-temp warning', async () => {
    const onHighTemp = vi.fn();

    const { result } = renderHook(() => useAttendance());

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    await act(async () => {
      await result.current.actions.saveTemperature('U001', 37.5, onHighTemp);
    });

    expect(result.current.notification.severity).toBe('warning');
    expect(result.current.notification.actionLabel).toBe('看護記録へ');
  });

  it('saveTemperature failure → error notification', async () => {
    mockUpsertObservation.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useAttendance());

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    await act(async () => {
      await result.current.actions.saveTemperature('U001', 37.2);
    });

    expect(result.current.notification.open).toBe(true);
    expect(result.current.notification.severity).toBe('error');
    expect(result.current.notification.message).toContain('通信できません');
  });

  // ── savedTempsByUser tests ──

  it('maps observation UserLookupId to userCode in savedTempsByUser', async () => {
    repository.getObservationsByDate.mockResolvedValueOnce([
      { userLookupId: 1, temperature: 36.7, observedAt: '2026-02-24T01:00:00.000Z' },
    ]);

    const { result } = renderHook(() => useAttendance());

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    // Id=1 maps to UserCode='U001'
    expect(result.current.savedTempsByUser['U001']).toBe(36.7);
    expect(result.current.savedTempsByUser['U002']).toBeUndefined();
  });
});
