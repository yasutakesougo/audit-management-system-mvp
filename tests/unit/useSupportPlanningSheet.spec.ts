/**
 * @fileoverview useSupportPlanningSheet Hook テスト
 * @description
 * Phase 5-D:
 *   - 初期読込（空 / 既存レコード）
 *   - saveDraft 成功 / 失敗
 *   - hasSaved フラグ
 *   - userId 変更時の再取得
 *   - latestRecord の導出
 *   - アンマウント後の安全性
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  SaveSupportPlanningSheetInput,
  SupportPlanningSheetRecord,
} from '@/features/monitoring/domain/supportPlanningSheetTypes';
import type { SupportPlanningSheetRepository } from '@/features/monitoring/data/SupportPlanningSheetRepository';

// ── mock をファクトリで差し替え ────────────────────────────

const { mockList, mockSave, mockRepo } = vi.hoisted(() => {
  const list = vi.fn<SupportPlanningSheetRepository['list']>();
  const save = vi.fn<SupportPlanningSheetRepository['save']>();
  return {
    mockList: list,
    mockSave: save,
    mockRepo: { list, save },
  };
});

vi.mock('@/features/monitoring/data/createSupportPlanningSheetRepository', () => ({
  useSupportPlanningSheetRepository: () => mockRepo,
  createSupportPlanningSheetRepository: () => mockRepo,
}));

// hook import は mock 定義の後
import { useSupportPlanningSheet } from '@/features/monitoring/hooks/useSupportPlanningSheet';

// ── テスト用ヘルパー ──────────────────────────────────────

function createRecord(overrides?: Partial<SupportPlanningSheetRecord>): SupportPlanningSheetRecord {
  return {
    id: `sps-test-${Math.random().toString(36).slice(2)}`,
    userId: 'user-1',
    goalId: 'goal-1',
    goalLabel: '生活リズムの安定',
    decisionStatus: 'accepted',
    decisionNote: 'テスト判断',
    decisionBy: 'admin@example.com',
    decisionAt: '2026-03-15T10:00:00Z',
    recommendationLevel: 'adjust-support',
    snapshot: {
      level: 'adjust-support',
      reason: 'テスト理由',
      progressLevel: 'declining',
      rate: 0.3,
      trend: 'down',
      matchedRecordCount: 5,
      matchedTagCount: 3,
    },
    ...overrides,
  };
}

function createInput(overrides?: Partial<SaveSupportPlanningSheetInput>): SaveSupportPlanningSheetInput {
  const { id: _id, ...base } = createRecord();
  return { ...base, ...overrides } as SaveSupportPlanningSheetInput;
}

// ── テスト本体 ──────────────────────────────────────────

describe('useSupportPlanningSheet', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockSave.mockReset();
    // デフォルトで空配列を返す
    mockList.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 初期ローディング ────────────────────────────────

  describe('初期ローディング', () => {
    it('userId が空文字の場合は list を呼ばない', () => {
      renderHook(() => useSupportPlanningSheet(''));
      expect(mockList).not.toHaveBeenCalled();
    });

    it('userId が指定されると list を1回呼ぶ', async () => {
      renderHook(() => useSupportPlanningSheet('user-1'));
      await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1));
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
      );
    });

    it('取得結果が records に反映される', async () => {
      const existing = [createRecord(), createRecord({ goalId: 'goal-2' })];
      mockList.mockResolvedValue(existing);

      const { result } = renderHook(() => useSupportPlanningSheet('user-1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.records).toHaveLength(2);
    });

    it('初期ロード中は isLoading が true', async () => {
      // delay を挟む
      mockList.mockImplementation(() => new Promise((r) => setTimeout(() => r([]), 50)));

      const { result } = renderHook(() => useSupportPlanningSheet('user-1'));
      // 初期状態
      expect(result.current.isLoading).toBe(true);
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it('ロード失敗時は error がセットされる', async () => {
      mockList.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSupportPlanningSheet('user-1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error!.message).toBe('Network error');
    });
  });

  // ─── latestRecord ─────────────────────────────────────

  describe('latestRecord', () => {
    it('レコードが空の場合は null', async () => {
      const { result } = renderHook(() => useSupportPlanningSheet('user-1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.latestRecord).toBeNull();
    });

    it('レコードがある場合は先頭要素を返す', async () => {
      const r1 = createRecord({ id: 'first' });
      const r2 = createRecord({ id: 'second' });
      mockList.mockResolvedValue([r1, r2]);

      const { result } = renderHook(() => useSupportPlanningSheet('user-1'));
      await waitFor(() => expect(result.current.records).toHaveLength(2));

      expect(result.current.latestRecord?.id).toBe('first');
    });
  });

  // ─── saveDraft ─────────────────────────────────────────

  describe('saveDraft', () => {
    it('成功時: records 先頭に追加 + hasSaved = true', async () => {
      const saved = createRecord({ id: 'saved-1' });
      mockSave.mockResolvedValue(saved);

      const { result } = renderHook(() => useSupportPlanningSheet('user-1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let returnValue: SupportPlanningSheetRecord | null = null;
      await act(async () => {
        returnValue = await result.current.saveDraft(createInput());
      });

      expect(returnValue).not.toBeNull();
      expect(returnValue!.id).toBe('saved-1');
      expect(result.current.records[0].id).toBe('saved-1');
      expect(result.current.hasSaved).toBe(true);
      expect(result.current.isSaving).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('保存中は isSaving が true', async () => {
      let resolveSave!: (v: SupportPlanningSheetRecord) => void;
      mockSave.mockImplementation(
        () => new Promise<SupportPlanningSheetRecord>((r) => { resolveSave = r; }),
      );

      const { result } = renderHook(() => useSupportPlanningSheet('user-1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // 保存開始
      let savePromise: Promise<unknown>;
      act(() => {
        savePromise = result.current.saveDraft(createInput());
      });

      // isSaving = true を確認
      expect(result.current.isSaving).toBe(true);

      // 完了
      await act(async () => {
        resolveSave(createRecord());
        await savePromise!;
      });

      expect(result.current.isSaving).toBe(false);
    });

    it('失敗時: error がセットされ null を返す', async () => {
      mockSave.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useSupportPlanningSheet('user-1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let returnValue: SupportPlanningSheetRecord | null = null;
      await act(async () => {
        returnValue = await result.current.saveDraft(createInput());
      });

      expect(returnValue).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error!.message).toBe('Save failed');
      expect(result.current.hasSaved).toBe(false);
    });

    it('連続保存: 新しいレコードが先頭に加わる', async () => {
      const saved1 = createRecord({ id: 'first-save' });
      const saved2 = createRecord({ id: 'second-save' });
      mockSave.mockResolvedValueOnce(saved1).mockResolvedValueOnce(saved2);

      const { result } = renderHook(() => useSupportPlanningSheet('user-1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => { await result.current.saveDraft(createInput()); });
      await act(async () => { await result.current.saveDraft(createInput()); });

      expect(result.current.records[0].id).toBe('second-save');
      expect(result.current.records[1].id).toBe('first-save');
    });

    it('保存成功後に再度保存するとき hasSaved はリセットされる', async () => {
      let callCount = 0;
      mockSave.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) throw new Error('Second call fails');
        return createRecord();
      });

      const { result } = renderHook(() => useSupportPlanningSheet('user-1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // 1回目: 成功
      await act(async () => { await result.current.saveDraft(createInput()); });
      expect(result.current.hasSaved).toBe(true);

      // 2回目: 失敗 → hasSaved は false に戻る
      await act(async () => { await result.current.saveDraft(createInput()); });
      expect(result.current.hasSaved).toBe(false);
    });
  });

  // ─── userId 変更 ───────────────────────────────────────

  describe('userId 変更時', () => {
    it('別の userId に切り替えると list が再呼出しされる', async () => {
      mockList
        .mockResolvedValueOnce([createRecord({ userId: 'user-1' })])
        .mockResolvedValueOnce([createRecord({ userId: 'user-2' }), createRecord({ userId: 'user-2' })]);

      const { result, rerender } = renderHook(
        ({ uid }) => useSupportPlanningSheet(uid),
        { initialProps: { uid: 'user-1' } },
      );

      await waitFor(() => expect(result.current.records).toHaveLength(1));

      rerender({ uid: 'user-2' });

      await waitFor(() => expect(result.current.records).toHaveLength(2));
      expect(mockList).toHaveBeenCalledTimes(2);
    });
  });
});
