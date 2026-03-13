/**
 * PlanningSheetStatsGrid.spec.ts
 *
 * PlanningSheetStatsGrid の純粋関数 daysUntilReview のテスト。
 * コンポーネントレンダリングは RegulatorySummaryBand.spec.ts と同様に
 * 純粋関数のロジックテストで品質を担保する。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { daysUntilReview } from '@/features/support-plan-guide/components/PlanningSheetStatsGrid';

describe('daysUntilReview', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when nextReviewAt is null', () => {
    expect(daysUntilReview(null)).toBeNull();
  });

  it('returns positive days when review is in the future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01'));
    // 30 days later
    expect(daysUntilReview('2026-03-31')).toBe(30);
  });

  it('returns 0 when review is today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13'));
    expect(daysUntilReview('2026-03-13')).toBe(0);
  });

  it('returns negative days when review is overdue', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15'));
    // 5 days ago
    expect(daysUntilReview('2026-03-10')).toBe(-5);
  });

  it('handles year boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-31'));
    expect(daysUntilReview('2026-01-01')).toBe(1);
  });
});
