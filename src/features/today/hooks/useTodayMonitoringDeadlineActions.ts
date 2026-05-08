import { useMemo } from 'react';
import type { IUserMaster } from '@/features/users/types';
import { computeMonitoringDeadlineFromSupportStart } from '@/domain/isp/monitoringDeadline';
import { mapMonitoringDeadlineToTodaySignal } from '../domain/mapMonitoringDeadlineToTodaySignal';
import { mapTodaySignalsToActionSources } from '../domain/mapTodaySignalToActionSource';
import type { RawActionSource } from '../domain/models/queue.types';
import type { TodaySignal } from '../types/todaySignal.types';

export interface UseTodayMonitoringDeadlineActionsResult {
  signals: TodaySignal[];
  actionSources: RawActionSource[];
}

export function useTodayMonitoringDeadlineActions(
  users: IUserMaster[],
): UseTodayMonitoringDeadlineActionsResult {
  const result = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    const signals = users
      .map((user) => {
        const monitoringBaseDate = user.ServiceStartDate;
        const deadlineState = computeMonitoringDeadlineFromSupportStart(monitoringBaseDate, today);
        
        return mapMonitoringDeadlineToTodaySignal({
          userId: user.UserID || String(user.Id),
          userName: user.FullName,
          deadlineState,
        });
      })
      .filter((signal): signal is TodaySignal => signal !== null);

    const actionSources = mapTodaySignalsToActionSources(signals);

    return { signals, actionSources };
  }, [users]);

  return result;
}
