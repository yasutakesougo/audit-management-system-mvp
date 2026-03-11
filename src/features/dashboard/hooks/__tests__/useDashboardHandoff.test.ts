/**
 * useDashboardHandoff — 申し送り集計 + タイムラインの接続テスト
 *
 * スコープ:
 * 1. useHandoffSummary / useHandoffTimeline の戻り値が正しく束ねられる
 * 2. total / critical / status の形が維持される
 * 3. timeline.items / loading / error の配線が壊れていない
 * 4. dayScope パラメータが正しく伝播する
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateStatus = vi.fn();
const mockReload = vi.fn();

let summaryReturnValue = {
  total: 5,
  byStatus: { pending: 2, resolved: 3 },
  criticalCount: 1,
  byCategory: { '体調': 1, '行動面': 2, '家族連絡': 0, '支援の工夫': 1, '良かったこと': 0, '事故・ヒヤリ': 1, 'その他': 0 },
};

let timelineReturnValue = {
  todayHandoffs: [
    { id: 1, content: 'テスト申し送り', status: 'pending' as const },
  ],
  loading: false,
  error: null as string | null,
  updateHandoffStatus: mockUpdateStatus,
  reload: mockReload,
};

vi.mock('@/features/handoff/useHandoffSummary', () => ({
  useHandoffSummary: (opts: { dayScope: string }) => {
    // dayScope が伝播していることを後でアサートできるように記録
    (globalThis as Record<string, unknown>).__lastSummaryDayScope = opts.dayScope;
    return summaryReturnValue;
  },
}));

vi.mock('@/features/handoff/useHandoffTimeline', () => ({
  useHandoffTimeline: (_filter: string, dayScope: string) => {
    (globalThis as Record<string, unknown>).__lastTimelineDayScope = dayScope;
    return timelineReturnValue;
  },
}));

// SUT (mock 後に dynamic import)
const importSUT = () =>
  import('../useDashboardHandoff').then((m) => m.useDashboardHandoff);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDashboardHandoff', () => {
  beforeEach(() => {
    summaryReturnValue = {
      total: 5,
      byStatus: { pending: 2, resolved: 3 },
      criticalCount: 1,
      byCategory: { '体調': 1, '行動面': 2, '家族連絡': 0, '支援の工夫': 1, '良かったこと': 0, '事故・ヒヤリ': 1, 'その他': 0 },
    };
    timelineReturnValue = {
      todayHandoffs: [
        { id: 1, content: 'テスト申し送り', status: 'pending' as const },
      ],
      loading: false,
      error: null,
      updateHandoffStatus: mockUpdateStatus,
      reload: mockReload,
    };
    mockUpdateStatus.mockClear();
    mockReload.mockClear();
  });

  // ── 1. 集計値の束ね ──────────────────────────────────
  describe('集計値の束ね', () => {
    it('total / critical / status が正しく返る', async () => {
      const useDashboardHandoff = await importSUT();
      const { result } = renderHook(() => useDashboardHandoff());

      expect(result.current.total).toBe(5);
      expect(result.current.critical).toBe(1);
      expect(result.current.status).toEqual({ pending: 2, resolved: 3 });
    });

    it('total=0 のケースでも構造が維持される', async () => {
      summaryReturnValue = {
        total: 0,
        byStatus: { pending: 0, resolved: 0 },
        criticalCount: 0,
        byCategory: { '体調': 0, '行動面': 0, '家族連絡': 0, '支援の工夫': 0, '良かったこと': 0, '事故・ヒヤリ': 0, 'その他': 0 },
      };
      const useDashboardHandoff = await importSUT();
      const { result } = renderHook(() => useDashboardHandoff());

      expect(result.current.total).toBe(0);
      expect(result.current.critical).toBe(0);
      expect(result.current.status).toEqual({ pending: 0, resolved: 0 });
    });
  });

  // ── 2. タイムライン配線 ──────────────────────────────
  describe('タイムライン配線', () => {
    it('timeline.items にデータが入る', async () => {
      const useDashboardHandoff = await importSUT();
      const { result } = renderHook(() => useDashboardHandoff());

      expect(result.current.timeline.items).toHaveLength(1);
      expect(result.current.timeline.items[0]).toHaveProperty('id', 1);
    });

    it('loading / error が伝播する', async () => {
      timelineReturnValue = {
        ...timelineReturnValue,
        loading: true,
        error: 'ネットワークエラー',
      };
      const useDashboardHandoff = await importSUT();
      const { result } = renderHook(() => useDashboardHandoff());

      expect(result.current.timeline.loading).toBe(true);
      expect(result.current.timeline.error).toBe('ネットワークエラー');
    });

    it('updateStatus / reload が関数として返る', async () => {
      const useDashboardHandoff = await importSUT();
      const { result } = renderHook(() => useDashboardHandoff());

      expect(typeof result.current.timeline.updateStatus).toBe('function');
      expect(typeof result.current.timeline.reload).toBe('function');
    });
  });

  // ── 3. dayScope パラメータ伝播 ───────────────────────
  describe('dayScope パラメータ', () => {
    it('デフォルトは "today"', async () => {
      const useDashboardHandoff = await importSUT();
      renderHook(() => useDashboardHandoff());

      expect((globalThis as Record<string, unknown>).__lastSummaryDayScope).toBe('today');
      expect((globalThis as Record<string, unknown>).__lastTimelineDayScope).toBe('today');
    });

    it('"yesterday" を渡すと伝播する', async () => {
      const useDashboardHandoff = await importSUT();
      renderHook(() => useDashboardHandoff('yesterday'));

      expect((globalThis as Record<string, unknown>).__lastSummaryDayScope).toBe('yesterday');
      expect((globalThis as Record<string, unknown>).__lastTimelineDayScope).toBe('yesterday');
    });
  });

  // ── 4. 戻り値の構造 ──────────────────────────────────
  describe('戻り値の構造', () => {
    it('DashboardHandoffGroup の全キーが存在する', async () => {
      const useDashboardHandoff = await importSUT();
      const { result } = renderHook(() => useDashboardHandoff());

      expect(result.current).toHaveProperty('total');
      expect(result.current).toHaveProperty('critical');
      expect(result.current).toHaveProperty('status');
      expect(result.current).toHaveProperty('byCategory');
      expect(result.current).toHaveProperty('timeline');
      expect(result.current.timeline).toHaveProperty('items');
      expect(result.current.timeline).toHaveProperty('loading');
      expect(result.current.timeline).toHaveProperty('error');
      expect(result.current.timeline).toHaveProperty('updateStatus');
      expect(result.current.timeline).toHaveProperty('reload');
    });
  });
});
