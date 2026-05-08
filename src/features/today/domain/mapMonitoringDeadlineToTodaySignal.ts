import type { MonitoringDeadlineState } from '@/domain/isp/monitoringDeadline';
import type { TodaySignal, TodaySignalPriority } from '../types/todaySignal.types';

export interface MonitoringDeadlineSignalInput {
  userId: string;
  userName: string;
  deadlineState: MonitoringDeadlineState;
}

export function mapMonitoringDeadlineToTodaySignal(
  input: MonitoringDeadlineSignalInput,
): TodaySignal | null {
  const { userId, userName, deadlineState } = input;
  const { status, nextDueDate, remainingDays } = deadlineState;

  if (status === 'normal' || status === 'unknown' || status === 'invalid') {
    return null;
  }

  let priority: TodaySignalPriority = 'P2';
  let code: 'monitoring_overdue' | 'monitoring_due_today' | 'monitoring_due_soon' = 'monitoring_due_soon';
  let title = '';
  let description = '';

  switch (status) {
    case 'overdue':
      priority = 'P0';
      code = 'monitoring_overdue';
      title = `${userName}様のモニタリング期限超過`;
      description = `期限日(${nextDueDate})を過ぎています。速やかに実施してください。`;
      break;
    case 'dueToday':
      priority = 'P0';
      code = 'monitoring_due_today';
      title = `${userName}様のモニタリング期限当日`;
      description = `本日(${nextDueDate})が期限日です。`;
      break;
    case 'critical':
      priority = 'P1';
      code = 'monitoring_due_soon';
      title = `${userName}様のモニタリング期限間近`;
      description = `期限まであと ${remainingDays} 日です (${nextDueDate})。`;
      break;
    case 'warning':
      priority = 'P1';
      code = 'monitoring_due_soon';
      title = `${userName}様のモニタリング期限接近`;
      description = `期限まであと ${remainingDays} 日です (${nextDueDate})。`;
      break;
  }

  return {
    id: `monitoring-deadline:${userId}:${nextDueDate}`,
    code,
    domain: 'Planning',
    priority,
    audience: ['staff', 'admin'],
    title,
    description,
    actionPath: `/support-plan-guide?userId=${encodeURIComponent(userId)}&tab=operations.monitoring`,
    metadata: {
      userId,
      nextDueDate,
      remainingDays,
      status,
    },
  };
}
