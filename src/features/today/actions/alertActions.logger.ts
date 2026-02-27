/**
 * Alert Action Event Logger — Observability for Briefing Actions
 *
 * Structured event logging for /today Execution Layer.
 * Uses existing `auditLog` for console output and `persistentLogger` for error persistence.
 *
 * @skill @observability-engineer
 * @see docs/ai-skills-protocol.md §5 Evidence Pack
 */
import { auditLog } from '@/lib/debugLogger';
import { persistentLogger } from '@/lib/persistentLogger';
import type { ActionStatus } from './alertActions.types';

const NS = 'today';

// --- Event types ---

export type BriefingActionEvent = {
  event: 'today.briefing_action';
  ymd: string;
  alertType: string;
  userId: string;
  actionId: string;
  prevStatus: ActionStatus;
  nextStatus: ActionStatus;
  source: string;
};

export type BriefingActionErrorEvent = {
  event: 'today.briefing_action_error';
  ymd: string;
  alertType: string;
  userId: string;
  actionId: string;
  errorClass: 'persist_failed_quota' | 'persist_failed_parse' | 'persist_failed_unknown';
  message: string;
};

// --- Error classification ---

export function classifyStorageError(err: unknown): BriefingActionErrorEvent['errorClass'] {
  if (err instanceof DOMException && err.name === 'QuotaExceededError') {
    return 'persist_failed_quota';
  }
  if (err instanceof SyntaxError) {
    return 'persist_failed_parse';
  }
  return 'persist_failed_unknown';
}

// --- Logging functions ---

/**
 * Log a successful briefing action.
 * Called after state transition completes.
 * Does NOT include PII (userName is excluded, only userId).
 */
export function logBriefingAction(payload: Omit<BriefingActionEvent, 'event'>): void {
  const event: BriefingActionEvent = { event: 'today.briefing_action', ...payload };
  auditLog.info(NS, event.event, event);
}

/**
 * Log a failed briefing action (storage persistence failure).
 * Writes to both console (auditLog) and localStorage (persistentLogger).
 */
export function logBriefingActionError(
  payload: Omit<BriefingActionErrorEvent, 'event'>,
): void {
  const event: BriefingActionErrorEvent = { event: 'today.briefing_action_error', ...payload };
  auditLog.error(NS, event.event, event);
  persistentLogger.error(
    new Error(`[${event.errorClass}] ${event.message}`),
    'BriefingActionList',
  );
}
