import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DriftRepairDispatcher } from '../DriftRepairDispatcher';
import { trackSpEvent } from '@/lib/telemetry/spTelemetry';
import { auditLog } from '@/lib/debugLogger';

// Mock dependencies
vi.mock('@/lib/telemetry/spTelemetry', () => ({
  trackSpEvent: vi.fn(),
}));

vi.mock('@/lib/debugLogger', () => ({
  auditLog: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('DriftRepairDispatcher', () => {
  const mockSpFetch = vi.fn();
  let dispatcher: DriftRepairDispatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpFetch.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    dispatcher = new DriftRepairDispatcher(mockSpFetch);
  });

  describe('dispatch', () => {
    it('executes fix-case successfully', async () => {
      const result = await dispatcher.dispatch('fix-case', 'TestList', 'TestField');

      expect(result.success).toBe(true);
      expect(result.message).toContain('正規化しました');
      expect(result.reScanRequired).toBe(true);
      expect(trackSpEvent).toHaveBeenCalledWith('drift:repair_success', expect.objectContaining({
        listName: 'TestList',
        details: expect.objectContaining({ kind: 'fix-case', fieldName: 'TestField' })
      }));
      expect(auditLog.info).toHaveBeenCalled();
    });

    it('executes sanitize successfully', async () => {
      const result = await dispatcher.dispatch('sanitize', 'TestList', 'TestField');

      expect(result.success).toBe(true);
      expect(result.message).toContain('予約文字の影響を排除');
      expect(trackSpEvent).toHaveBeenCalledWith('drift:repair_success', expect.objectContaining({
        details: expect.objectContaining({ kind: 'sanitize' })
      }));
    });

    it('executes add-index successfully', async () => {
      const result = await dispatcher.dispatch('add-index', 'TestList', 'TestField');

      expect(result.success).toBe(true);
      expect(result.message).toContain('インデックスを作成');
      expect(trackSpEvent).toHaveBeenCalledWith('drift:repair_success', expect.objectContaining({
        details: expect.objectContaining({ kind: 'add-index' })
      }));
    });

    it('handles unknown action kind', async () => {
      const result = await dispatcher.dispatch('migrate' as any, 'TestList', 'TestField');

      expect(result.success).toBe(false);
      expect(result.message).toContain('対応していません');
      expect(trackSpEvent).not.toHaveBeenCalledWith('drift:repair_success', expect.any(Object));
    });

    it('returns early in dry-run mode without side effects (telemetry)', async () => {
      const result = await dispatcher.dispatch('fix-case', 'TestList', 'TestField', { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('[DRY-RUN]');
      expect(trackSpEvent).not.toHaveBeenCalled();
      expect(mockSpFetch).not.toHaveBeenCalled();
    });

    it('handles errors gracefully and logs telemetry', async () => {
      // Simulate an error inside the dispatcher (e.g. by making an internal method throw)
      // Since it's currently wait-only, we can mock spFetch to throw if we implement actual calls,
      // but for now, we'll just check if it catches any thrown error.
      
      // Force an error by passing weird args if needed, or just mock one of the execute methods later.
      // For now, let's just ensure basic error handling is there.
      dispatcher['executeFixCase'] = vi.fn().mockRejectedValue(new Error('Network Error'));

      const result = await dispatcher.dispatch('fix-case', 'TestList', 'TestField');

      expect(result.success).toBe(false);
      expect(result.message).toContain('修復に失敗しました: Network Error');
      expect(trackSpEvent).toHaveBeenCalledWith('drift:repair_failed', expect.objectContaining({
        error: 'Network Error'
      }));
      expect(auditLog.error).toHaveBeenCalled();
    });
  });
});
