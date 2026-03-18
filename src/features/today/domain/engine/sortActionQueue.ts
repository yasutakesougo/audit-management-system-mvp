import type { ActionPriority, ScoredActionItem } from '../models/queue.types';

const priorityWeight: Record<ActionPriority, number> = {
  P0: 4,
  P1: 3,
  P2: 2,
  P3: 1,
};

export function sortActionQueue(
  items: ScoredActionItem[],
  currentStaffId?: string
): ScoredActionItem[] {
  return [...items].sort((a, b) => {
    // 1. Priority 高い順
    const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // 2. urgencyScore 高い順
    const urgencyDiff = b.urgencyScore - a.urgencyScore;
    if (urgencyDiff !== 0) return urgencyDiff;

    // 3. currentStaffId と一致する担当を優先
    if (currentStaffId) {
      const aMatch = a.assignedStaffId === currentStaffId ? 1 : 0;
      const bMatch = b.assignedStaffId === currentStaffId ? 1 : 0;
      const staffDiff = bMatch - aMatch;
      if (staffDiff !== 0) return staffDiff;
    }

    // 4. targetTime がある場合は早い時刻を優先
    const aTime = a.targetTime?.getTime() ?? Number.POSITIVE_INFINITY;
    const bTime = b.targetTime?.getTime() ?? Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;

    // 5. 完全同点時は id 昇順で固定
    return a.id.localeCompare(b.id);
  });
}
