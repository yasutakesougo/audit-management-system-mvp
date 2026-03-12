/**
 * useDashboardUIState — UI ステート管理の接続テスト
 *
 * スコープ:
 * 1. dailyStatusCards が dailyRecordStatus から正しく生成される
 * 2. dateLabel が日本語フォーマット
 * 3. todayChanges の構造
 * 4. handleTabChange の guard（admin タブ範囲外リセット）
 * 5. isMorningTime / isEveningTime の時間判定
 * 6. users / visits のパススルー
 */

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/features/auth/store', () => ({
  canAccessDashboardAudience: (role: string, target: string) => role === target,
}));

vi.mock('@/features/dashboard/sections/buildSections', () => ({
  getDashboardAnchorIdByKey: () => ({
    attendance: 'section-attendance',
    handoff: 'section-handoff',
  }),
}));

// SUT (mock 後に dynamic import)
const importSUT = () =>
  import('../useDashboardUIState').then((m) => m.useDashboardUIState);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultStatus = { pending: 3, inProgress: 2, completed: 5, total: 10 };
const emptyUsers: never[] = [];
const emptyVisits = {};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDashboardUIState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── 1. dailyStatusCards ──────────────────────────────
  describe('dailyStatusCards', () => {
    it('dailyRecordStatus から 3 枚のカードが生成される', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 10, 0, 0));
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, emptyUsers, emptyVisits),
      );

      const cards = result.current.dailyStatusCards;
      expect(cards).toHaveLength(3);

      // 未入力
      expect(cards[0].label).toBe('未入力');
      expect(cards[0].value).toBe(3);
      expect(cards[0].emphasize).toBe(true);

      // 入力途中
      expect(cards[1].label).toBe('入力途中');
      expect(cards[1].value).toBe(2);

      // 完了
      expect(cards[2].label).toBe('完了');
      expect(cards[2].value).toBe(5);
    });

    it('helper に対象人数が含まれる', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 10, 0, 0));
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, emptyUsers, emptyVisits),
      );

      result.current.dailyStatusCards.forEach((card) => {
        expect(card.helper).toContain('10名');
      });
    });

    it('全員完了のとき未入力は 0', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 10, 0, 0));
      const allDone = { pending: 0, inProgress: 0, completed: 10, total: 10 };
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', allDone, emptyUsers, emptyVisits),
      );

      expect(result.current.dailyStatusCards[0].value).toBe(0);
    });
  });

  // ── 2. dateLabel ─────────────────────────────────────
  describe('dateLabel', () => {
    it('日本語フォーマットの日付文字列が返る', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 10, 0, 0));
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, emptyUsers, emptyVisits),
      );

      // 3/11(水) or 3月11日(水) のような形式
      expect(result.current.dateLabel).toMatch(/\d{1,2}[月/]\d{1,2}/);
    });
  });

  // ── 3. todayChanges ──────────────────────────────────
  describe('todayChanges', () => {
    it('空配列の userChanges / staffChanges を返す', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 10, 0, 0));
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, emptyUsers, emptyVisits),
      );

      expect(result.current.todayChanges).toEqual({
        userChanges: [],
        staffChanges: [],
      });
    });
  });

  // ── 3b. lifeSupport ───────────────────────────────────
  describe('lifeSupport', () => {
    it('visits が空なら SS=0, 一時ケア=0', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 10, 0, 0));
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, emptyUsers, emptyVisits),
      );

      expect(result.current.lifeSupport).toEqual({
        shortStayCount: 0,
        temporaryCareCount: 0,
      });
    });

    it('visits に short_stay / temporary_care があれば件数をカウント', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 10, 0, 0));
      const visits = {
        'u1': { userCode: 'u1', status: '通所中', transportToMethod: 'short_stay' },
        'u2': { userCode: 'u2', status: '通所中', transportFromMethod: 'short_stay' },
        'u3': { userCode: 'u3', status: '通所中', transportToMethod: 'temporary_care' },
        'u4': { userCode: 'u4', status: '通所中' },
      } as never;
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, emptyUsers, visits),
      );

      expect(result.current.lifeSupport).toEqual({
        shortStayCount: 2,
        temporaryCareCount: 1,
      });
    });
  });

  // ── 4. isMorningTime / isEveningTime ────────────────
  describe('時間帯判定', () => {
    it('8:00 は isMorningTime=true', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 8, 0, 0));
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, emptyUsers, emptyVisits),
      );
      expect(result.current.isMorningTime).toBe(true);
      expect(result.current.isEveningTime).toBe(false);
    });

    it('11:59 は isMorningTime=true', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 11, 59, 0));
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, emptyUsers, emptyVisits),
      );
      expect(result.current.isMorningTime).toBe(true);
    });

    it('12:00 は isMorningTime=false', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 12, 0, 0));
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, emptyUsers, emptyVisits),
      );
      expect(result.current.isMorningTime).toBe(false);
    });

    it('17:00 は isEveningTime=true', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 17, 0, 0));
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, emptyUsers, emptyVisits),
      );
      expect(result.current.isEveningTime).toBe(true);
    });

    it('18:59 は isEveningTime=true', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 18, 59, 0));
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, emptyUsers, emptyVisits),
      );
      expect(result.current.isEveningTime).toBe(true);
    });

    it('19:00 は isEveningTime=false', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 19, 0, 0));
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, emptyUsers, emptyVisits),
      );
      expect(result.current.isEveningTime).toBe(false);
    });
  });

  // ── 5. handleTabChange ──────────────────────────────
  describe('handleTabChange', () => {
    it('タブインデックスを変更できる', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 10, 0, 0));
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, emptyUsers, emptyVisits),
      );

      expect(result.current.tabValue).toBe(0);

      act(() => {
        result.current.handleTabChange({} as React.SyntheticEvent, 2);
      });

      expect(result.current.tabValue).toBe(2);
    });
  });

  // ── 6. users / visits パススルー ────────────────────
  describe('users / visits パススルー', () => {
    it('引数の users がそのまま返る', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 10, 0, 0));
      const users = [{ id: '1', name: 'テスト太郎' }] as never[];
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, users, emptyVisits),
      );

      expect(result.current.users).toBe(users);
    });

    it('引数の visits がそのまま返る', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 10, 0, 0));
      const visits = { 'user-1': { status: 'present' } } as never;
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, emptyUsers, visits),
      );

      expect(result.current.visits).toBe(visits);
    });
  });

  // ── 7. 戻り値の構造 ────────────────────────────────
  describe('戻り値の構造', () => {
    it('DashboardUIGroup の全キーが存在する', async () => {
      vi.setSystemTime(new Date(2026, 2, 11, 10, 0, 0));
      const useDashboardUIState = await importSUT();
      const { result } = renderHook(() =>
        useDashboardUIState('staff', defaultStatus, emptyUsers, emptyVisits),
      );

      expect(result.current).toHaveProperty('tabValue');
      expect(result.current).toHaveProperty('handleTabChange');
      expect(result.current).toHaveProperty('showAttendanceNames');
      expect(result.current).toHaveProperty('setShowAttendanceNames');
      expect(result.current).toHaveProperty('highlightSection');
      expect(result.current).toHaveProperty('scrollToSection');
      expect(result.current).toHaveProperty('sectionIdByKey');
      expect(result.current).toHaveProperty('dateLabel');
      expect(result.current).toHaveProperty('todayChanges');
      expect(result.current).toHaveProperty('lifeSupport');
      expect(result.current).toHaveProperty('dailyStatusCards');
      expect(result.current).toHaveProperty('isMorningTime');
      expect(result.current).toHaveProperty('isEveningTime');
      expect(result.current).toHaveProperty('users');
      expect(result.current).toHaveProperty('visits');
    });
  });
});
