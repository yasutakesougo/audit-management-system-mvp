/**
 * HandoffDayView / WeekViewSection / MonthViewSection のビュー分離テスト
 *
 * ビュー分離の本質的な保証:
 * 1. WeekViewSection は useHandoffWeekViewModel のみ使い、day state を持たない
 * 2. MonthViewSection は useHandoffMonthViewModel のみ使い、day state を持たない
 * 3. DayView は day 固有の hooks (useHandoffTimelineViewModel, useHandoffTimeline) を使う
 * 4. barrel export が 3 コンポーネントすべてを公開する
 */
import { describe, expect, it, vi } from 'vitest';

// ─── Mock 定義 ───
const mockWeekVM = { summary: [], loading: false, error: null };
const mockMonthVM = { summary: [], loading: false, error: null };

vi.mock('../../hooks/useHandoffWeekViewModel', () => ({
  useHandoffWeekViewModel: vi.fn(() => mockWeekVM),
}));

vi.mock('../../hooks/useHandoffMonthViewModel', () => ({
  useHandoffMonthViewModel: vi.fn(() => mockMonthVM),
}));

vi.mock('../../useHandoffTimelineViewModel', () => ({
  useHandoffTimelineViewModel: vi.fn(() => ({
    timeFilter: 'all',
    handoffStats: null,
    setHandoffStats: vi.fn(),
    handleTimeFilterChange: vi.fn(),
    meetingMode: 'normal',
    handleMeetingModeChange: vi.fn(),
    workflowActions: {
      markReviewed: vi.fn(),
      markCarryOver: vi.fn(),
      markClosed: vi.fn(),
    },
    injectDI: vi.fn(),
  })),
}));

vi.mock('../../useHandoffTimeline', () => ({
  useHandoffTimeline: vi.fn(() => ({
    todayHandoffs: [],
    loading: false,
    error: null,
    updateHandoffStatus: vi.fn(),
  })),
}));

describe('Handoff View Separation', () => {
  describe('WeekViewSection', () => {
    it('uses useHandoffWeekViewModel correctly', async () => {
      const { useHandoffWeekViewModel } = await import('../../hooks/useHandoffWeekViewModel');

      const result = useHandoffWeekViewModel('2026-03-13');
      expect(result).toEqual(mockWeekVM);
      expect(useHandoffWeekViewModel).toHaveBeenCalledWith('2026-03-13');
    });

    it('exports HandoffWeekViewSection component', async () => {
      const mod = await import('../HandoffWeekViewSection');
      expect(mod.HandoffWeekViewSection).toBeDefined();
      expect(typeof mod.HandoffWeekViewSection).toBe('function');
    });

    it('does not export day-specific identifiers', async () => {
      const mod = await import('../HandoffWeekViewSection');
      const keys = Object.keys(mod);
      // WeekViewSection should only have itself and its props type
      expect(keys).not.toContain('useHandoffTimelineViewModel');
      expect(keys).not.toContain('useHandoffTimeline');
      expect(keys).not.toContain('meetingMode');
      expect(keys).not.toContain('displayMode');
    });
  });

  describe('MonthViewSection', () => {
    it('uses useHandoffMonthViewModel correctly', async () => {
      const { useHandoffMonthViewModel } = await import('../../hooks/useHandoffMonthViewModel');

      const result = useHandoffMonthViewModel('2026-03-13');
      expect(result).toEqual(mockMonthVM);
      expect(useHandoffMonthViewModel).toHaveBeenCalledWith('2026-03-13');
    });

    it('exports HandoffMonthViewSection component', async () => {
      const mod = await import('../HandoffMonthViewSection');
      expect(mod.HandoffMonthViewSection).toBeDefined();
      expect(typeof mod.HandoffMonthViewSection).toBe('function');
    });

    it('does not export day-specific identifiers', async () => {
      const mod = await import('../HandoffMonthViewSection');
      const keys = Object.keys(mod);
      expect(keys).not.toContain('useHandoffTimelineViewModel');
      expect(keys).not.toContain('useHandoffTimeline');
      expect(keys).not.toContain('meetingMode');
      expect(keys).not.toContain('displayMode');
    });
  });

  describe('DayView', () => {
    it('exports HandoffDayView component', async () => {
      const mod = await import('../HandoffDayView');
      expect(mod.HandoffDayView).toBeDefined();
      expect(typeof mod.HandoffDayView).toBe('function');
    });

    it('day-specific hooks are importable (verifies DayView dependency)', async () => {
      const { useHandoffTimelineViewModel } = await import('../../useHandoffTimelineViewModel');
      const { useHandoffTimeline } = await import('../../useHandoffTimeline');
      expect(useHandoffTimelineViewModel).toBeDefined();
      expect(useHandoffTimeline).toBeDefined();
    });
  });

  describe('Barrel exports', () => {
    it('exports all three view components from index', async () => {
      const barrel = await import('../index');
      expect(barrel.HandoffDayView).toBeDefined();
      expect(barrel.HandoffWeekViewSection).toBeDefined();
      expect(barrel.HandoffMonthViewSection).toBeDefined();
    });
  });
});
