export interface AuditEvent {
  ts: string;            // ISO Date string
  actor: string;         // UPN or ID
  action: string;        // e.g. CREATE / UPDATE / AUTH_SIGN_IN
  entity: string;        // target entity (list name / feature)
  entity_id?: string;
  channel: 'SPO' | 'MSAL' | 'UI' | 'System';
  before?: Record<string, unknown>;          // previous state snapshot
  after?: Record<string, unknown>;           // new state snapshot
}

const AUDIT_LOG_KEY = 'audit_log_v1';
const MAX_LOGS = 500;

export const readAudit = (): AuditEvent[] => {
  try {
    const logData = localStorage.getItem(AUDIT_LOG_KEY);
    if (logData) {
      const parsed = JSON.parse(logData) as unknown;
      if (Array.isArray(parsed)) return parsed as AuditEvent[];
    }
  } catch (error) {
    console.error('Failed to read audit log from localStorage:', error);
    localStorage.removeItem(AUDIT_LOG_KEY);
  }
  return [];
};

export const pushAudit = (event: Omit<AuditEvent, 'ts'>): void => {
  const newEvent: AuditEvent = { ...event, ts: new Date().toISOString() };
  try {
    const logs = readAudit();
    logs.unshift(newEvent);
    if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to write audit log to localStorage:', error);
  }
};

export const clearAudit = (): void => {
  try {
    localStorage.removeItem(AUDIT_LOG_KEY);
  } catch (error) {
    console.error('Failed to clear audit log from localStorage:', error);
  }
};

// Retain only events whose predicate returns true (used to keep failed items after partial sync)
export const retainAuditWhere = (predicate: (ev: AuditEvent, index: number) => boolean): void => {
  try {
    const current = readAudit();
    const filtered = current.filter(predicate);
    if (filtered.length === 0) {
      localStorage.removeItem(AUDIT_LOG_KEY);
    } else {
      localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error('Failed to retain subset of audit log:', error);
  }
};

// Backward-compatible exports (in case older imports remain)
export type AuditLog = AuditEvent; // alias
export const getAuditLogs = readAudit;
export const addAuditLog = (log: AuditLog) => pushAudit({
  actor: log.actor,
  action: log.action,
  entity: log.entity,
  entity_id: log.entity_id,
  channel: log.channel,
  before: log.before,
  after: log.after
});
