import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordAudit, OrchestratorFailureKind } from '../auditLogger';

describe('auditLogger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('成功時のログが正しい形式で出力されること', () => {
    recordAudit({
      action: 'TEST_ACTION',
      targetId: '123',
      status: 'SUCCESS',
      durationMs: 100,
      metadata: { key: 'value' }
    });

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[AUDIT]'),
      expect.objectContaining({ key: 'value' })
    );
  });

  it('失敗時のログが FailureKind とともに警告出力されること', () => {
    recordAudit({
      action: 'TEST_ACTION',
      targetId: '123',
      status: 'FAILURE',
      durationMs: 50,
      error: {
        kind: OrchestratorFailureKind.CONFLICT,
        message: 'Conflict occurred'
      }
    });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('FAILED: CONFLICT - Conflict occurred'),
      expect.objectContaining({ durationMs: 50 })
    );
  });
});
