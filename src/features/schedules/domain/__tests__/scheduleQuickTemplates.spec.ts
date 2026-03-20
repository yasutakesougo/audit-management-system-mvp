/**
 * scheduleQuickTemplates.spec.ts
 *
 * Phase 7-A: Quick template extraction tests
 */
import { describe, expect, it } from 'vitest';

import type { ScheduleItemForTemplate } from '../scheduleQuickTemplates';
import { buildCopyLastTemplate, buildQuickTemplates } from '../scheduleQuickTemplates';

// ── Fixtures ──────────────────────────────────────────────────────────────

const makeItem = (overrides?: Partial<ScheduleItemForTemplate>): ScheduleItemForTemplate => ({
  category: 'User',
  serviceType: 'normal',
  start: '2026-03-18T10:00:00',
  end: '2026-03-18T16:00:00',
  userName: '山田 太郎',
  userId: 'user-1',
  assignedStaffId: 'staff-1',
  locationName: '',
  ...overrides,
});

const TARGET_DATE = '2026-03-20';

// ── buildQuickTemplates ───────────────────────────────────────────────────

describe('buildQuickTemplates', () => {
  it('returns empty array when no items', () => {
    expect(buildQuickTemplates([], TARGET_DATE)).toEqual([]);
  });

  it('returns empty array when no User category items', () => {
    const items = [makeItem({ category: 'Staff' }), makeItem({ category: 'Org' })];
    expect(buildQuickTemplates(items, TARGET_DATE)).toEqual([]);
  });

  it('extracts a single template from one item', () => {
    const items = [makeItem()];
    const result = buildQuickTemplates(items, TARGET_DATE);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('通所 10:00-16:00');
    expect(result[0].frequency).toBe(1);
    expect(result[0].override.startLocal).toBe('2026-03-20T10:00');
    expect(result[0].override.endLocal).toBe('2026-03-20T16:00');
    expect(result[0].override.serviceType).toBe('normal');
  });

  it('deduplicates same patterns and counts frequency', () => {
    const items = [
      makeItem(), // normal 10:00-16:00
      makeItem(), // same pattern
      makeItem({ serviceType: 'absence', start: '2026-03-18T09:00:00', end: '2026-03-18T12:00:00' }),
    ];
    const result = buildQuickTemplates(items, TARGET_DATE);

    expect(result).toHaveLength(2);
    // Most frequent first
    expect(result[0].label).toBe('通所 10:00-16:00');
    expect(result[0].frequency).toBe(2);
    expect(result[1].label).toBe('欠席 09:00-12:00');
    expect(result[1].frequency).toBe(1);
  });

  it('limits results to specified count', () => {
    const items = [
      makeItem({ serviceType: 'normal', start: '2026-03-18T10:00:00', end: '2026-03-18T16:00:00' }),
      makeItem({ serviceType: 'absence', start: '2026-03-18T09:00:00', end: '2026-03-18T12:00:00' }),
      makeItem({ serviceType: 'late', start: '2026-03-18T11:00:00', end: '2026-03-18T16:00:00' }),
      makeItem({ serviceType: 'earlyLeave', start: '2026-03-18T10:00:00', end: '2026-03-18T14:00:00' }),
    ];
    const result = buildQuickTemplates(items, TARGET_DATE, { limit: 2 });
    expect(result).toHaveLength(2);
  });

  it('filters by userId when specified', () => {
    const items = [
      makeItem({ userId: 'user-1' }),
      makeItem({ userId: 'user-2', serviceType: 'absence' }),
    ];
    const result = buildQuickTemplates(items, TARGET_DATE, { userId: 'user-1' });
    expect(result).toHaveLength(1);
    expect(result[0].override.userId).toBe('user-1');
  });

  it('uses target date for override startLocal/endLocal', () => {
    const items = [makeItem({ start: '2026-03-15T09:30:00', end: '2026-03-15T15:30:00' })];
    const result = buildQuickTemplates(items, '2026-04-01');

    expect(result[0].override.startLocal).toBe('2026-04-01T09:30');
    expect(result[0].override.endLocal).toBe('2026-04-01T15:30');
  });

  it('handles ISO strings with Z suffix', () => {
    const items = [makeItem({ start: '2026-03-18T10:00:00Z', end: '2026-03-18T16:00:00Z' })];
    const result = buildQuickTemplates(items, TARGET_DATE);
    expect(result[0].override.startLocal).toBe('2026-03-20T10:00');
    expect(result[0].override.endLocal).toBe('2026-03-20T16:00');
  });
});

// ── buildCopyLastTemplate ─────────────────────────────────────────────────

describe('buildCopyLastTemplate', () => {
  it('returns null when no items for user', () => {
    expect(buildCopyLastTemplate([], 'user-1', TARGET_DATE)).toBeNull();
  });

  it('returns null when no User category items', () => {
    const items = [makeItem({ userId: 'user-1', category: 'Staff' })];
    expect(buildCopyLastTemplate(items, 'user-1', TARGET_DATE)).toBeNull();
  });

  it('returns the most recent item as template', () => {
    const items = [
      makeItem({ start: '2026-03-17T09:00:00', end: '2026-03-17T15:00:00', serviceType: 'absence' }),
      makeItem({ start: '2026-03-18T10:00:00', end: '2026-03-18T16:00:00', serviceType: 'normal' }),
      makeItem({ start: '2026-03-16T08:00:00', end: '2026-03-16T14:00:00', serviceType: 'late' }),
    ];
    const result = buildCopyLastTemplate(items, 'user-1', TARGET_DATE);

    expect(result).not.toBeNull();
    expect(result!.label).toBe('📋 前回と同じ');
    // Most recent = 2026-03-18
    expect(result!.override.serviceType).toBe('normal');
    expect(result!.override.startLocal).toBe('2026-03-20T10:00');
    expect(result!.override.endLocal).toBe('2026-03-20T16:00');
  });

  it('only considers items for the specified user', () => {
    const items = [
      makeItem({ userId: 'user-1', start: '2026-03-17T09:00:00', end: '2026-03-17T15:00:00' }),
      makeItem({ userId: 'user-2', start: '2026-03-18T10:00:00', end: '2026-03-18T16:00:00' }),
    ];
    const result = buildCopyLastTemplate(items, 'user-1', TARGET_DATE);

    expect(result).not.toBeNull();
    expect(result!.override.userId).toBe('user-1');
    expect(result!.override.startLocal).toBe('2026-03-20T09:00');
  });

  it('preserves assignedStaffId and locationName', () => {
    const items = [
      makeItem({ assignedStaffId: 'staff-5', locationName: '活動室A' }),
    ];
    const result = buildCopyLastTemplate(items, 'user-1', TARGET_DATE);

    expect(result!.override.assignedStaffId).toBe('staff-5');
    expect(result!.override.locationName).toBe('活動室A');
  });
});
