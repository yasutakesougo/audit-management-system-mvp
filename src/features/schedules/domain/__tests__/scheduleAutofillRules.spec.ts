/**
 * scheduleAutofillRules.spec.ts
 *
 * Phase 7-B: ルールベース自動補完のテスト
 */
import { describe, expect, it } from 'vitest';

import type { AutofillContext } from '../scheduleAutofillRules';
import { computeAutofill } from '../scheduleAutofillRules';
import type { ScheduleItemForTemplate } from '../scheduleQuickTemplates';

// ── Fixtures ──────────────────────────────────────────────────────────────

const makeItem = (overrides?: Partial<ScheduleItemForTemplate>): ScheduleItemForTemplate => ({
  category: 'User',
  serviceType: 'normal',
  start: '2026-03-18T10:00:00',
  end: '2026-03-18T16:00:00',
  userName: '山田 太郎',
  userId: 'user-1',
  assignedStaffId: 'staff-1',
  locationName: '活動室A',
  ...overrides,
});

const baseCtx = (overrides?: Partial<AutofillContext>): AutofillContext => ({
  targetDate: '2026-03-20', // Thursday
  items: [],
  ...overrides,
});

// ── computeAutofill ───────────────────────────────────────────────────────

describe('computeAutofill', () => {
  // Rule 1: Navigation hint
  describe('Rule 1: navigation hint', () => {
    it('sets category=User when source=ops', () => {
      const result = computeAutofill(baseCtx({ source: 'ops' }));
      expect(result.override.category).toBe('User');
      expect(result.provenance.category?.source).toBe('navigation-hint');
    });

    it('sets category=User when source=today', () => {
      const result = computeAutofill(baseCtx({ source: 'today' }));
      expect(result.override.category).toBe('User');
    });

    it('does not set category when source is undefined', () => {
      const result = computeAutofill(baseCtx());
      expect(result.override.category).toBeUndefined();
    });
  });

  // Rule 2: Same timeslot
  describe('Rule 2: same timeslot', () => {
    it('sets category from matching timeslot items', () => {
      const items = [
        makeItem({ start: '2026-03-17T09:30:00', end: '2026-03-17T15:30:00', category: 'User' }),
        makeItem({ start: '2026-03-16T10:00:00', end: '2026-03-16T16:00:00', category: 'User' }),
        makeItem({ start: '2026-03-15T10:00:00', end: '2026-03-15T16:00:00', category: 'Staff' }),
      ];
      const result = computeAutofill(baseCtx({
        items,
        targetStartTime: '10:00',
        targetEndTime: '16:00',
      }));
      expect(result.override.category).toBe('User');
      expect(result.provenance.category?.source).toBe('same-timeslot');
    });

    it('sets serviceType from matching timeslot items', () => {
      const items = [
        makeItem({ start: '2026-03-17T10:00:00', end: '2026-03-17T16:00:00', serviceType: 'normal' }),
        makeItem({ start: '2026-03-16T10:00:00', end: '2026-03-16T16:00:00', serviceType: 'normal' }),
        makeItem({ start: '2026-03-15T10:00:00', end: '2026-03-15T16:00:00', serviceType: 'absence' }),
      ];
      const result = computeAutofill(baseCtx({
        items,
        targetStartTime: '10:00',
        targetEndTime: '16:00',
      }));
      expect(result.override.serviceType).toBe('normal');
      expect(result.provenance.serviceType?.source).toBe('same-timeslot');
    });

    it('does not match items with very different time slots', () => {
      const items = [
        makeItem({ start: '2026-03-17T06:00:00', end: '2026-03-17T07:00:00', category: 'Staff' }),
      ];
      const result = computeAutofill(baseCtx({
        items,
        targetStartTime: '14:00',
        targetEndTime: '16:00',
      }));
      expect(result.override.category).toBeUndefined();
    });

    it('skips when targetStartTime is not provided', () => {
      const items = [makeItem()];
      const result = computeAutofill(baseCtx({ items }));
      // Rule 2 should not fire
      expect(result.provenance.category?.source).not.toBe('same-timeslot');
    });
  });

  // Rule 3: Same user
  describe('Rule 3: same user', () => {
    it('sets serviceType from most recent user schedule', () => {
      const items = [
        makeItem({ start: '2026-03-18T10:00:00', serviceType: 'late' }),
        makeItem({ start: '2026-03-17T10:00:00', serviceType: 'normal' }),
      ];
      const result = computeAutofill(baseCtx({
        items,
        userId: 'user-1',
      }));
      expect(result.override.serviceType).toBe('late'); // most recent
      expect(result.provenance.serviceType?.source).toBe('same-user');
    });

    it('sets assignedStaffId from most recent user schedule', () => {
      const items = [
        makeItem({ assignedStaffId: 'staff-5' }),
      ];
      const result = computeAutofill(baseCtx({
        items,
        userId: 'user-1',
      }));
      expect(result.override.assignedStaffId).toBe('staff-5');
      expect(result.provenance.assignedStaffId?.source).toBe('same-user');
    });

    it('sets locationName from most recent user schedule', () => {
      const items = [
        makeItem({ locationName: '送迎車B' }),
      ];
      const result = computeAutofill(baseCtx({
        items,
        userId: 'user-1',
      }));
      expect(result.override.locationName).toBe('送迎車B');
      expect(result.provenance.locationName?.source).toBe('same-user');
    });

    it('does not override serviceType already set by a higher-priority rule', () => {
      const items = [
        makeItem({ start: '2026-03-18T10:00:00', serviceType: 'late', userId: 'user-1' }),
        // same-timeslot items with 'normal'
        makeItem({ start: '2026-03-17T10:00:00', serviceType: 'normal', userId: 'user-2' }),
        makeItem({ start: '2026-03-16T10:00:00', serviceType: 'normal', userId: 'user-2' }),
      ];
      const result = computeAutofill(baseCtx({
        items,
        userId: 'user-1',
        targetStartTime: '10:00',
        targetEndTime: '16:00',
      }));
      // same-timeslot writes first
      expect(result.override.serviceType).toBe('normal');
      expect(result.provenance.serviceType?.source).toBe('same-timeslot');
    });

    it('skips when userId is not provided', () => {
      const items = [makeItem()];
      const result = computeAutofill(baseCtx({ items }));
      expect(result.provenance.serviceType?.source).not.toBe('same-user');
    });
  });

  // Rule 4: Same weekday
  describe('Rule 4: same weekday', () => {
    it('sets serviceType from same weekday frequency', () => {
      // 2026-03-20 = Friday (day 5)
      // 2026-03-13 = Thursday — different dow
      // 2026-03-06 = Friday → same dow
      // 2026-02-27 = Friday → same dow
      const items = [
        makeItem({ start: '2026-03-06T10:00:00', serviceType: 'absence' }),
        makeItem({ start: '2026-02-27T10:00:00', serviceType: 'absence' }),
      ];
      const result = computeAutofill(baseCtx({
        items,
        targetDate: '2026-03-20', // Friday
      }));
      expect(result.override.serviceType).toBe('absence');
      expect(result.provenance.serviceType?.source).toBe('same-weekday');
      expect(result.provenance.serviceType?.reason).toContain('金曜');
    });

    it('needs at least 2 same-weekday items', () => {
      const items = [
        makeItem({ start: '2026-03-06T10:00:00', serviceType: 'absence' }),
      ];
      const result = computeAutofill(baseCtx({
        items,
        targetDate: '2026-03-20',
      }));
      expect(result.provenance.serviceType?.source).not.toBe('same-weekday');
    });
  });

  // Priority / first-writer-wins
  describe('priority: first-writer-wins', () => {
    it('navigation hint category beats same-timeslot category', () => {
      const items = [
        makeItem({ start: '2026-03-17T10:00:00', end: '2026-03-17T16:00:00', category: 'Staff' }),
        makeItem({ start: '2026-03-16T10:00:00', end: '2026-03-16T16:00:00', category: 'Staff' }),
      ];
      const result = computeAutofill(baseCtx({
        items,
        source: 'ops',
        targetStartTime: '10:00',
        targetEndTime: '16:00',
      }));
      // Navigation hint wins
      expect(result.override.category).toBe('User');
      expect(result.provenance.category?.source).toBe('navigation-hint');
    });
  });

  // Empty case
  describe('empty / no data', () => {
    it('returns empty override when no items and no source', () => {
      const result = computeAutofill(baseCtx());
      expect(result.override).toEqual({});
      expect(result.provenance).toEqual({});
    });
  });
});
