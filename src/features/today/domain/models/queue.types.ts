export type ActionPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type ActionSourceType =
  | 'schedule'
  | 'vital_alert'
  | 'handoff'
  | 'incident'
  | 'corrective_action'
  | 'exception'
  | 'plan_patch'
  | 'isp_renew_suggest';

export interface RawActionSource {
  id: string;
  sourceType: ActionSourceType;
  title: string;
  targetTime?: Date;
  slaMinutes?: number;
  isCompleted: boolean;
  assignedStaffId?: string;
  payload: unknown;
}

export interface ScoredActionItem extends RawActionSource {
  priority: ActionPriority;
  urgencyScore: number;
  isOverdue: boolean;
}

export type ActionType = 'OPEN_DRAWER' | 'NAVIGATE' | 'ACKNOWLEDGE';

export interface ActionCard {
  id: string;
  priority: ActionPriority;
  title: string;
  contextMessage: string;
  actionType: ActionType;
  requiresAttention: boolean;
  isOverdue: boolean;
  payload: unknown;
}
