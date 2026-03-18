import type { ActionCard, ActionType, ScoredActionItem } from '../models/queue.types';

function formatTime(date?: Date): string {
  if (!date) return '時刻指定なし';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function resolveActionType(item: ScoredActionItem): ActionType {
  switch (item.sourceType) {
    case 'vital_alert':
      return 'ACKNOWLEDGE';
    case 'incident':
      return 'NAVIGATE';
    case 'schedule':
      return 'OPEN_DRAWER';
    case 'handoff':
      return 'OPEN_DRAWER';
    default: {
      const _exhaustive: never = item.sourceType;
      return _exhaustive;
    }
  }
}

function buildContextMessage(item: ScoredActionItem): string {
  const base = item.targetTime
    ? `${formatTime(item.targetTime)}予定`
    : '時刻指定なし';

  if (item.isOverdue) {
    const sla = item.slaMinutes ?? 0;
    return `${base} / SLA超過+${sla}分`;
  }

  return base;
}

export function mapToActionCard(item: ScoredActionItem): ActionCard {
  const requiresAttention =
    item.priority === 'P0' ||
    item.priority === 'P1' ||
    item.isOverdue ||
    item.urgencyScore >= 120;

  return {
    id: item.id,
    priority: item.priority,
    title: item.title,
    contextMessage: buildContextMessage(item),
    actionType: resolveActionType(item),
    requiresAttention,
    isOverdue: item.isOverdue,
    payload: item.payload,
  };
}
