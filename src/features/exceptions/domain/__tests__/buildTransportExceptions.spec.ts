import { describe, it, expect } from 'vitest';
import { buildTransportExceptions } from '../buildTransportExceptions';
import type { AssignmentConflictEvent } from '../buildTransportExceptions';

describe('buildTransportExceptions', () => {
  const today = '2026-04-25';

  it('should return an empty array when no alerts or conflicts are provided', () => {
    const result = buildTransportExceptions({
      alerts: [],
      today,
    });
    expect(result).toEqual([]);
  });

  describe('Assignment Conflicts (CONFLICT_UNRESOLVED)', () => {
    it('should create a critical exception for retry_exhausted', () => {
      const conflict: AssignmentConflictEvent = {
        timestamp: 1714000000000,
        reason: 'retry_exhausted',
        retryCount: 1,
        itemId: 'ITEM-123',
      };

      const result = buildTransportExceptions({
        alerts: [],
        today,
        assignmentConflictEvents: [conflict],
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        severity: 'critical',
        title: '配車情報の競合を自動解決できませんでした',
        description: expect.stringContaining('ITEM-123'),
        targetDate: today,
      });
    });

    it('should create a critical exception for item_gone', () => {
      const conflict: AssignmentConflictEvent = {
        timestamp: 1714000000000,
        reason: 'item_gone',
        retryCount: 1,
        itemId: 'ITEM-456',
      };

      const result = buildTransportExceptions({
        alerts: [],
        today,
        assignmentConflictEvents: [conflict],
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        severity: 'critical',
        title: '更新対象の配車情報が見つかりません（削除された可能性があります）',
        description: expect.stringContaining('ITEM-456'),
      });
    });

    it('should NOT create an exception for retry_failed (filtered out)', () => {
      const conflict: AssignmentConflictEvent = {
        timestamp: 1714000000000,
        reason: 'retry_failed',
        retryCount: 1,
        itemId: 'ITEM-789',
      };

      const result = buildTransportExceptions({
        alerts: [],
        today,
        assignmentConflictEvents: [conflict],
      });

      expect(result).toHaveLength(0);
    });

    it('should NOT create an exception for non_conflict_error (filtered out)', () => {
      const conflict: AssignmentConflictEvent = {
        timestamp: 1714000000000,
        reason: 'non_conflict_error',
        retryCount: 0,
        itemId: 'ITEM-000',
      };

      const result = buildTransportExceptions({
        alerts: [],
        today,
        assignmentConflictEvents: [conflict],
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('Legacy Alerts Integration', () => {
    it('should still handle standard transport alerts', () => {
      const alerts = [
        {
          id: 'transport-stale-count',
          severity: 'warning' as const,
          label: 'Stale',
          message: '3 users are stale',
          value: 3,
          threshold: 0,
        },
      ];

      const result = buildTransportExceptions({
        alerts,
        today,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: `transport-transport-stale-count-${today}`,
        title: '送迎ステータスが長時間停滞中',
      });
    });
  });
});
