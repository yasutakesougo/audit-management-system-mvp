import type { ActionCard, RawActionSource } from '../models/queue.types';
import { scoreActionPriority } from './scoreActionPriority';
import { calculateUrgency } from './calculateUrgency';
import { sortActionQueue } from './sortActionQueue';
import { mapToActionCard } from './mapToActionCard';

export function buildTodayActionQueue(
  sources: RawActionSource[],
  now: Date,
  currentStaffId?: string
): ActionCard[] {
  const activeSources = sources.filter((s) => !s.isCompleted);

  const scoredItems = activeSources.map((source) => {
    const priority = scoreActionPriority(source);
    const { score, isOverdue } = calculateUrgency(
      source.targetTime,
      now,
      source.slaMinutes
    );

    return {
      ...source,
      priority,
      urgencyScore: score,
      isOverdue,
    };
  });

  const sortedItems = sortActionQueue(scoredItems, currentStaffId);

  return sortedItems.map(mapToActionCard);
}
