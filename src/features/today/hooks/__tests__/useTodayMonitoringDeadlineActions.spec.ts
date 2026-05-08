import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTodayMonitoringDeadlineActions } from '../useTodayMonitoringDeadlineActions';
import type { IUserMaster } from '@/features/users/types';

const listCurrentByUser = vi.fn();
const getById = vi.fn();

vi.mock('@/features/planning-sheet/hooks/usePlanningSheetRepositories', () => ({
  usePlanningSheetRepositories: () => ({
    listCurrentByUser,
    getById,
  }),
}));

describe('useTodayMonitoringDeadlineActions', () => {
  const mockUsers: Partial<IUserMaster>[] = [
    {
      UserID: 'U001',
      FullName: '利用者一',
      ServiceStartDate: '2026-02-01', // 2026-05-08時点で 96日経過 -> overdue (cycle=90)
    },
    {
      UserID: 'U002',
      FullName: '利用者二',
      ServiceStartDate: '2026-02-07', // 2026-05-08時点で 90日経過 -> dueToday
    },
    {
      UserID: 'U003',
      FullName: '利用者三',
      ServiceStartDate: '2026-02-14', // 2026-05-08時点で 83日経過 -> critical (残り7日)
    },
    {
      UserID: 'U004',
      FullName: '利用者四',
      ServiceStartDate: '2026-03-01', // 2026-05-08時点で 68日経過 -> warning (残り22日)
    },
    {
      UserID: 'U005',
      FullName: '利用者五',
      ServiceStartDate: '2026-04-10', // 2026-05-08時点で 28日経過 -> normal (残り62日)
    },
    {
      UserID: 'U006',
      FullName: '利用者六',
      ServiceStartDate: undefined, // unknown
    },
  ];

  it('should return correct actions based on monitoring deadlines', async () => {
    listCurrentByUser.mockResolvedValue([]);
    getById.mockResolvedValue(null);

    const { result } = renderHook(() => 
      useTodayMonitoringDeadlineActions(mockUsers as IUserMaster[], '2026-05-08')
    );
    await waitFor(() => {
      expect(result.current.signals.length).toBe(5);
    });

    const { signals, actionSources } = result.current;

    // normal(U005) は含まれない。unknown(U006) は起点未設定として含まれる。
    expect(signals).toHaveLength(5);

    // U001: overdue -> P0
    const signal1 = signals.find(s => s.metadata?.userId === 'U001');
    expect(signal1?.code).toBe('monitoring_overdue');
    expect(signal1?.priority).toBe('P0');
    expect(signal1?.id).toBe('monitoring-deadline:U001:2026-05-02');

    // U002: dueToday -> P0
    const signal2 = signals.find(s => s.metadata?.userId === 'U002');
    expect(signal2?.code).toBe('monitoring_due_today');
    expect(signal2?.priority).toBe('P0');

    // U003: critical -> P1
    const signal3 = signals.find(s => s.metadata?.userId === 'U003');
    expect(signal3?.code).toBe('monitoring_due_soon');
    expect(signal3?.priority).toBe('P1');
    expect(signal3?.metadata?.status).toBe('critical');

    // U004: warning -> P1
    const signal4 = signals.find(s => s.metadata?.userId === 'U004');
    expect(signal4?.code).toBe('monitoring_due_soon');
    expect(signal4?.priority).toBe('P1');
    expect(signal4?.metadata?.status).toBe('warning');

    // U006: unset -> P0
    const signal6 = signals.find(s => s.metadata?.userId === 'U006');
    expect(signal6?.code).toBe('monitoring_origin_unset');
    expect(signal6?.priority).toBe('P0');

    // ActionSources verify
    expect(actionSources).toHaveLength(5);
    const source1 = actionSources.find(s => s.id === `today-signal:${signal1?.id}`);
    expect(source1?.sourceType).toBe('monitoring_deadline');

  });
});
