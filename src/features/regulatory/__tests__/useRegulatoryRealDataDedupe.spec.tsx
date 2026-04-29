import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthRequiredError } from '@/lib/errors';

import { useSevereAddonRealData } from '../hooks/useSevereAddonRealData';
import { useRegulatoryFindingsRealData } from '../hooks/useRegulatoryFindingsRealData';
import type { PlanningSheetRepository, ProcedureRecordRepository } from '@/domain/isp/port';
import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';
import type { IUserMaster } from '@/sharepoint/fields';

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ isAuthReady: true }),
}));

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
  it('does not start per-user fetch when auth is not ready', async () => {
    const listCurrentByUser = vi.fn().mockResolvedValue([]);
    const listByUser = vi.fn().mockResolvedValue([]);
    const planningRepo = createPlanningSheetRepo(listCurrentByUser);
    const monitoringRepo = createMonitoringMeetingRepo(listByUser);
    const procedureRepo = createProcedureRecordRepo();
    const users = Array.from({ length: 32 }).map((_, i) => ({
      Id: i + 1,
      UserID: `U-${String(i + 1).padStart(3, '0')}`,
      FullName: `User ${i + 1}`,
      IsActive: true,
    })) as IUserMaster[];

    renderHook(() =>
      useRegulatoryFindingsRealData(
        users,
        [],
        false,
        null,
        planningRepo,
        procedureRepo,
        monitoringRepo,
        false,
      ),
    );

    await waitFor(() => {
      expect(listCurrentByUser).toHaveBeenCalledTimes(0);
      expect(listByUser).toHaveBeenCalledTimes(0);
    });
  });

  it('suppresses repeated AUTH_REQUIRED warnings per user and treats as auth skip', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const listCurrentByUser = vi.fn().mockRejectedValue(new AuthRequiredError());
    const planningRepo = createPlanningSheetRepo(listCurrentByUser);
    const users = Array.from({ length: 32 }).map((_, i) => ({
      Id: i + 1,
      UserID: `U-${String(i + 1).padStart(3, '0')}`,
      FullName: `User ${i + 1}`,
      IsActive: true,
    })) as IUserMaster[];

    const { result } = renderHook(() =>
      useSevereAddonRealData(users, [], false, null, planningRepo, null, null, true),
    );

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    expect(warnSpy).toHaveBeenCalledTimes(0);
    warnSpy.mockRestore();
  });

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
