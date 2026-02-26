import { describe, expect, it } from 'vitest';
import {
    calculateBackoff,
    calculateRetryAfterTimestamp,
    shouldSkipSync
} from '../syncGuardrails';

describe('syncGuardrails', () => {
  describe('calculateBackoff', () => {
    it('returns 0 for 0 failures', () => {
      expect(calculateBackoff(0)).toBe(0);
    });

    it('returns base for 1 failure', () => {
      expect(calculateBackoff(1, 1000)).toBe(1000);
    });

    it('doubles for 2 failures', () => {
      expect(calculateBackoff(2, 1000)).toBe(2000);
    });

    it('caps at max', () => {
      expect(calculateBackoff(10, 1000, 5000)).toBe(5000);
    });
  });

  describe('shouldSkipSync', () => {
    it('returns true if feature is disabled', () => {
      expect(shouldSkipSync(false, false, 0)).toBe(true);
    });

    it('returns true if SharePoint is disabled', () => {
      expect(shouldSkipSync(true, true, 0)).toBe(true);
    });

    it('returns true if cooling down', () => {
      const now = 1000;
      const cooldownUntil = 1001;
      expect(shouldSkipSync(true, false, cooldownUntil, now)).toBe(true);
    });

    it('returns false if allowed', () => {
      const now = 1000;
      const cooldownUntil = 500;
      expect(shouldSkipSync(true, false, cooldownUntil, now)).toBe(false);
    });
  });

  describe('calculateRetryAfterTimestamp', () => {
    it('adds backoff to now', () => {
      const now = 10000;
      const failureCount = 1; // 1000ms backoff
      expect(calculateRetryAfterTimestamp(failureCount, now)).toBe(11000);
    });
  });
});
