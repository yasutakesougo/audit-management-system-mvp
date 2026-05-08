import {
  computeNextReassessmentDueDate,
  daysUntilReassessment,
  DEFAULT_REASSESSMENT_CYCLE_DAYS,
} from './planningSheetReassessment';

export type MonitoringDeadlineStatus =
  | 'normal'
  | 'warning'
  | 'critical'
  | 'dueToday'
  | 'overdue'
  | 'unknown'
  | 'invalid';

export type MonitoringDeadlineState = {
  nextDueDate: string | null;
  remainingDays: number | null;
  status: MonitoringDeadlineStatus;
};

function isValidDateString(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function computeMonitoringDeadlineFromSupportStart(
  monitoringBaseDate: string | null | undefined,
  today?: string,
): MonitoringDeadlineState {
  if (!monitoringBaseDate) {
    return { nextDueDate: null, remainingDays: null, status: 'unknown' };
  }

  if (!isValidDateString(monitoringBaseDate)) {
    return { nextDueDate: null, remainingDays: null, status: 'invalid' };
  }

  const nextDueDate = computeNextReassessmentDueDate(
    monitoringBaseDate,
    DEFAULT_REASSESSMENT_CYCLE_DAYS,
  );
  const remainingDays = daysUntilReassessment(nextDueDate, today);

  if (remainingDays === null) {
    return { nextDueDate, remainingDays: null, status: 'invalid' };
  }

  if (remainingDays < 0) {
    return { nextDueDate, remainingDays, status: 'overdue' };
  }
  if (remainingDays === 0) {
    return { nextDueDate, remainingDays, status: 'dueToday' };
  }
  if (remainingDays <= 14) {
    return { nextDueDate, remainingDays, status: 'critical' };
  }
  if (remainingDays <= 30) {
    return { nextDueDate, remainingDays, status: 'warning' };
  }
  return { nextDueDate, remainingDays, status: 'normal' };
}

