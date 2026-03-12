/**
 * TodayEngine — Pure task aggregation for Today Operations
 *
 * Phase 3 #1 (#824)
 *
 * Aggregates tasks from multiple sources (unrecorded, handoff, briefing,
 * schedule, etc.) into a unified priority-sorted list.
 *
 * All functions are pure — no React hooks, no side effects.
 */

// ─── Types ───────────────────────────────────────────────────────────────

/** Task source categories with associated priority weights */
export type TodayTaskSource =
  | 'unrecorded'
  | 'handoff'
  | 'briefing'
  | 'deadline'
  | 'schedule'
  | 'routine';

/** Priority constants by source */
export const TASK_PRIORITY: Record<TodayTaskSource, number> = {
  unrecorded: 100,
  handoff: 90,
  briefing: 80,
  deadline: 70,
  schedule: 60,
  routine: 40,
} as const;

/** Action type determines UI behavior on task tap */
export type TodayTaskActionType = 'quickRecord' | 'navigate' | 'info';

export interface TodayTask {
  /** Unique task identifier */
  id: string;
  /** Associated user ID (for dedup) */
  userId: string;
  /** Human-readable label */
  label: string;
  /** Task source category */
  source: TodayTaskSource;
  /** Numeric priority (higher = more urgent) */
  priority: number;
  /** Optional due time for sub-sorting (ISO string or HH:mm) */
  dueTime?: string;
  /** Action on tap */
  actionType: TodayTaskActionType;
  /** Navigation route (when actionType = 'navigate') */
  route?: string;
  /** Whether the task is completed */
  completed: boolean;
}

export interface TodayEngineInput {
  /** User IDs with pending daily records */
  pendingUserIds: string[];
  /** Briefing alerts for today */
  briefingAlerts: Array<{
    id: string;
    userId: string;
    label: string;
    dueTime?: string;
  }>;
  /** Schedule items for today */
  scheduleLanes: Array<{
    id: string;
    title: string;
    time: string;
    category?: string;
  }>;
  /** Unhandled handoff items */
  handoffItems: Array<{
    id: string;
    userId: string;
    label: string;
    dueTime?: string;
  }>;
  /** Optional: user name resolver */
  resolveUserName?: (userId: string) => string;
}

export interface TodayTaskSummary {
  total: number;
  completed: number;
  remaining: number;
}

export interface FocusTask {
  task: TodayTask;
  reason: string;
}

/** Safety cap to prevent runaway lists */
export const MAX_TASKS = 200;

// ─── Core Functions ──────────────────────────────────────────────────────

/**
 * Build a unified task list from all sources, sorted by priority.
 *
 * Sort order:
 * 1. priority descending (higher = more urgent)
 * 2. dueTime ascending (earlier = first)
 */
export function buildTodayTasks(input: TodayEngineInput): TodayTask[] {
  const { pendingUserIds, briefingAlerts, scheduleLanes, handoffItems, resolveUserName } = input;
  const nameOf = resolveUserName ?? ((id: string) => id);

  const tasks: TodayTask[] = [];

  // 1. Unrecorded users → quickRecord
  for (const userId of pendingUserIds) {
    tasks.push({
      id: `unrecorded-${userId}`,
      userId,
      label: `${nameOf(userId)}の記録が未完了`,
      source: 'unrecorded',
      priority: TASK_PRIORITY.unrecorded,
      actionType: 'quickRecord',
      completed: false,
    });
  }

  // 2. Handoff items → navigate
  for (const item of handoffItems) {
    tasks.push({
      id: `handoff-${item.id}`,
      userId: item.userId,
      label: item.label,
      source: 'handoff',
      priority: TASK_PRIORITY.handoff,
      dueTime: item.dueTime,
      actionType: 'navigate',
      route: '/handoff',
      completed: false,
    });
  }

  // 3. Briefing alerts → info
  for (const alert of briefingAlerts) {
    tasks.push({
      id: `briefing-${alert.id}`,
      userId: alert.userId,
      label: alert.label,
      source: 'briefing',
      priority: TASK_PRIORITY.briefing,
      dueTime: alert.dueTime,
      actionType: 'info',
      completed: false,
    });
  }

  // 4. Schedule items → navigate
  for (const lane of scheduleLanes) {
    tasks.push({
      id: `schedule-${lane.id}`,
      userId: '',
      label: lane.title,
      source: 'schedule',
      priority: TASK_PRIORITY.schedule,
      dueTime: lane.time,
      actionType: 'navigate',
      route: '/schedules',
      completed: false,
    });
  }

  // Safety cap
  if (tasks.length > MAX_TASKS) {
    console.warn(
      `[TodayEngine] Task count (${tasks.length}) exceeds MAX_TASKS (${MAX_TASKS}). Truncating.`,
    );
  }

  // Sort: priority desc, then dueTime asc
  const sorted = tasks.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime);
    if (a.dueTime) return -1;
    if (b.dueTime) return 1;
    return 0;
  });

  return sorted.slice(0, MAX_TASKS);
}

/**
 * Deduplicate tasks by userId.
 * When the same user appears in multiple sources, keep the one
 * with the highest priority.
 *
 * Tasks with empty userId (e.g. schedule) are never deduped.
 */
export function dedupeTasks(tasks: TodayTask[]): TodayTask[] {
  const seen = new Map<string, TodayTask>();
  const result: TodayTask[] = [];

  for (const task of tasks) {
    // No userId → always keep
    if (!task.userId) {
      result.push(task);
      continue;
    }

    const existing = seen.get(task.userId);
    if (!existing) {
      seen.set(task.userId, task);
      result.push(task);
    } else if (task.priority > existing.priority) {
      // Replace: remove old, add new
      const idx = result.indexOf(existing);
      if (idx >= 0) result.splice(idx, 1);
      seen.set(task.userId, task);
      result.push(task);
    }
    // else: keep existing (higher or equal priority)
  }

  return result;
}

/**
 * Summarize task completion status.
 */
export function summarizeTasks(tasks: TodayTask[]): TodayTaskSummary {
  const completed = tasks.filter((t) => t.completed).length;
  return {
    total: tasks.length,
    completed,
    remaining: tasks.length - completed,
  };
}

/**
 * Pick the single most urgent task as the "focus task".
 *
 * Returns null when the list is empty.
 * Selects the first non-completed task (list is already priority-sorted).
 */
export function pickFocusTask(tasks: TodayTask[]): FocusTask | null {
  const incomplete = tasks.filter((t) => !t.completed);
  if (incomplete.length === 0) return null;

  const task = incomplete[0];

  const sourceLabels: Record<TodayTaskSource, string> = {
    unrecorded: '未記録の対応',
    handoff: '申し送りの確認',
    briefing: 'ブリーフィング事項',
    deadline: '期限が迫っています',
    schedule: '予定への対応',
    routine: '定常タスク',
  };

  return {
    task,
    reason: `最優先: ${sourceLabels[task.source]}（${task.label}）`,
  };
}
