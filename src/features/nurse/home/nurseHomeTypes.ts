/**
 * Nurse Home Dashboard — Types
 * Extracted from NurseHomeDashboard.tsx.
 */

export type Priority = 'high' | 'medium' | 'low';
export type RecipientTag = '@次回自分' | '@生活支援員' | '@管理者';
export type RecipientFilter = RecipientTag | 'all';
export type PriorityFilter = Priority | 'all';

export type TaskSeed = {
  id: string;
  resident: string;
  summary: string;
  tags: string[];
  priority: Priority;
  dueMinutes: number;
  recipient: RecipientTag;
  timelineRef: string;
};

export type TaskState = TaskSeed & {
  unread: boolean;
  resolved: boolean;
};

export type TimelineEntry = {
  id: string;
  phase: string;
  time: string;
  supportLog: string;
  nurseFocus: string;
  severity: 'danger' | 'warn' | 'info';
  taskId?: string;
  tag?: RecipientTag;
};

export type InstructionDiff = {
  id: string;
  item: string;
  previous: string;
  updated: string;
  effective: string;
  note: string;
  priority: Priority;
};

export type IntegrationStatus = {
  id: string;
  label: string;
  detail: string;
  status: 'ok' | 'pending';
};

export const priorityMeta: Record<Priority, { label: string; color: string; bg: string }> = {
  high: { label: '高', color: '#B91C1C', bg: 'rgba(239,68,68,0.12)' },
  medium: { label: '中', color: '#B45309', bg: 'rgba(245,158,11,0.12)' },
  low: { label: '低', color: '#0F766E', bg: 'rgba(15,118,110,0.12)' },
};

export const formatDueLabel = (minutes: number) => {
  if (minutes <= 0) return '期限超過';
  if (minutes < 60) return `あと${minutes}分`;
  if (minutes < 180) return `あと${Math.round(minutes / 60)}時間以内`;
  if (minutes < 1440) return `今日中 (${Math.floor(minutes / 60)}h)`;
  return '明日以降';
};

export const severityColor = (severity: TimelineEntry['severity']) => {
  if (severity === 'danger') return '#EF4444';
  if (severity === 'warn') return '#F59E0B';
  return '#2563EB';
};

export const severityBackground = (severity: TimelineEntry['severity']) => {
  if (severity === 'danger') return 'rgba(239,68,68,0.08)';
  if (severity === 'warn') return 'rgba(245,158,11,0.08)';
  return 'rgba(37,99,235,0.08)';
};
