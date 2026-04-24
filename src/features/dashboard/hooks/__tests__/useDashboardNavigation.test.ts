/**
 * useDashboardNavigation — ルーティング・遷移コールバック・FF の接続テスト
 *
 * スコープ:
 * 1. openTimeline の遷移先 (デフォルト / yesterday)
 * 2. openBriefing が isMorningTime で morning / evening を分岐
 * 3. layoutMode / schedulesEnabled が返る
 */

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

let mockLayoutMode = 'auto' as string;
vi.mock('@/features/dashboard/hooks/useDashboardLayoutMode', () => ({
  useDashboardLayoutMode: () => mockLayoutMode,
}));

let mockSchedulesEnabled = true;
vi.mock('@/config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/featureFlags')>();
  return {
    ...actual,
    useFeatureFlags: () => ({
      schedules: mockSchedulesEnabled,
      complianceForm: false,
      schedulesWeekV2: false,
      icebergPdca: false,
      staffAttendance: false,
      todayOps: false,
      todayLiteUi: false,
      todayLiteNavV2: false,
    }),
  };
});

// SUT (mock 後に dynamic import)
const importSUT = () =>
  import('../useDashboardNavigation').then((m) => m.useDashboardNavigation);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDashboardNavigation', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockLayoutMode = 'auto';
    mockSchedulesEnabled = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. openTimeline ─────────────────────────────────
  describe('openTimeline', () => {
    it('デフォルトで /handoff-timeline に dayScope:"today" で遷移する', async () => {
      const useDashboardNavigation = await importSUT();
      const { result } = renderHook(() => useDashboardNavigation(true));

      act(() => {
        result.current.openTimeline();
      });

      // URL ベース: /handoff-timeline?range=day&date=YYYY-MM-DD
      const url = mockNavigate.mock.calls[0][0] as string;
      expect(url).toMatch(/^\/handoff-timeline\?range=day&date=\d{4}-\d{2}-\d{2}$/);
      expect(mockNavigate.mock.calls[0][1]).toEqual({
        state: { dayScope: 'today', timeFilter: 'all' },
      });
    });

    it('"yesterday" を渡すと dayScope:"yesterday" で遷移する', async () => {
      const useDashboardNavigation = await importSUT();
      const { result } = renderHook(() => useDashboardNavigation(false));

      act(() => {
        result.current.openTimeline('yesterday');
      });

      // URL ベース: yesterday の日付が含まれる
      const url = mockNavigate.mock.calls[0][0] as string;
      expect(url).toMatch(/^\/handoff-timeline\?range=day&date=\d{4}-\d{2}-\d{2}$/);
      expect(mockNavigate.mock.calls[0][1]).toEqual({
        state: { dayScope: 'yesterday', timeFilter: 'all' },
      });
    });
  });

  // ── 2. openBriefing ─────────────────────────────────
  describe('openBriefing', () => {
    it('isMorningTime=true なら tab:"morning" で /dashboard/briefing に遷移', async () => {
      const useDashboardNavigation = await importSUT();
      const { result } = renderHook(() => useDashboardNavigation(true));

      act(() => {
        result.current.openBriefing();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/briefing', {
        state: { tab: 'morning' },
      });
    });

    it('isMorningTime=false なら tab:"evening" で /dashboard/briefing に遷移', async () => {
      const useDashboardNavigation = await importSUT();
      const { result } = renderHook(() => useDashboardNavigation(false));

      act(() => {
        result.current.openBriefing();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/briefing', {
        state: { tab: 'evening' },
      });
    });
  });

  // ── 3. layoutMode / schedulesEnabled ────────────────
  describe('layoutMode / schedulesEnabled', () => {
    it('layoutMode が返る', async () => {
      mockLayoutMode = 'compact';
      const useDashboardNavigation = await importSUT();
      const { result } = renderHook(() => useDashboardNavigation(true));

      expect(result.current.layoutMode).toBe('compact');
    });

    it('schedulesEnabled が返る', async () => {
      mockSchedulesEnabled = false;
      const useDashboardNavigation = await importSUT();
      const { result } = renderHook(() => useDashboardNavigation(true));

      expect(result.current.schedulesEnabled).toBe(false);
    });
  });

  // ── 4. 戻り値の構造 ────────────────────────────────
  describe('戻り値の構造', () => {
    it('DashboardNavGroup の全キーが存在する', async () => {
      const useDashboardNavigation = await importSUT();
      const { result } = renderHook(() => useDashboardNavigation(true));

      expect(result.current).toHaveProperty('navigate');
      expect(result.current).toHaveProperty('openTimeline');
      expect(result.current).toHaveProperty('openBriefing');
      expect(result.current).toHaveProperty('layoutMode');
      expect(result.current).toHaveProperty('schedulesEnabled');
      expect(typeof result.current.navigate).toBe('function');
      expect(typeof result.current.openTimeline).toBe('function');
      expect(typeof result.current.openBriefing).toBe('function');
    });
  });
});
