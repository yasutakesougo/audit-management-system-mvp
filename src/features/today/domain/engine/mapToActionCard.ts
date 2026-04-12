import type { ActionCard, ActionType, ScoredActionItem } from '../models/queue.types';
import { summarizeEvidence } from '../../../action-engine/domain/summarizeEvidence';
import type { ActionSuggestion } from '../../../action-engine/domain/types';

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
    case 'corrective_action':
    case 'plan_patch':
      return 'NAVIGATE';
    case 'schedule':
      return 'OPEN_DRAWER';
    case 'handoff':
    case 'exception':
      return 'OPEN_DRAWER';
    default: {
      const _exhaustive: never = item.sourceType;
      return _exhaustive;
    }
  }
}

function buildContextMessage(item: ScoredActionItem): string {
  // corrective_action: evidence から要約を生成
  if (item.sourceType === 'corrective_action') {
    const payload = item.payload as { suggestion?: ActionSuggestion } | undefined;
    if (payload?.suggestion?.evidence) {
      return summarizeEvidence(payload.suggestion.evidence);
    }
    return '改善提案';
  }

  if (item.sourceType === 'plan_patch') {
    const payload = item.payload as { dueAt?: string; status?: string } | undefined;
    if (payload?.dueAt) {
      return item.isOverdue
        ? `更新期限 ${payload.dueAt.slice(0, 10)} / 対応遅延`
        : `更新期限 ${payload.dueAt.slice(0, 10)}`;
    }
    return `状態: ${payload?.status ?? 'needs_update'}`;
  }

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
