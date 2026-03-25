import { renderHook } from '@testing-library/react';
import { useOpsMetrics, collectSuggestionActions } from '@/features/ops-dashboard/hooks/useOpsMetrics';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { UserPdcaInput } from '@/features/ops-dashboard/hooks/useOpsMetrics';

const mockDate = new Date('2026-03-25T12:00:00Z');

describe('OpsDashboard: useOpsMetrics & pure functions', () => {
  let localStorageStore: Record<string, string> = {};

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
    // モック化: localStorage の動作をエミュレート
    localStorageStore = {};
    const mockStorage = {
      getItem: vi.fn((key: string) => localStorageStore[key] || null),
      setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
      removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
      clear: vi.fn(() => { localStorageStore = {}; }),
      get length() { return Object.keys(localStorageStore).length; },
      key: vi.fn((index: number) => Object.keys(localStorageStore)[index] || null)
    };
    Object.defineProperty(window, 'localStorage', { value: mockStorage, writable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // --- 1. collectSuggestionActions (pure function behavior on localStorage) ---
  describe('collectSuggestionActions()', () => {
    it('🟢 正常系: 有効な対象キーが存在する場合、正しくアクションが抽出されること', () => {
      // Direct acceptedSuggestions (古い形式や別ルート)
      localStorageStore['daily-record-user1'] = JSON.stringify({
        acceptedSuggestions: [{ id: 'action-1', userId: 'u1', reason: 'Test 1' }]
      });
      // Nested rows (一般的な形式)
      localStorageStore['daily-record-user2'] = JSON.stringify({
        rows: [
          { acceptedSuggestions: [{ id: 'action-2', userId: 'u2', reason: 'Test 2' }] },
          { acceptedSuggestions: [] }
        ]
      });

      const actions = collectSuggestionActions();
      expect(actions).toHaveLength(2);
      expect(actions.map((a: any) => a.id)).toContain('action-1');
      expect(actions.map((a: any) => a.id)).toContain('action-2');
    });

    it('⚪ 空データ: 対象キーがない、またはキー内のデータが空の場合、クラッシュせず空配列を返すこと', () => {
      // 対象外キー
      localStorageStore['unrelated-key'] = JSON.stringify({ acceptedSuggestions: [{ id: 'invalid' }] });
      // 対象キーだがデータなし
      localStorageStore['daily-record-empty'] = JSON.stringify({});

      const actions = collectSuggestionActions();
      expect(actions).toHaveLength(0);
    });

    it('🛡️ フォールバック (エラー耐性): 不正なJSONがあっても throw せず、スキップして処理を継続すること', () => {
      localStorageStore['daily-record-valid'] = JSON.stringify({
        acceptedSuggestions: [{ id: 'valid-1' }]
      });
      localStorageStore['daily-record-invalid'] = '{{invalid json!!';
      
      // Error is not thrown
      let actions: any[] = [];
      expect(() => {
        actions = collectSuggestionActions();
      }).not.toThrow();

      // Should recover valid data despite error
      expect(actions).toHaveLength(1);
      expect((actions[0] as any).id).toBe('valid-1');
    });
  });

  // --- 2. useOpsMetrics (hook integration behavior) ---
  describe('useOpsMetrics() Hook Integration', () => {
    it('🔀 分岐・境界条件: supportStartDate が null の利用者が含まれる場合、excludedUserCount に正確にカウントされること', () => {
      const inputs: UserPdcaInput[] = [
        { userId: 'u1', supportStartDate: '2026-01-01' },
        { userId: 'u2', supportStartDate: null }, // 除外対象
        { userId: 'u3', supportStartDate: '2026-02-01' },
        { userId: 'u4', supportStartDate: null }, // 除外対象
      ];

      const { result } = renderHook(() => useOpsMetrics({ userPdcaInputs: inputs }));

      expect(result.current.isReady).toBe(true);
      expect(result.current.excludedUserCount).toBe(2);
      
      // pdcaMetrics object might exist with the other 2 users
      // (Depends on domain metric calculation logic, but it shouldn't crash)
      expect(typeof result.current.pdcaMetrics).toBe('object');
    });

    it('⚪ 空データ (hook): 入力配列が空の場合、各種メトリクスに null が代入され安全に完了すること', () => {
      const { result } = renderHook(() => useOpsMetrics({ userPdcaInputs: [] }));

      expect(result.current.isReady).toBe(true);
      expect(result.current.excludedUserCount).toBe(0);
      expect(result.current.pdcaMetrics).toBeNull();
      expect(result.current.proposalMetrics).toBeNull();
      expect(result.current.knowledgeMetrics).toBeNull();
    });
  });
});
