/**
 * Safety HUD Logic Unit Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
    acknowledgeAlert,
    calculateSafetyPriority,
    calculateUpdateFrequency,
    formatSafetyMetrics,
    shouldShowSafetyHUD,
    toggleSafetyHUDVisibility,
    type SafetyAlert,
    type SafetyMetrics
} from '../safetyHUDLogic';

describe('Safety HUD Logic', () => {
  let mockAlert: SafetyAlert;
  let mockMetrics: SafetyMetrics;

  beforeEach(() => {
    mockAlert = {
      id: 'alert-1',
      severity: 'medium',
      message: 'Test alert',
      timestamp: new Date('2024-01-15 10:00:00'),
      acknowledged: false
    };

    mockMetrics = {
      activeIssues: 5,
      resolvedToday: 3,
      averageResponseTime: 45,
      complianceRate: 85
    };
  });

  describe('shouldShowSafetyHUD', () => {
    it('should always show for safety officers', () => {
      expect(shouldShowSafetyHUD('safety-officer', null, false)).toBe(true);
      expect(shouldShowSafetyHUD('safety-officer', 'morning', true)).toBe(true);
    });

    it('should show during meetings with active alerts', () => {
      expect(shouldShowSafetyHUD('user', 'morning', true)).toBe(true);
      expect(shouldShowSafetyHUD('user', 'evening', true)).toBe(true);
    });

    it('should not show during meetings without alerts', () => {
      expect(shouldShowSafetyHUD('user', 'morning', false)).toBe(false);
      expect(shouldShowSafetyHUD('user', 'evening', false)).toBe(false);
    });

    it('should show for managers during business hours', () => {
      // Mock current hour to 10 AM (business hours)
      const originalDate = global.Date;
      global.Date = class extends Date {
        getHours(): number {
          return 10;
        }
      } as typeof Date;

      expect(shouldShowSafetyHUD('manager', null, false)).toBe(true);

      global.Date = originalDate;
    });
  });

  describe('calculateSafetyPriority', () => {
    it('should assign higher score for critical severity', () => {
      const criticalAlert = { ...mockAlert, severity: 'critical' as const };
      const lowAlert = { ...mockAlert, severity: 'low' as const };

      expect(calculateSafetyPriority(criticalAlert)).toBeGreaterThan(
        calculateSafetyPriority(lowAlert)
      );
    });

    it('should add bonus for unacknowledged alerts', () => {
      const acknowledgedAlert = { ...mockAlert, acknowledged: true };
      const unacknowledgedAlert = { ...mockAlert, acknowledged: false };

      expect(calculateSafetyPriority(unacknowledgedAlert)).toBeGreaterThan(
        calculateSafetyPriority(acknowledgedAlert)
      );
    });

    it('should add time-based scoring', () => {
      const now = Date.now();
      const oldAlert = { ...mockAlert, timestamp: new Date(now - 86400000) }; // 24 hours ago
      const newAlert = { ...mockAlert, timestamp: new Date(now) }; // now

      expect(calculateSafetyPriority(oldAlert)).toBeGreaterThan(
        calculateSafetyPriority(newAlert)
      );
    });
  });

  describe('formatSafetyMetrics', () => {
    it('should format metrics correctly', () => {
      const formatted = formatSafetyMetrics(mockMetrics);

      expect(formatted.activeIssuesText).toBe('5 件の課題');
      expect(formatted.resolvedTodayText).toBe('本日解決: 3 件');
      expect(formatted.responseTimeText).toBe('平均対応時間: 45 分');
      expect(formatted.complianceText).toBe('コンプライアンス率: 85%');
    });

    it('should assign correct compliance colors', () => {
      const highCompliance = { ...mockMetrics, complianceRate: 95 };
      const mediumCompliance = { ...mockMetrics, complianceRate: 80 };
      const lowCompliance = { ...mockMetrics, complianceRate: 60 };

      expect(formatSafetyMetrics(highCompliance).complianceColor).toBe('success.main');
      expect(formatSafetyMetrics(mediumCompliance).complianceColor).toBe('warning.main');
      expect(formatSafetyMetrics(lowCompliance).complianceColor).toBe('error.main');
    });
  });

  describe('toggleSafetyHUDVisibility', () => {
    it('should toggle visibility state', () => {
      const result1 = toggleSafetyHUDVisibility(true);
      expect(result1.isVisible).toBe(false);

      const result2 = toggleSafetyHUDVisibility(false);
      expect(result2.isVisible).toBe(true);
    });

    it('should handle persistence preferences', () => {
      const result1 = toggleSafetyHUDVisibility(false, 'session-only');
      expect(result1.shouldPersist).toBe(false);

      const result2 = toggleSafetyHUDVisibility(false, 'persistent');
      expect(result2.shouldPersist).toBe(true);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge the correct alert', () => {
      const alerts = [
        { ...mockAlert, id: 'alert-1' },
        { ...mockAlert, id: 'alert-2' }
      ];

      const result = acknowledgeAlert(alerts, 'alert-1', 'user-123');

      expect(result[0].acknowledged).toBe(true);
      expect(result[1].acknowledged).toBe(false);
    });

    it('should not modify alerts if ID not found', () => {
      const alerts = [{ ...mockAlert, id: 'alert-1' }];
      const result = acknowledgeAlert(alerts, 'non-existent', 'user-123');

      expect(result[0].acknowledged).toBe(false);
    });
  });

  describe('calculateUpdateFrequency', () => {
    it('should return 10 seconds for critical alerts', () => {
      const alerts = [{ ...mockAlert, severity: 'critical' as const }];
      expect(calculateUpdateFrequency(alerts)).toBe(10000);
    });

    it('should return 30 seconds for high alerts', () => {
      const alerts = [{ ...mockAlert, severity: 'high' as const }];
      expect(calculateUpdateFrequency(alerts)).toBe(30000);
    });

    it('should return 60 seconds for normal alerts', () => {
      const alerts = [{ ...mockAlert, severity: 'medium' as const }];
      expect(calculateUpdateFrequency(alerts)).toBe(60000);
    });

    it('should prioritize highest severity', () => {
      const alerts = [
        { ...mockAlert, severity: 'low' as const },
        { ...mockAlert, severity: 'critical' as const },
        { ...mockAlert, severity: 'medium' as const }
      ];
      expect(calculateUpdateFrequency(alerts)).toBe(10000);
    });
  });
});