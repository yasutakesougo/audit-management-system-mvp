import type { ActionCard } from '../domain/models/queue.types';
import type { TodayQueueTelemetrySample } from './todayQueueTelemetry.types';

export function summarizeTodayQueue(
  items: ActionCard[],
  timestamp: number
): TodayQueueTelemetrySample {
  return {
    timestamp,
    queueSize: items.length,
    p0Count: items.filter((x) => x.priority === 'P0').length,
    p1Count: items.filter((x) => x.priority === 'P1').length,
    p2Count: items.filter((x) => x.priority === 'P2').length,
    p3Count: items.filter((x) => x.priority === 'P3').length,
    overdueCount: items.filter((x) => x.isOverdue).length,
    requiresAttentionCount: items.filter((x) => x.requiresAttention).length,
  };
}
