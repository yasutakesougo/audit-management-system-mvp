/**
 * alertActions.logger — Error classification & PII guard tests
 *
 * @skill @testing-patterns @error-handling-patterns @observability-engineer
 * @sprint Night Autonomous Sprint (Fortress Safe Mode)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted ensures these survive vi.mock hoisting
const { mockAuditInfo, mockAuditError, mockPersistentError } = vi.hoisted(() => ({
  mockAuditInfo: vi.fn(),
  mockAuditError: vi.fn(),
  mockPersistentError: vi.fn(),
}));

vi.mock('@/lib/debugLogger', () => ({
  auditLog: {
    info: mockAuditInfo,
    error: mockAuditError,
    debug: vi.fn(),
    warn: vi.fn(),
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
    classifyStorageError,
    logBriefingAction,
    logBriefingActionError,
} from './alertActions.logger';
import type { ActionStatus } from './alertActions.types';

// --- Factories (@testing-patterns: factory pattern) ---

function getMockActionPayload(overrides?: Record<string, unknown>) {
  return {
    ymd: '2026-02-28',
    alertType: 'absent',
    userId: 'user-001',
    actionId: 'contact-confirm',
    prevStatus: 'todo' as ActionStatus,
    nextStatus: 'done' as ActionStatus,
    source: 'BriefingActionList',
    ...overrides,
  };
}

function getMockErrorPayload(overrides?: Record<string, unknown>) {
  return {
    ymd: '2026-02-28',
    alertType: 'absent',
    userId: 'user-001',
    actionId: 'done',
    errorClass: 'persist_failed_quota' as const,
    message: 'QuotaExceededError',
    ...overrides,
  };
}

// --- Tests ---

describe('classifyStorageError', () => {
  it('classifies QuotaExceededError as persist_failed_quota', () => {
    const err = new DOMException('Storage full', 'QuotaExceededError');
    expect(classifyStorageError(err)).toBe('persist_failed_quota');
  });

  it('classifies SyntaxError as persist_failed_parse', () => {
    const err = new SyntaxError('Unexpected token');
    expect(classifyStorageError(err)).toBe('persist_failed_parse');
  });

  it('classifies unknown errors as persist_failed_unknown', () => {
    expect(classifyStorageError(new TypeError('oops'))).toBe('persist_failed_unknown');
    expect(classifyStorageError('string error')).toBe('persist_failed_unknown');
    expect(classifyStorageError(null)).toBe('persist_failed_unknown');
    expect(classifyStorageError(undefined)).toBe('persist_failed_unknown');
  });

  it('distinguishes DOMException without QuotaExceededError name', () => {
    const err = new DOMException('Other error', 'NotFoundError');
    expect(classifyStorageError(err)).toBe('persist_failed_unknown');
  });
});

describe('logBriefingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls auditLog.info with correct event structure', () => {
    const payload = getMockActionPayload();
    logBriefingAction(payload);

    expect(mockAuditInfo).toHaveBeenCalledWith(
      'today',
      'today.briefing_action',
      expect.objectContaining({
        event: 'today.briefing_action',
        ymd: '2026-02-28',
        alertType: 'absent',
        userId: 'user-001',
        actionId: 'contact-confirm',
        prevStatus: 'todo',
        nextStatus: 'done',
        source: 'BriefingActionList',
      }),
    );
  });

  it('does NOT include userName (PII guard)', () => {
    const payload = getMockActionPayload();
    logBriefingAction(payload);

    const loggedEvent = mockAuditInfo.mock.calls[0][2];
    expect(loggedEvent).not.toHaveProperty('userName');
    expect(loggedEvent).not.toHaveProperty('email');
    expect(loggedEvent).not.toHaveProperty('name');
    expect(loggedEvent).not.toHaveProperty('loginUserKey');
  });
});

describe('logBriefingActionError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls auditLog.error and persistentLogger.error', () => {
    const payload = getMockErrorPayload();
    logBriefingActionError(payload);

    expect(mockAuditError).toHaveBeenCalledWith(
      'today',
      'today.briefing_action_error',
      expect.objectContaining({
        event: 'today.briefing_action_error',
        errorClass: 'persist_failed_quota',
      }),
    );
    expect(mockPersistentError).toHaveBeenCalledWith(
      expect.any(Error),
      'BriefingActionList',
    );
  });

  it('includes error class in persisted error message', () => {
    const payload = getMockErrorPayload({ errorClass: 'persist_failed_parse', message: 'bad json' });
    logBriefingActionError(payload);

    const persistedError = mockPersistentError.mock.calls[0][0] as Error;
    expect(persistedError.message).toContain('persist_failed_parse');
    expect(persistedError.message).toContain('bad json');
  });

  it('does NOT include PII in error event', () => {
    const payload = getMockErrorPayload();
    logBriefingActionError(payload);

    const loggedEvent = mockAuditError.mock.calls[0][2];
    expect(loggedEvent).not.toHaveProperty('userName');
    expect(loggedEvent).not.toHaveProperty('email');
    expect(loggedEvent).not.toHaveProperty('name');
  });
});
