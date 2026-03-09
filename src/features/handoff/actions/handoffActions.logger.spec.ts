/**
 * handoffActions.logger — Event name, error classification, PII guard, fire-and-forget tests
 *
 * ADR-004: Handoff Observability Fortification
 *
 * Focus areas (per user spec):
 *  1. 正しい event name が出る
 *  2. errorClass が正しく分類される
 *  3. persistentLogger / auditLog 呼び出しが行われる
 *  4. logger 自体の失敗が throw しない
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted ensures these survive vi.mock hoisting
const { mockAuditInfo, mockAuditWarn, mockAuditError, mockPersistentError } = vi.hoisted(() => ({
  mockAuditInfo: vi.fn(),
  mockAuditWarn: vi.fn(),
  mockAuditError: vi.fn(),
  mockPersistentError: vi.fn(),
}));

vi.mock('@/lib/debugLogger', () => ({
  auditLog: {
    info: mockAuditInfo,
    warn: mockAuditWarn,
    error: mockAuditError,
    debug: vi.fn(),
    enabled: false,
  },
}));

vi.mock('@/lib/persistentLogger', () => ({
  persistentLogger: {
    error: mockPersistentError,
    getLogs: vi.fn(() => []),
    clear: vi.fn(),
  },
}));

import {
    classifyAuditPersistError,
    logAuditPersistFailed,
    logHandoffCreated,
    logStatusChanged,
    logWorkflowBlocked,
} from './handoffActions.logger';

// ── Test helpers ──

function createdPayload(overrides?: Record<string, unknown>) {
  return {
    id: 42,
    category: '体調',
    severity: '高',
    changedByAccount: 'taro@example.com',
    source: 'CompactNewHandoffInput',
    ...overrides,
  };
}

function statusPayload(overrides?: Record<string, unknown>) {
  return {
    id: 42,
    oldStatus: '未対応',
    newStatus: '確認済',
    meetingMode: 'evening',
    changedByAccount: 'taro@example.com',
    source: 'HandoffItem',
    ...overrides,
  };
}

function blockedPayload(overrides?: Record<string, unknown>) {
  return {
    id: 42,
    attemptedAction: 'markReviewed',
    meetingMode: 'normal',
    reason: 'state_guard' as const,
    ...overrides,
  };
}

function auditFailPayload(overrides?: Record<string, unknown>) {
  return {
    handoffId: 42,
    action: 'creation' as const,
    errorClass: 'audit_persist_network' as const,
    message: 'fetch failed',
    ...overrides,
  };
}

// ── classifyAuditPersistError ──

describe('classifyAuditPersistError', () => {
  it('classifies TypeError with "fetch" as audit_persist_network', () => {
    expect(classifyAuditPersistError(new TypeError('Failed to fetch'))).toBe('audit_persist_network');
  });

  it('classifies TypeError with "network" as audit_persist_network', () => {
    expect(classifyAuditPersistError(new TypeError('NetworkError'))).toBe('audit_persist_network');
  });

  it('classifies DOMException as audit_persist_storage', () => {
    expect(classifyAuditPersistError(new DOMException('Quota exceeded', 'QuotaExceededError'))).toBe('audit_persist_storage');
  });

  it('classifies DOMException (any name) as audit_persist_storage', () => {
    expect(classifyAuditPersistError(new DOMException('Security', 'SecurityError'))).toBe('audit_persist_storage');
  });

  it('classifies unknown errors as audit_persist_unknown', () => {
    expect(classifyAuditPersistError(new Error('random'))).toBe('audit_persist_unknown');
    expect(classifyAuditPersistError('string error')).toBe('audit_persist_unknown');
    expect(classifyAuditPersistError(null)).toBe('audit_persist_unknown');
    expect(classifyAuditPersistError(undefined)).toBe('audit_persist_unknown');
  });
});

// ── logHandoffCreated ──

describe('logHandoffCreated', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits correct event name via auditLog.info', () => {
    logHandoffCreated(createdPayload());
    expect(mockAuditInfo).toHaveBeenCalledWith(
      'handoff',
      'handoff.created',
      expect.objectContaining({ event: 'handoff.created', id: 42 }),
    );
  });

  it('does NOT include PII (display names)', () => {
    logHandoffCreated(createdPayload());
    const logged = mockAuditInfo.mock.calls[0][2];
    expect(logged).not.toHaveProperty('userName');
    expect(logged).not.toHaveProperty('userDisplayName');
    expect(logged).not.toHaveProperty('changedBy');
    expect(logged).toHaveProperty('changedByAccount');
  });
});

// ── logStatusChanged ──

describe('logStatusChanged', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits correct event name via auditLog.info', () => {
    logStatusChanged(statusPayload());
    expect(mockAuditInfo).toHaveBeenCalledWith(
      'handoff',
      'handoff.status_changed',
      expect.objectContaining({
        event: 'handoff.status_changed',
        oldStatus: '未対応',
        newStatus: '確認済',
      }),
    );
  });

  it('does NOT include PII', () => {
    logStatusChanged(statusPayload());
    const logged = mockAuditInfo.mock.calls[0][2];
    expect(logged).not.toHaveProperty('userName');
    expect(logged).not.toHaveProperty('changedBy');
  });
});

// ── logWorkflowBlocked ──

describe('logWorkflowBlocked', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits correct event name via auditLog.warn', () => {
    logWorkflowBlocked(blockedPayload());
    expect(mockAuditWarn).toHaveBeenCalledWith(
      'handoff',
      'handoff.workflow_blocked',
      expect.objectContaining({
        event: 'handoff.workflow_blocked',
        reason: 'state_guard',
      }),
    );
  });

  it('supports di_not_provided reason', () => {
    logWorkflowBlocked(blockedPayload({ reason: 'di_not_provided' }));
    const logged = mockAuditWarn.mock.calls[0][2];
    expect(logged.reason).toBe('di_not_provided');
  });
});

// ── logAuditPersistFailed ──

describe('logAuditPersistFailed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls both auditLog.error and persistentLogger.error', () => {
    logAuditPersistFailed(auditFailPayload());

    expect(mockAuditError).toHaveBeenCalledWith(
      'handoff',
      'handoff.audit_persist_failed',
      expect.objectContaining({ errorClass: 'audit_persist_network' }),
    );
    expect(mockPersistentError).toHaveBeenCalledWith(
      expect.any(Error),
      'HandoffAuditPersist',
    );
  });

  it('includes errorClass in persisted error message', () => {
    logAuditPersistFailed(auditFailPayload({ errorClass: 'audit_persist_storage', message: 'quota full' }));
    const persistedError = mockPersistentError.mock.calls[0][0] as Error;
    expect(persistedError.message).toContain('audit_persist_storage');
    expect(persistedError.message).toContain('quota full');
  });

  it('does NOT include PII in error event', () => {
    logAuditPersistFailed(auditFailPayload());
    const logged = mockAuditError.mock.calls[0][2];
    expect(logged).not.toHaveProperty('userName');
    expect(logged).not.toHaveProperty('changedBy');
  });
});

// ── Fire-and-forget safety ──

describe('fire-and-forget safety', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logHandoffCreated does not throw when auditLog throws', () => {
    mockAuditInfo.mockImplementation(() => { throw new Error('boom'); });
    expect(() => logHandoffCreated(createdPayload())).not.toThrow();
  });

  it('logStatusChanged does not throw when auditLog throws', () => {
    mockAuditInfo.mockImplementation(() => { throw new Error('boom'); });
    expect(() => logStatusChanged(statusPayload())).not.toThrow();
  });

  it('logWorkflowBlocked does not throw when auditLog throws', () => {
    mockAuditWarn.mockImplementation(() => { throw new Error('boom'); });
    expect(() => logWorkflowBlocked(blockedPayload())).not.toThrow();
  });

  it('logAuditPersistFailed does not throw when auditLog throws', () => {
    mockAuditError.mockImplementation(() => { throw new Error('boom'); });
    expect(() => logAuditPersistFailed(auditFailPayload())).not.toThrow();
  });
});
