/**
 * Handoff Action Event Logger — Observability for Handoff Workflow
 *
 * Structured event logging for Handoff module.
 * Uses existing `auditLog` for console output and `persistentLogger` for error persistence.
 *
 * ADR-004: Handoff Observability Fortification
 * - 4 public functions, minimal API surface
 * - PII policy: `changedByAccount` OK, display names excluded
 * - Fire-and-forget: logger failures never throw
 */
import { auditLog } from '@/lib/debugLogger';
import { persistentLogger } from '@/lib/persistentLogger';

const NS = 'handoff';

// ── Event types ──

export type HandoffCreatedEvent = {
  event: 'handoff.created';
  id: number;
  category: string;
  severity: string;
  changedByAccount: string;
  source: string;
};

export type HandoffStatusChangedEvent = {
  event: 'handoff.status_changed';
  id: number;
  oldStatus: string;
  newStatus: string;
  meetingMode: string;
  changedByAccount: string;
  source: string;
};

export type HandoffWorkflowBlockedEvent = {
  event: 'handoff.workflow_blocked';
  id: number;
  attemptedAction: string;
  meetingMode: string;
  reason: 'state_guard' | 'di_not_provided';
};

export type HandoffAuditPersistFailedEvent = {
  event: 'handoff.audit_persist_failed';
  handoffId: number;
  action: 'creation' | 'status_change';
  errorClass: AuditPersistErrorClass;
  message: string;
};

// ── Error classification ──

export type AuditPersistErrorClass =
  | 'audit_persist_network'
  | 'audit_persist_storage'
  | 'audit_persist_unknown';

export function classifyAuditPersistError(err: unknown): AuditPersistErrorClass {
  // Network / fetch errors
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return 'audit_persist_network';
  }
  // localStorage quota or access errors
  if (err instanceof DOMException) {
    return 'audit_persist_storage';
  }
  return 'audit_persist_unknown';
}

// ── Logging functions ──

/**
 * Log a successful handoff creation.
 * Called after optimistic update succeeds.
 * PII excluded: no display names.
 */
export function logHandoffCreated(
  payload: Omit<HandoffCreatedEvent, 'event'>,
): void {
  try {
    const event: HandoffCreatedEvent = { event: 'handoff.created', ...payload };
    auditLog.info(NS, event.event, event);
  } catch {
    // fire-and-forget: never throw
  }
}

/**
 * Log a successful status transition.
 * Called after optimistic update + API write succeeds.
 * PII excluded: no display names.
 */
export function logStatusChanged(
  payload: Omit<HandoffStatusChangedEvent, 'event'>,
): void {
  try {
    const event: HandoffStatusChangedEvent = { event: 'handoff.status_changed', ...payload };
    auditLog.info(NS, event.event, event);
  } catch {
    // fire-and-forget: never throw
  }
}

/**
 * Log a workflow action blocked by state guard or missing DI.
 * Replaces `console.warn` in useHandoffTimelineViewModel.ts.
 */
export function logWorkflowBlocked(
  payload: Omit<HandoffWorkflowBlockedEvent, 'event'>,
): void {
  try {
    const event: HandoffWorkflowBlockedEvent = { event: 'handoff.workflow_blocked', ...payload };
    auditLog.warn(NS, event.event, event);
  } catch {
    // fire-and-forget: never throw
  }
}

/**
 * Log a fire-and-forget audit persistence failure.
 * Replaces `catch(e => console.warn(...))` in useHandoffTimeline.ts.
 * Writes to both console (auditLog) and localStorage (persistentLogger).
 */
export function logAuditPersistFailed(
  payload: Omit<HandoffAuditPersistFailedEvent, 'event'>,
): void {
  try {
    const event: HandoffAuditPersistFailedEvent = { event: 'handoff.audit_persist_failed', ...payload };
    auditLog.error(NS, event.event, event);
    persistentLogger.error(
      new Error(`[${event.errorClass}] ${event.message}`),
      'HandoffAuditPersist',
    );
  } catch {
    // fire-and-forget: never throw
  }
}
