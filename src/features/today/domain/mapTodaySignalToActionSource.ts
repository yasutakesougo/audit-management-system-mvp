import type { RawActionSource } from './models/queue.types';
import type { TodaySignal } from '../types/todaySignal.types';

function toTargetTime(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function mapTodaySignalToActionSource(signal: TodaySignal): RawActionSource | null {
  const metadata = (signal.metadata ?? {}) as Record<string, unknown>;

  if (signal.code === 'isp_renew_suggest') {
    return {
      id: `today-signal:${signal.id}`,
      sourceType: 'isp_renew_suggest',
      title: signal.title,
      targetTime: toTargetTime(metadata.createdAt),
      slaMinutes: 0,
      isCompleted: false,
      payload: {
        ...metadata,
        path: signal.actionPath,
        signalCode: signal.code,
        recommendedOnly: true,
      },
    };
  }

  if (
    signal.code === 'monitoring_overdue' ||
    signal.code === 'monitoring_due_today' ||
    signal.code === 'monitoring_due_soon'
  ) {
    return {
      id: `today-signal:${signal.id}`,
      sourceType: 'monitoring_deadline',
      title: signal.title,
      targetTime: toTargetTime(metadata.nextDueDate),
      slaMinutes: 0,
      isCompleted: false,
      payload: {
        ...metadata,
        path: signal.actionPath,
        signalCode: signal.code,
      },
    };
  }

  return null;
}

export function mapTodaySignalsToActionSources(signals: TodaySignal[]): RawActionSource[] {
  return signals
    .map(mapTodaySignalToActionSource)
    .filter((source): source is RawActionSource => source !== null);
}
