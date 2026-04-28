import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useSevereAddonRealData } from '../hooks/useSevereAddonRealData';
import { useRegulatoryFindingsRealData } from '../hooks/useRegulatoryFindingsRealData';
import type { PlanningSheetRepository, ProcedureRecordRepository } from '@/domain/isp/port';
import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';
import type { IUserMaster } from '@/sharepoint/fields';

function createPlanningSheetRepo(listCurrentByUser = vi.fn().mockResolvedValue([])): PlanningSheetRepository {
  return {
    getById: vi.fn(),
    listByIsp: vi.fn(),
    listByUser: vi.fn(),
    listCurrentByUser,
    listBySeries: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  } as unknown as PlanningSheetRepository;
}

function createMonitoringMeetingRepo(listByUser = vi.fn().mockResolvedValue([])): MonitoringMeetingRepository {
  return {
    save: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
    listByUser,
    listByIsp: vi.fn(),
    delete: vi.fn(),
  };
}

function createProcedureRecordRepo(): ProcedureRecordRepository {
  return {
    getById: vi.fn(),
    listByPlanningSheet: vi.fn(),
    listByUserAndDate: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  } as unknown as ProcedureRecordRepository;
}

function buildUsers(): IUserMaster[] {
  return [
    {
      Id: 1,
      UserID: 'U001',
      FullName: 'テスト利用者',
      IsActive: true,
    } as IUserMaster,
  ];
}

describe('regulatory real-data hook dedupe', () => {
  it('does not re-fetch planning sheets in severe-addon hook for identical user key rerenders', async () => {
    const listCurrentByUser = vi.fn().mockResolvedValue([]);
    const planningRepo = createPlanningSheetRepo(listCurrentByUser);
    const users = buildUsers();

    const { rerender } = renderHook(
      ({ currentUsers }) =>
        useSevereAddonRealData(currentUsers, [], false, null, planningRepo, null, null),
      { initialProps: { currentUsers: users } },
    );

    await waitFor(() => {
      expect(listCurrentByUser).toHaveBeenCalledTimes(1);
    });

    rerender({ currentUsers: [...users] });

    await waitFor(() => {
      expect(listCurrentByUser).toHaveBeenCalledTimes(1);
    });
  });

  it('does not re-fetch planning/monitoring in regulatory hook for identical user key rerenders', async () => {
    const listCurrentByUser = vi.fn().mockResolvedValue([]);
    const listByUser = vi.fn().mockResolvedValue([]);
    const planningRepo = createPlanningSheetRepo(listCurrentByUser);
    const monitoringRepo = createMonitoringMeetingRepo(listByUser);
    const procedureRepo = createProcedureRecordRepo();
    const users = buildUsers();

    const { rerender } = renderHook(
      ({ currentUsers }) =>
        useRegulatoryFindingsRealData(
          currentUsers,
          [],
          false,
          null,
          planningRepo,
          procedureRepo,
          monitoringRepo,
        ),
      { initialProps: { currentUsers: users } },
    );

    await waitFor(() => {
      expect(listCurrentByUser).toHaveBeenCalledTimes(1);
      expect(listByUser).toHaveBeenCalledTimes(1);
    });

    rerender({ currentUsers: [...users] });

    await waitFor(() => {
      expect(listCurrentByUser).toHaveBeenCalledTimes(1);
      expect(listByUser).toHaveBeenCalledTimes(1);
    });
  });
});
