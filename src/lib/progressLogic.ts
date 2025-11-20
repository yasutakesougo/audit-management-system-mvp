/**
 * Dashboard Progress Tracking Logic
 *
 * Handles all progress calculation, handoff timeline management,
 * and completion tracking across dashboard components.
 */

export interface TaskProgress {
  completed: number;
  total: number;
  percentage: number;
}

export interface HandoffItem {
  id: string;
  title: string;
  assignee: string;
  dueDate: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
}

export interface TeamProgress {
  teamName: string;
  attendance: TaskProgress;
  tasks: TaskProgress;
  overall: TaskProgress;
}

/**
 * Calculates completion percentage with error handling
 */
export const calculateProgress = (completed: number, total: number): TaskProgress => {
  const safeCompleted = Math.max(0, completed);
  const safeTotal = Math.max(1, total); // Prevent division by zero

  const percentage = Math.round((safeCompleted / safeTotal) * 100);

  return {
    completed: safeCompleted,
    total: safeTotal,
    percentage: Math.min(100, percentage) // Cap at 100%
  };
};

/**
 * Aggregates progress across multiple categories
 */
export const aggregateTeamProgress = (
  attendanceData: { present: number; total: number },
  taskData: { completed: number; total: number }
): TeamProgress => {
  const attendance = calculateProgress(attendanceData.present, attendanceData.total);
  const tasks = calculateProgress(taskData.completed, taskData.total);

  // Overall progress weighted average
  const overallCompleted = (attendance.completed + tasks.completed);
  const overallTotal = (attendance.total + tasks.total);
  const overall = calculateProgress(overallCompleted, overallTotal);

  return {
    teamName: 'チーム全体',
    attendance,
    tasks,
    overall
  };
};

/**
 * Handoff timeline status calculation
 */
export const calculateHandoffStatus = (handoff: HandoffItem): HandoffItem => {
  const now = new Date();
  const dueDate = new Date(handoff.dueDate);

  let status = handoff.status;

  // Auto-update status based on time
  if (status !== 'completed' && dueDate < now) {
    status = 'overdue';
  }

  return { ...handoff, status };
};

/**
 * Sorts handoffs by priority and due date
 */
export const sortHandoffsByUrgency = (handoffs: HandoffItem[]): HandoffItem[] => {
  return handoffs
    .map(calculateHandoffStatus)
    .sort((a, b) => {
      // Status priority: overdue > in-progress > pending > completed
      const statusOrder = { 'overdue': 0, 'in-progress': 1, 'pending': 2, 'completed': 3 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;

      // Priority: high > medium > low
      const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Due date: earlier first
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
};

/**
 * Progress color coding for UI display
 */
export const getProgressColor = (percentage: number): string => {
  if (percentage >= 90) return 'success.main';
  if (percentage >= 75) return 'info.main';
  if (percentage >= 50) return 'warning.main';
  return 'error.main';
};

/**
 * Progress status text generation
 */
export const getProgressStatusText = (progress: TaskProgress): string => {
  const { completed, total, percentage } = progress;

  if (percentage === 100) {
    return `✅ 完了 (${completed}/${total})`;
  } else if (percentage >= 75) {
    return `🎯 順調 ${percentage}% (${completed}/${total})`;
  } else if (percentage >= 50) {
    return `⚠️ 注意 ${percentage}% (${completed}/${total})`;
  } else {
    return `🚨 要確認 ${percentage}% (${completed}/${total})`;
  }
};

/**
 * Daily progress summary calculation
 */
export interface DailyProgressSummary {
  date: string;
  totalTasks: number;
  completedTasks: number;
  attendanceRate: number;
  overallScore: number;
  trending: 'up' | 'down' | 'stable';
}

export const calculateDailyProgress = (
  taskProgress: TaskProgress,
  attendanceProgress: TaskProgress,
  previousDay?: DailyProgressSummary
): DailyProgressSummary => {
  const overallScore = Math.round(
    (taskProgress.percentage * 0.6) + (attendanceProgress.percentage * 0.4)
  );

  let trending: 'up' | 'down' | 'stable' = 'stable';
  if (previousDay) {
    const diff = overallScore - previousDay.overallScore;
    trending = diff > 5 ? 'up' : diff < -5 ? 'down' : 'stable';
  }

  return {
    date: new Date().toISOString().split('T')[0],
    totalTasks: taskProgress.total,
    completedTasks: taskProgress.completed,
    attendanceRate: attendanceProgress.percentage,
    overallScore,
    trending
  };
};