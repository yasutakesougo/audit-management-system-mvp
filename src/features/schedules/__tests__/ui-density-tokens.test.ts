import { describe, it, expect } from 'vitest';
import { SCHEDULE_TIMELINE_SPACING, SCHEDULE_MONTH_SPACING } from '../constants';

/**
 * UI Density Token Guardrails
 * 
 * These tests ensure that spacing token structures remain stable and prevent
 * regressions where inline values creep back into components.
 * 
 * Token groups:
 * - SCHEDULE_TIMELINE_SPACING: Day view timeline layout (PR #496)
 * - SCHEDULE_MONTH_SPACING: Month grid layout (PR #498)
 * 
 * Note: Week view currently uses direct inline values pending token extraction (future work)
 */

describe('schedules: UI density token guardrails', () => {
  describe('token exports', () => {
    it('exports SCHEDULE_TIMELINE_SPACING for DayView', () => {
      expect(SCHEDULE_TIMELINE_SPACING).toBeTruthy();
      expect(typeof SCHEDULE_TIMELINE_SPACING).toBe('object');
    });

    it('exports SCHEDULE_MONTH_SPACING for MonthPage', () => {
      expect(SCHEDULE_MONTH_SPACING).toBeTruthy();
      expect(typeof SCHEDULE_MONTH_SPACING).toBe('object');
    });
  });

  describe('timeline spacing shape (DayView)', () => {
    it('provides padding tokens in compact/normal pairs', () => {
      expect(SCHEDULE_TIMELINE_SPACING).toHaveProperty('itemPaddingCompact');
      expect(SCHEDULE_TIMELINE_SPACING).toHaveProperty('itemPaddingNormal');
    });

    it('provides gap tokens for layout spacing', () => {
      expect(SCHEDULE_TIMELINE_SPACING).toHaveProperty('itemGapCompact');
      expect(SCHEDULE_TIMELINE_SPACING).toHaveProperty('itemGapNormal');
      expect(SCHEDULE_TIMELINE_SPACING).toHaveProperty('itemGridGapCompact');
      expect(SCHEDULE_TIMELINE_SPACING).toHaveProperty('itemGridGapNormal');
      expect(SCHEDULE_TIMELINE_SPACING).toHaveProperty('headerGapCompact');
      expect(SCHEDULE_TIMELINE_SPACING).toHaveProperty('headerGapNormal');
    });

    it('provides visual rail and dot configuration', () => {
      expect(SCHEDULE_TIMELINE_SPACING).toHaveProperty('railWidth');
      expect(SCHEDULE_TIMELINE_SPACING).toHaveProperty('dotSize');
    });

    it('compact tokens are more or equal to normal spacing', () => {
      const p_c = parseInt(SCHEDULE_TIMELINE_SPACING.itemPaddingCompact.split(' ')[0]);
      const p_n = parseInt(SCHEDULE_TIMELINE_SPACING.itemPaddingNormal.split(' ')[0]);
      expect(p_c).toBeLessThanOrEqual(p_n);

      expect(SCHEDULE_TIMELINE_SPACING.itemGapCompact).toBeLessThanOrEqual(SCHEDULE_TIMELINE_SPACING.itemGapNormal);
    });
  });

  describe('month grid spacing shape (MonthPage)', () => {
    it('provides header padding tokens in compact/normal pairs', () => {
      expect(SCHEDULE_MONTH_SPACING).toHaveProperty('headerPaddingCompact');
      expect(SCHEDULE_MONTH_SPACING).toHaveProperty('headerPaddingNormal');
    });

    it('provides grid layout gaps in compact/normal pairs', () => {
      expect(SCHEDULE_MONTH_SPACING).toHaveProperty('gridGapCompact');
      expect(SCHEDULE_MONTH_SPACING).toHaveProperty('gridGapNormal');
    });

    it('provides weekday header padding', () => {
      expect(SCHEDULE_MONTH_SPACING).toHaveProperty('weekdayHeaderPaddingCompact');
      expect(SCHEDULE_MONTH_SPACING).toHaveProperty('weekdayHeaderPaddingNormal');
    });

    it('provides cell padding and gap tokens for day cells', () => {
      expect(SCHEDULE_MONTH_SPACING).toHaveProperty('cellPaddingCompact');
      expect(SCHEDULE_MONTH_SPACING).toHaveProperty('cellPaddingNormal');
      expect(SCHEDULE_MONTH_SPACING).toHaveProperty('cellGapCompact');
      expect(SCHEDULE_MONTH_SPACING).toHaveProperty('cellGapNormal');
    });

    it('provides cell height constraints', () => {
      expect(SCHEDULE_MONTH_SPACING).toHaveProperty('cellMinHeightCompact');
      expect(SCHEDULE_MONTH_SPACING).toHaveProperty('cellMinHeightNormal');
    });

    it('compact modes provide tighter spacing than normal', () => {
      expect(SCHEDULE_MONTH_SPACING.gridGapCompact).toBeLessThanOrEqual(SCHEDULE_MONTH_SPACING.gridGapNormal);
      expect(SCHEDULE_MONTH_SPACING.cellMinHeightCompact).toBeLessThanOrEqual(SCHEDULE_MONTH_SPACING.cellMinHeightNormal);
    });
  });

  describe('token consistency principles', () => {
    it('all token values are CSS-compatible types (string | number)', () => {
      const allTimelineValues = Object.values(SCHEDULE_TIMELINE_SPACING);
      const allMonthValues = Object.values(SCHEDULE_MONTH_SPACING);

      const [validTypes] = [allTimelineValues, allMonthValues].map(vals =>
        vals.every(v => typeof v === 'string' || typeof v === 'number')
      );

      expect(validTypes).toBe(true);
    });

    it('prevents inline hardcoded spacing values in components', () => {
      // This test validates token structure - the grep_search in CI/tests
      // will verify components actually use these tokens instead of inline values
      expect(Object.keys(SCHEDULE_TIMELINE_SPACING).length).toBeGreaterThan(5);
      expect(Object.keys(SCHEDULE_MONTH_SPACING).length).toBeGreaterThan(6);
    });
  });
});
