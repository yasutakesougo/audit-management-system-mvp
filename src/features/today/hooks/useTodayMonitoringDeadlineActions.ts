import { useEffect, useMemo, useState } from 'react';
import type { IUserMaster } from '@/features/users/types';
import { mapTodaySignalsToActionSources } from '../domain/mapTodaySignalToActionSource';
import type { RawActionSource } from '../domain/models/queue.types';
import type { TodaySignal } from '../types/todaySignal.types';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { buildMonitoringTodayAlerts, type MonitoringTodayUserInput } from '../domain/buildMonitoringTodayAlerts';

export interface UseTodayMonitoringDeadlineActionsResult {
  signals: TodaySignal[];
  actionSources: RawActionSource[];
}

export function useTodayMonitoringDeadlineActions(
  users: IUserMaster[],
  todayOverride?: string,
): UseTodayMonitoringDeadlineActionsResult {
  const planningSheetRepository = usePlanningSheetRepositories();
  const [monitoringInputs, setMonitoringInputs] = useState<MonitoringTodayUserInput[]>([]);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      if (users.length === 0) {
        if (active) setMonitoringInputs((current) => (current.length === 0 ? current : []));
        return;
      }

      const rows = await Promise.all(
        users.map(async (user, index): Promise<MonitoringTodayUserInput> => {
          const fallbackUserId = `U${String(user.Id ?? index + 1).padStart(3, '0')}`;
          const userId = (user.UserID ?? '').trim() || fallbackUserId;
          const userName = user.FullName ?? userId;
          const currentSheets = await planningSheetRepository.listCurrentByUser(userId);
          const currentSheet = currentSheets[0];
          const fullSheet = currentSheet ? await planningSheetRepository.getById(currentSheet.id) : null;

          return {
            userId,
            userName,
            serviceStartDate: user.ServiceStartDate ?? null,
            supportStartDate: fullSheet?.supportStartDate ?? null,
            appliedFrom: fullSheet?.appliedFrom ?? null,
          };
        }),
      );

      if (active) setMonitoringInputs(rows);
    }

    void load().catch(() => {
      if (active) setMonitoringInputs((current) => (current.length === 0 ? current : []));
    });

    return () => {
      active = false;
    };
  }, [planningSheetRepository, users]);

  const result = useMemo(() => {
    const today = todayOverride ?? new Date().toISOString().slice(0, 10);
    const signals = buildMonitoringTodayAlerts(monitoringInputs, today).map((row) => row.signal) as TodaySignal[];

    const actionSources = mapTodaySignalsToActionSources(signals);

    return { signals, actionSources };
  }, [monitoringInputs, todayOverride]);

  return result;
}
