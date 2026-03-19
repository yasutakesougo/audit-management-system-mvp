/**
 * scheduleOps.spec.ts — Pure domain function tests with boundary conditions
 *
 * Tests:
 *   - toOpsServiceType: 正規化ロジック
 *   - deriveSupportTags: フラグ → タグ導出
 *   - computeOpsSummary: サマリー算出 + 境界条件
 *   - filterOpsItems: フィルタリング + 複合条件
 *   - computeWeeklySummary: 週間日別集計
 */

import { describe, expect, it } from 'vitest';

import type { ScheduleOpsItem } from '@/features/schedules/domain/scheduleOpsSchema';
import {
  type DaySummaryEntry,
  DEFAULT_OPS_FILTER,
  type OpsCapacity,
  type OpsFilterState,
  computeOpsSummary,
  computeWeeklySummary,
  deriveSupportTags,
  filterOpsItems,
  toOpsServiceType,
} from '@/features/schedules/domain/scheduleOps';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

/** Minimal valid ScheduleOpsItem for testing */
function makeItem(overrides: Partial<ScheduleOpsItem> = {}): ScheduleOpsItem {
  return {
    id: overrides.id ?? 'test-1',
    title: overrides.title ?? 'テスト予定',
    start: overrides.start ?? '2026-03-20T09:00:00+09:00',
    end: overrides.end ?? '2026-03-20T15:00:00+09:00',
    etag: '"test"',
    opsStatus: 'planned',
    ...overrides,
  };
}

/** Standard capacity for tests */
const CAP: OpsCapacity = { normalMax: 20, respiteMax: 3, shortStayMax: 2 };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// toOpsServiceType
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('toOpsServiceType', () => {
  it.each([
    [null, 'normal'],
    [undefined, 'normal'],
    ['', 'normal'],
  ] as const)('returns "normal" for falsy input: %s', (input, expected) => {
    expect(toOpsServiceType(input as string | null | undefined)).toBe(expected);
  });

  it.each([
    ['normal', 'normal'],
    ['respite', 'respite'],
    ['shortStay', 'shortStay'],
    ['transport', 'normal'],
    ['nursing', 'normal'],
  ] as const)('maps english key "%s" → "%s"', (input, expected) => {
    expect(toOpsServiceType(input)).toBe(expected);
  });

  it.each([
    ['一時ケア', 'respite'],
    ['ショートステイ', 'shortStay'],
    ['通常利用', 'normal'],
    ['送迎', 'normal'],
  ] as const)('maps Japanese label "%s" → "%s"', (input, expected) => {
    expect(toOpsServiceType(input)).toBe(expected);
  });

  it('returns "normal" for unknown service type', () => {
    expect(toOpsServiceType('completely_unknown')).toBe('normal');
  });

  it('returns "normal" for absence (not an ops service)', () => {
    expect(toOpsServiceType('absence')).toBe('normal');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// deriveSupportTags
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('deriveSupportTags', () => {
  it('returns empty array when all flags are false/undefined', () => {
    const item = makeItem();
    expect(deriveSupportTags(item)).toEqual([]);
  });

  it('returns pickup tag when hasPickup is true', () => {
    const item = makeItem({ hasPickup: true });
    expect(deriveSupportTags(item)).toEqual(['pickup']);
  });

  it('returns all flag-based tags in correct order', () => {
    const item = makeItem({
      hasPickup: true,
      hasMeal: true,
      hasBath: true,
      hasMedication: true,
      hasOvernight: true,
    });
    expect(deriveSupportTags(item)).toEqual([
      'pickup',
      'meal',
      'bath',
      'medication',
      'overnight',
    ]);
  });

  it('includes needsReview when hasAttention is true', () => {
    const item = makeItem({ hasAttention: true });
    expect(deriveSupportTags(item)).toContain('needsReview');
  });

  it('includes changed when opsStatus is "changed"', () => {
    const item = makeItem({ opsStatus: 'changed' });
    expect(deriveSupportTags(item)).toContain('changed');
  });

  it('includes medical when medicalNote has content', () => {
    const item = makeItem({ medicalNote: '経管栄養あり' });
    expect(deriveSupportTags(item)).toContain('medical');
  });

  it('does NOT include medical when medicalNote is whitespace only', () => {
    const item = makeItem({ medicalNote: '   ' });
    expect(deriveSupportTags(item)).not.toContain('medical');
  });

  it('includes behavioral when behavioralNote has content', () => {
    const item = makeItem({ behavioralNote: '他害傾向あり' });
    expect(deriveSupportTags(item)).toContain('behavioral');
  });

  it('returns multiple derived tags together', () => {
    const item = makeItem({
      hasPickup: true,
      hasAttention: true,
      opsStatus: 'changed',
      medicalNote: 'てんかん注意',
    });
    const tags = deriveSupportTags(item);
    expect(tags).toContain('pickup');
    expect(tags).toContain('needsReview');
    expect(tags).toContain('changed');
    expect(tags).toContain('medical');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// computeOpsSummary
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('computeOpsSummary', () => {
  it('returns zero counts for empty items', () => {
    const summary = computeOpsSummary([], CAP);
    expect(summary.totalCount).toBe(0);
    expect(summary.normalCount).toBe(0);
    expect(summary.respiteCount).toBe(0);
    expect(summary.shortStayCount).toBe(0);
    expect(summary.cancelledCount).toBe(0);
    expect(summary.attentionCount).toBe(0);
    expect(summary.availableSlots).toBe(25); // 20 + 3 + 2
    expect(summary.assignedStaff).toBe(0);
    expect(summary.requiredStaff).toBe(0);
  });

  it('counts service types correctly', () => {
    const items = [
      makeItem({ serviceType: 'normal' }),
      makeItem({ serviceType: 'normal', id: '2' }),
      makeItem({ serviceType: 'respite', id: '3' }),
      makeItem({ serviceType: 'shortStay', id: '4' }),
    ];
    const summary = computeOpsSummary(items, CAP);
    expect(summary.normalCount).toBe(2);
    expect(summary.respiteCount).toBe(1);
    expect(summary.shortStayCount).toBe(1);
    expect(summary.totalCount).toBe(4);
  });

  it('excludes cancelled items from total count', () => {
    const items = [
      makeItem({ serviceType: 'normal' }),
      makeItem({ serviceType: 'normal', id: '2', opsStatus: 'cancelled' }),
    ];
    const summary = computeOpsSummary(items, CAP);
    expect(summary.totalCount).toBe(1);
    expect(summary.normalCount).toBe(1);
    expect(summary.cancelledCount).toBe(1);
  });

  it('handles all items cancelled', () => {
    const items = [
      makeItem({ opsStatus: 'cancelled' }),
      makeItem({ id: '2', opsStatus: 'cancelled' }),
    ];
    const summary = computeOpsSummary(items, CAP);
    expect(summary.totalCount).toBe(0);
    expect(summary.cancelledCount).toBe(2);
    expect(summary.availableSlots).toBe(25);
  });

  it('counts attention items correctly', () => {
    const items = [
      makeItem({ hasAttention: true }),
      makeItem({ id: '2', hasAttention: false }),
      makeItem({ id: '3', hasAttention: true }),
    ];
    const summary = computeOpsSummary(items, CAP);
    expect(summary.attentionCount).toBe(2);
  });

  it('does not count attention for cancelled items', () => {
    const items = [
      makeItem({ hasAttention: true, opsStatus: 'cancelled' }),
    ];
    const summary = computeOpsSummary(items, CAP);
    expect(summary.attentionCount).toBe(0);
  });

  it('deduplicates staff by assignedStaffId', () => {
    const items = [
      makeItem({ assignedStaffId: 'STF-1' }),
      makeItem({ id: '2', assignedStaffId: 'STF-1' }),
      makeItem({ id: '3', assignedStaffId: 'STF-2' }),
    ];
    const summary = computeOpsSummary(items, CAP);
    expect(summary.assignedStaff).toBe(2);
  });

  it('returns 0 assigned staff when no staff assigned', () => {
    const items = [makeItem()]; // no assignedStaffId
    const summary = computeOpsSummary(items, CAP);
    expect(summary.assignedStaff).toBe(0);
  });

  it('calculates available slots per service type', () => {
    const items = [
      makeItem({ serviceType: 'normal' }),
      makeItem({ id: '2', serviceType: 'respite' }),
      makeItem({ id: '3', serviceType: 'respite' }),
      makeItem({ id: '4', serviceType: 'shortStay' }),
    ];
    const summary = computeOpsSummary(items, CAP);
    expect(summary.availableNormalSlots).toBe(19);  // 20 - 1
    expect(summary.availableRespiteSlots).toBe(1);  // 3 - 2
    expect(summary.availableShortStaySlots).toBe(1); // 2 - 1
  });

  it('clamps available slots at 0 when over capacity', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeItem({ id: `r-${i}`, serviceType: 'respite' }),
    );
    const summary = computeOpsSummary(items, CAP);
    expect(summary.availableRespiteSlots).toBe(0); // 3 - 5 → clamped to 0
    expect(summary.respiteCount).toBe(5);
  });

  it('handles capacity 0 gracefully', () => {
    const zeroCap: OpsCapacity = { normalMax: 0, respiteMax: 0, shortStayMax: 0 };
    const items = [makeItem({ serviceType: 'normal' })];
    const summary = computeOpsSummary(items, zeroCap);
    expect(summary.availableSlots).toBe(0);
    expect(summary.availableNormalSlots).toBe(0);
  });

  it('maps unknown serviceType to normal', () => {
    const items = [makeItem({ serviceType: 'xxxxxxxx' })];
    const summary = computeOpsSummary(items, CAP);
    expect(summary.normalCount).toBe(1);
  });

  it('calculates required staff using 5:1 ratio', () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      makeItem({ id: `s-${i}`, serviceType: 'normal' }),
    );
    const summary = computeOpsSummary(items, CAP);
    expect(summary.requiredStaff).toBe(3); // ceil(12/5) = 3
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// filterOpsItems
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('filterOpsItems', () => {
  const baseItems: ScheduleOpsItem[] = [
    makeItem({
      id: '1', serviceType: 'normal', assignedStaffId: 'STF-1',
      userName: '山田太郎', hasAttention: true, hasPickup: true,
      hasBath: true, hasMedication: true, opsStatus: 'planned',
    }),
    makeItem({
      id: '2', serviceType: 'respite', assignedStaffId: 'STF-2',
      userName: '鈴木花子', hasAttention: false, opsStatus: 'confirmed',
    }),
    makeItem({
      id: '3', serviceType: 'shortStay', assignedStaffId: 'STF-1',
      userName: '田中一郎', hasAttention: true, hasOvernight: true,
      opsStatus: 'planned',
    }),
    makeItem({
      id: '4', serviceType: 'normal', opsStatus: 'cancelled',
      userName: '佐藤次郎',
    }),
  ];

  it('excludes cancelled by default', () => {
    const result = filterOpsItems(baseItems, DEFAULT_OPS_FILTER);
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.id)).not.toContain('4');
  });

  it('includes cancelled when includeCancelled is true', () => {
    const filter: OpsFilterState = { ...DEFAULT_OPS_FILTER, includeCancelled: true };
    const result = filterOpsItems(baseItems, filter);
    expect(result).toHaveLength(4);
  });

  it('filters by serviceType: respite', () => {
    const filter: OpsFilterState = { ...DEFAULT_OPS_FILTER, serviceType: 'respite' };
    const result = filterOpsItems(baseItems, filter);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('filters by serviceType: shortStay', () => {
    const filter: OpsFilterState = { ...DEFAULT_OPS_FILTER, serviceType: 'shortStay' };
    const result = filterOpsItems(baseItems, filter);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('filters by staffId', () => {
    const filter: OpsFilterState = { ...DEFAULT_OPS_FILTER, staffId: 'STF-1' };
    const result = filterOpsItems(baseItems, filter);
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.assignedStaffId === 'STF-1')).toBe(true);
  });

  it('filters by hasAttention', () => {
    const filter: OpsFilterState = { ...DEFAULT_OPS_FILTER, hasAttention: true };
    const result = filterOpsItems(baseItems, filter);
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.hasAttention)).toBe(true);
  });

  it('filters by hasPickup', () => {
    const filter: OpsFilterState = { ...DEFAULT_OPS_FILTER, hasPickup: true };
    const result = filterOpsItems(baseItems, filter);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by hasBath', () => {
    const filter: OpsFilterState = { ...DEFAULT_OPS_FILTER, hasBath: true };
    const result = filterOpsItems(baseItems, filter);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by hasMedication', () => {
    const filter: OpsFilterState = { ...DEFAULT_OPS_FILTER, hasMedication: true };
    const result = filterOpsItems(baseItems, filter);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by searchQuery (case-insensitive)', () => {
    const filter: OpsFilterState = { ...DEFAULT_OPS_FILTER, searchQuery: '山田' };
    const result = filterOpsItems(baseItems, filter);
    expect(result).toHaveLength(1);
    expect(result[0].userName).toBe('山田太郎');
  });

  it('search matches against notes', () => {
    const items = [makeItem({ notes: '朝の薬を確認すること' })];
    const filter: OpsFilterState = { ...DEFAULT_OPS_FILTER, searchQuery: '朝の薬' };
    const result = filterOpsItems(items, filter);
    expect(result).toHaveLength(1);
  });

  it('search matches against attentionSummary', () => {
    const items = [makeItem({ attentionSummary: '転倒リスク高い' })];
    const filter: OpsFilterState = { ...DEFAULT_OPS_FILTER, searchQuery: '転倒' };
    const result = filterOpsItems(items, filter);
    expect(result).toHaveLength(1);
  });

  it('search matches against handoffSummary', () => {
    const items = [makeItem({ handoffSummary: '夜間帯に不穏あり' })];
    const filter: OpsFilterState = { ...DEFAULT_OPS_FILTER, searchQuery: '不穏' };
    const result = filterOpsItems(items, filter);
    expect(result).toHaveLength(1);
  });

  it('search matches against assignedStaffName', () => {
    const items = [makeItem({ assignedStaffName: '佐藤美咲' })];
    const filter: OpsFilterState = { ...DEFAULT_OPS_FILTER, searchQuery: '佐藤美' };
    const result = filterOpsItems(items, filter);
    expect(result).toHaveLength(1);
  });

  it('empty searchQuery passes all items', () => {
    const filter: OpsFilterState = { ...DEFAULT_OPS_FILTER, searchQuery: '' };
    const result = filterOpsItems(baseItems, filter);
    expect(result).toHaveLength(3); // cancelled excluded by default
  });

  it('combines multiple filter conditions (AND)', () => {
    const filter: OpsFilterState = {
      ...DEFAULT_OPS_FILTER,
      serviceType: 'normal',
      hasAttention: true,
      hasPickup: true,
    };
    const result = filterOpsItems(baseItems, filter);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns empty when combined conditions match nothing', () => {
    const filter: OpsFilterState = {
      ...DEFAULT_OPS_FILTER,
      serviceType: 'shortStay',
      hasPickup: true, // no shortStay items have pickup
    };
    const result = filterOpsItems(baseItems, filter);
    expect(result).toHaveLength(0);
  });

  it('returns empty for empty items array', () => {
    const result = filterOpsItems([], DEFAULT_OPS_FILTER);
    expect(result).toHaveLength(0);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// computeWeeklySummary
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('computeWeeklySummary', () => {
  const WEEK = [
    '2026-03-16',
    '2026-03-17',
    '2026-03-18',
    '2026-03-19',
    '2026-03-20',
  ];

  it('returns entry for each weekDate', () => {
    const result = computeWeeklySummary([], WEEK, CAP);
    expect(result).toHaveLength(5);
    expect(result.map((e: DaySummaryEntry) => e.dateIso)).toEqual(WEEK);
  });

  it('returns 0 counts for dates with no items', () => {
    const result = computeWeeklySummary([], WEEK, CAP);
    for (const entry of result) {
      expect(entry.totalCount).toBe(0);
      expect(entry.respiteCount).toBe(0);
      expect(entry.shortStayCount).toBe(0);
      expect(entry.attentionCount).toBe(0);
      expect(entry.isOverCapacity).toBe(false);
    }
  });

  it('counts items per day correctly', () => {
    const items = [
      makeItem({ id: '1', start: '2026-03-17T09:00:00', serviceType: 'normal' }),
      makeItem({ id: '2', start: '2026-03-17T10:00:00', serviceType: 'respite' }),
      makeItem({ id: '3', start: '2026-03-18T09:00:00', serviceType: 'shortStay' }),
    ];
    const result = computeWeeklySummary(items, WEEK, CAP);

    const mon = result.find((e: DaySummaryEntry) => e.dateIso === '2026-03-17')!;
    expect(mon.totalCount).toBe(2);
    expect(mon.respiteCount).toBe(1);

    const tue = result.find((e: DaySummaryEntry) => e.dateIso === '2026-03-18')!;
    expect(tue.totalCount).toBe(1);
    expect(tue.shortStayCount).toBe(1);
  });

  it('excludes cancelled items from count', () => {
    const items = [
      makeItem({ id: '1', start: '2026-03-17T09:00:00', opsStatus: 'planned' }),
      makeItem({ id: '2', start: '2026-03-17T09:00:00', opsStatus: 'cancelled' }),
    ];
    const result = computeWeeklySummary(items, WEEK, CAP);
    const mon = result.find((e: DaySummaryEntry) => e.dateIso === '2026-03-17')!;
    expect(mon.totalCount).toBe(1);
  });

  it('detects over capacity day', () => {
    const smallCap: OpsCapacity = { normalMax: 1, respiteMax: 0, shortStayMax: 0 };
    const items = [
      makeItem({ id: '1', start: '2026-03-17T09:00:00', serviceType: 'normal' }),
      makeItem({ id: '2', start: '2026-03-17T10:00:00', serviceType: 'normal' }),
    ];
    const result = computeWeeklySummary(items, WEEK, smallCap);
    const mon = result.find((e: DaySummaryEntry) => e.dateIso === '2026-03-17')!;
    expect(mon.isOverCapacity).toBe(true);
    expect(mon.availableSlots).toBe(0);
  });

  it('calculates available slots correctly', () => {
    const items = [
      makeItem({ id: '1', start: '2026-03-17T09:00:00', serviceType: 'normal' }),
    ];
    const result = computeWeeklySummary(items, WEEK, CAP);
    const mon = result.find((e: DaySummaryEntry) => e.dateIso === '2026-03-17')!;
    expect(mon.availableSlots).toBe(24); // 25 - 1
  });

  it('counts attention items', () => {
    const items = [
      makeItem({ id: '1', start: '2026-03-17T09:00:00', hasAttention: true }),
      makeItem({ id: '2', start: '2026-03-17T10:00:00', hasAttention: false }),
      makeItem({ id: '3', start: '2026-03-17T11:00:00', hasAttention: true }),
    ];
    const result = computeWeeklySummary(items, WEEK, CAP);
    const mon = result.find((e: DaySummaryEntry) => e.dateIso === '2026-03-17')!;
    expect(mon.attentionCount).toBe(2);
  });

  it('handles empty weekDates array', () => {
    const result = computeWeeklySummary([makeItem()], [], CAP);
    expect(result).toHaveLength(0);
  });
});
