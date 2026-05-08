import { computeMonitoringDeadlineFromSupportStart } from '@/domain/isp/monitoringDeadline';
import type { TodaySignal } from '../types/todaySignal.types';
import { mapMonitoringDeadlineToTodaySignal } from './mapMonitoringDeadlineToTodaySignal';
import { resolveSupportStartDateDetailed } from '@/features/planning-sheet/monitoringSchedule';

export type MonitoringTodayStatus =
  | 'ok'
  | 'dueSoon'
  | 'overdue'
  | 'provisional'
  | 'unset'
  | 'invalid';

export interface MonitoringTodayUserInput {
  userId: string;
  userName: string;
  serviceStartDate?: string | null;
  supportStartDate?: string | null;
  appliedFrom?: string | null;
}

export function buildMonitoringTodayAlerts(
  users: MonitoringTodayUserInput[],
  today: string = new Date().toISOString().slice(0, 10),
): { status: MonitoringTodayStatus; signal: TodaySignal }[] {
  const alerts: { status: MonitoringTodayStatus; signal: TodaySignal }[] = [];

  for (const user of users) {
    const resolved = resolveSupportStartDateDetailed(
      user.supportStartDate,
      user.serviceStartDate,
      user.appliedFrom,
    );

    if (resolved.source === 'none') {
      alerts.push({
        status: 'unset',
        signal: {
          id: `monitoring-origin-unset:${user.userId}`,
          code: 'monitoring_origin_unset',
          domain: 'Planning',
          priority: 'P0',
          audience: ['staff', 'admin'],
          title: `${user.userName}様の支援開始日が未設定`,
          description: '支援計画シートまたは利用者マスタに支援開始日を設定してください。',
          actionPath: `/support-plan-guide?userId=${encodeURIComponent(user.userId)}&tab=operations.monitoring`,
          metadata: { userId: user.userId, source: 'none' },
        },
      });
      continue;
    }

    if (!resolved.date) continue;
    const deadlineState = computeMonitoringDeadlineFromSupportStart(resolved.date, today);

    if (deadlineState.status === 'invalid') {
      alerts.push({
        status: 'invalid',
        signal: {
          id: `monitoring-origin-invalid:${user.userId}`,
          code: 'monitoring_origin_invalid',
          domain: 'Planning',
          priority: 'P0',
          audience: ['staff', 'admin'],
          title: `${user.userName}様の支援開始日が不正`,
          description: '支援開始日の形式を確認して修正してください。',
          actionPath: `/support-plan-guide?userId=${encodeURIComponent(user.userId)}&tab=operations.monitoring`,
          metadata: { userId: user.userId, source: resolved.source, resolvedDate: resolved.date },
        },
      });
      continue;
    }

    if (resolved.source === 'fallback') {
      alerts.push({
        status: 'provisional',
        signal: {
          id: `monitoring-origin-provisional:${user.userId}:${resolved.date}`,
          code: 'monitoring_origin_provisional',
          domain: 'Planning',
          priority: 'P1',
          audience: ['staff', 'admin'],
          title: `[暫定] ${user.userName}様のモニタリング起点`,
          description: `計画適用日(${resolved.date})を暫定利用中です。支援開始日を設定してください。`,
          actionPath: `/support-plan-guide?userId=${encodeURIComponent(user.userId)}&tab=operations.monitoring`,
          metadata: {
            userId: user.userId,
            source: resolved.source,
            resolvedDate: resolved.date,
            nextDueDate: deadlineState.nextDueDate,
            remainingDays: deadlineState.remainingDays,
            status: deadlineState.status,
          },
        },
      });
    }

    const deadlineSignal = mapMonitoringDeadlineToTodaySignal({
      userId: user.userId,
      userName: user.userName,
      deadlineState,
    });

    if (!deadlineSignal) continue;

    const status: MonitoringTodayStatus =
      deadlineState.status === 'overdue'
        ? 'overdue'
        : deadlineState.status === 'critical' || deadlineState.status === 'warning' || deadlineState.status === 'dueToday'
          ? 'dueSoon'
          : 'ok';

    alerts.push({ status, signal: deadlineSignal });
  }

  return alerts;
}

