/**
 * useBriefingPageState — 配線ロジックのユニットテスト
 *
 * スコープ:
 * 1. 初期タブ決定（navState.tab / 時間帯フォールバック）
 * 2. Timeline 遷移コールバック（openTimelineToday / openTimelineYesterday）
 * 3. Weekly preload（tab === 'weekly' で preload が呼ばれる）
 *
 * 除外:
 * - useUsersStore / useHandoffSummary / useHandoffTimeline の内部挙動
 * - idle cleanup の完全網羅
 * - state setter の全分岐
 */

import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
let mockLocationState: Record<string, unknown> = {};

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ state: mockLocationState, pathname: '/dashboard/briefing' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('@/features/handoff/useHandoffSummary', () => ({
  useHandoffSummary: () => ({
    total: 0,
    byStatus: {},
    criticalCount: 0,
  }),
}));

vi.mock('@/features/handoff/useHandoffTimeline', () => ({
  useHandoffTimeline: () => ({
    todayHandoffs: [],
    loading: false,
    error: null,
    updateHandoffStatus: vi.fn(),
  }),
}));

vi.mock('@/features/users/store', () => ({
  useUsersStore: () => ({ data: [] }),
}));

const mockPreload = vi.fn().mockResolvedValue(undefined);

vi.mock('@/utils/lazyWithPreload', () => ({
  default: () => {
    const Component = () => null;
    Component.preload = mockPreload;
    return Component;
  },
}));

vi.mock('@/utils/runOnIdle', () => ({
  runOnIdle: (cb: () => void) => {
    // 即座に実行（idle 待ちをスキップ）
    cb();
    return 0;
  },
  cancelIdle: () => {},
}));

// SUT (mock 後に dynamic import)
const importSUT = () =>
  import('../useBriefingPageState').then((m) => m.useBriefingPageState);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useBriefingPageState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockLocationState = {};
    mockNavigate.mockClear();
    mockPreload.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── 1. 初期タブ決定 ──────────────────────────────────
  describe('初期タブ決定', () => {
    it('location.state.tab が指定されていればそれを採用する', async () => {
      mockLocationState = { tab: 'evening' };
      vi.setSystemTime(new Date(2026, 2, 11, 9, 0, 0)); // 朝9時でも evening になる

      const useBriefingPageState = await importSUT();
      const { result } = renderHook(() => useBriefingPageState());

      expect(result.current.tab.value).toBe('evening');
    });

    it('location.state.tab が undefined で 13:59 なら morning', async () => {
      mockLocationState = {};
      vi.setSystemTime(new Date(2026, 2, 11, 13, 59, 0));

      const useBriefingPageState = await importSUT();
      const { result } = renderHook(() => useBriefingPageState());

      expect(result.current.tab.value).toBe('morning');
    });

    it('location.state.tab が undefined で 14:00 なら evening', async () => {
      mockLocationState = {};
      vi.setSystemTime(new Date(2026, 2, 11, 14, 0, 0));

      const useBriefingPageState = await importSUT();
      const { result } = renderHook(() => useBriefingPageState());

      expect(result.current.tab.value).toBe('evening');
    });

    it('tab.set でタブを切り替えられる', async () => {
      mockLocationState = {};
      vi.setSystemTime(new Date(2026, 2, 11, 9, 0, 0));

      const useBriefingPageState = await importSUT();
      const { result } = renderHook(() => useBriefingPageState());

      expect(result.current.tab.value).toBe('morning');

      act(() => {
        result.current.tab.set('weekly');
      });

      expect(result.current.tab.value).toBe('weekly');
    });
  });

  // ── 2. Timeline 遷移コールバック ──────────────────────
  describe('Timeline 遷移コールバック', () => {
    it('openTimelineToday は /handoff-timeline に dayScope:"today" で遷移する', async () => {
      const useBriefingPageState = await importSUT();
      const { result } = renderHook(() => useBriefingPageState());

      act(() => {
        result.current.actions.openTimelineToday();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/handoff-timeline', {
        state: { dayScope: 'today', timeFilter: 'all' },
      });
    });

    it('openTimelineYesterday は /handoff-timeline に dayScope:"yesterday" で遷移する', async () => {
      const useBriefingPageState = await importSUT();
      const { result } = renderHook(() => useBriefingPageState());

      act(() => {
        result.current.actions.openTimelineYesterday();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/handoff-timeline', {
        state: { dayScope: 'yesterday', timeFilter: 'all' },
      });
    });
  });

  // ── 3. Weekly preload ─────────────────────────────────
  describe('Weekly preload', () => {
    it('tab を "weekly" に切り替えると preload が呼ばれる', async () => {
      mockLocationState = {};
      vi.setSystemTime(new Date(2026, 2, 11, 9, 0, 0));

      const useBriefingPageState = await importSUT();
      const { result } = renderHook(() => useBriefingPageState());

      // idle preload でも呼ばれている可能性があるのでリセット
      mockPreload.mockClear();

      act(() => {
        result.current.tab.set('weekly');
      });

      expect(mockPreload).toHaveBeenCalled();
    });

    it('preloadOnHover はエラーを投げずに完了する（fire-and-forget）', async () => {
      const useBriefingPageState = await importSUT();
      const { result } = renderHook(() => useBriefingPageState());

      // hover preload は setTimeout(150ms) 内で fire
      expect(() => {
        act(() => {
          result.current.weekly.preloadOnHover();
          vi.advanceTimersByTime(200);
        });
      }).not.toThrow();
    });
  });

  // ── 4. 戻り値の構造 ──────────────────────────────────
  describe('戻り値の構造', () => {
    it('5 つのグループ（tab, summary, timelines, weekly, actions）を返す', async () => {
      const useBriefingPageState = await importSUT();
      const { result } = renderHook(() => useBriefingPageState());

      expect(result.current).toHaveProperty('tab');
      expect(result.current).toHaveProperty('summary');
      expect(result.current).toHaveProperty('timelines');
      expect(result.current).toHaveProperty('weekly');
      expect(result.current).toHaveProperty('actions');
    });

    it('weekly.weekStartYYYYMMDD が YYYY-MM-DD 形式の文字列である', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 9, 0, 0));

      const useBriefingPageState = await importSUT();
      const { result } = renderHook(() => useBriefingPageState());

      expect(result.current.weekly.weekStartYYYYMMDD).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
