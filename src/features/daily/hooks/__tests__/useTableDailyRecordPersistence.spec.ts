/**
 * useTableDailyRecordPersistence のユニットテスト
 *
 * localStorage を用いた下書きの保存・復元・破棄ロジックを検証する。
 * vitest.setup.ts で localStorage モックが提供されているため、
 * 追加のモック設定は不要。
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TableDailyRecordData } from '../useTableDailyRecordForm';
import type { DraftInput, TableDailyRecordDraft } from '../useTableDailyRecordPersistence';
import { useTableDailyRecordPersistence } from '../useTableDailyRecordPersistence';

// ── Helpers ─────────────────────────────────────────

const STORAGE_KEY = 'daily-table-record:draft:v1';

const createTestFormData = (overrides?: Partial<TableDailyRecordData>): TableDailyRecordData => ({
  date: '2026-03-03',
  reporter: { name: 'テスト担当者', role: '生活支援員' },
  userRows: [],
  ...overrides,
});

const createTestDraftInput = (overrides?: Partial<DraftInput>): DraftInput => ({
  formData: createTestFormData(),
  selectedUserIds: ['U001', 'U002'],
  searchQuery: '',
  showTodayOnly: true,
  ...overrides,
});

const createTestDraft = (overrides?: Partial<TableDailyRecordDraft>): TableDailyRecordDraft => ({
  ...createTestDraftInput(),
  savedAt: '2026-03-03T12:00:00.000Z',
  ...overrides,
});

// ── Tests ───────────────────────────────────────────

describe('useTableDailyRecordPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── 初期状態 ─────────────────────────────────

  describe('初期状態', () => {
    it('open=false の場合、下書きを読み込まない', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordPersistence({ open: false }),
      );

      expect(result.current.draftSavedAt).toBeNull();
      expect(result.current.loadedDraft).toBeNull();
    });

    it('localStorage が空の場合、null を返す', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordPersistence({ open: true }),
      );

      expect(result.current.draftSavedAt).toBeNull();
      expect(result.current.loadedDraft).toBeNull();
    });
  });

  // ── 下書き復元 ───────────────────────────────

  describe('下書き復元 (open=true)', () => {
    it('有効な下書きデータを正しく復元する', () => {
      const draft = createTestDraft();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));

      const { result } = renderHook(() =>
        useTableDailyRecordPersistence({ open: true }),
      );

      expect(result.current.loadedDraft).not.toBeNull();
      expect(result.current.loadedDraft?.formData.date).toBe('2026-03-03');
      expect(result.current.loadedDraft?.selectedUserIds).toEqual(['U001', 'U002']);
      expect(result.current.draftSavedAt).toBe('2026-03-03T12:00:00.000Z');
    });

    it('open が false → true に変わったタイミングで下書きを読み込む', () => {
      const draft = createTestDraft();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));

      const { result, rerender } = renderHook(
        ({ open }) => useTableDailyRecordPersistence({ open }),
        { initialProps: { open: false } },
      );

      expect(result.current.loadedDraft).toBeNull();

      rerender({ open: true });

      expect(result.current.loadedDraft).not.toBeNull();
      expect(result.current.loadedDraft?.formData.date).toBe('2026-03-03');
    });

    it('searchQuery が欠損している下書きデータを空文字で補完する', () => {
      const draft = createTestDraft();
      const incomplete = { ...draft } as Record<string, unknown>;
      delete incomplete.searchQuery;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(incomplete));

      const { result } = renderHook(() =>
        useTableDailyRecordPersistence({ open: true }),
      );

      expect(result.current.loadedDraft?.searchQuery).toBe('');
    });

    it('showTodayOnly が欠損している場合 true をデフォルトにする', () => {
      const draft = createTestDraft();
      const incomplete = { ...draft } as Record<string, unknown>;
      delete incomplete.showTodayOnly;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(incomplete));

      const { result } = renderHook(() =>
        useTableDailyRecordPersistence({ open: true }),
      );

      expect(result.current.loadedDraft?.showTodayOnly).toBe(true);
    });

    it('savedAt が欠損している場合、現在時刻を代入する', () => {
      const draft = createTestDraft();
      const incomplete = { ...draft } as Record<string, unknown>;
      delete incomplete.savedAt;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(incomplete));

      const { result } = renderHook(() =>
        useTableDailyRecordPersistence({ open: true }),
      );

      expect(result.current.loadedDraft?.savedAt).toBeTruthy();
      // ISO format check
      expect(result.current.loadedDraft?.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ── 不正データの復元 ─────────────────────────

  describe('不正データのハンドリング', () => {
    it('formData が欠損している場合、読み込みをスキップする', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        selectedUserIds: ['U001'],
        searchQuery: '',
        showTodayOnly: true,
        savedAt: '2026-03-03T12:00:00.000Z',
      }));

      const { result } = renderHook(() =>
        useTableDailyRecordPersistence({ open: true }),
      );

      expect(result.current.loadedDraft).toBeNull();
      expect(result.current.draftSavedAt).toBeNull();
    });

    it('selectedUserIds が配列でない場合、読み込みをスキップする', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        formData: createTestFormData(),
        selectedUserIds: 'not-an-array',
        savedAt: '2026-03-03T12:00:00.000Z',
      }));

      const { result } = renderHook(() =>
        useTableDailyRecordPersistence({ open: true }),
      );

      expect(result.current.loadedDraft).toBeNull();
    });

    it('JSON パースに失敗する不正な文字列の場合、エラーなく動作する', () => {
      localStorage.setItem(STORAGE_KEY, '{invalid json!!!');

      const { result } = renderHook(() =>
        useTableDailyRecordPersistence({ open: true }),
      );

      expect(result.current.loadedDraft).toBeNull();
      expect(result.current.draftSavedAt).toBeNull();
    });

    it('空文字列が保存されている場合、null を返す', () => {
      localStorage.setItem(STORAGE_KEY, '');

      const { result } = renderHook(() =>
        useTableDailyRecordPersistence({ open: true }),
      );

      // Empty string → JSON.parse fails → catch → null
      expect(result.current.loadedDraft).toBeNull();
    });
  });

  // ── 下書き保存 ───────────────────────────────

  describe('saveDraft', () => {
    it('下書きを localStorage に保存する', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordPersistence({ open: true }),
      );

      const input = createTestDraftInput();

      act(() => {
        result.current.saveDraft(input);
      });

      expect(result.current.draftSavedAt).toBeTruthy();

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!) as TableDailyRecordDraft;
      expect(parsed.formData.date).toBe('2026-03-03');
      expect(parsed.selectedUserIds).toEqual(['U001', 'U002']);
      expect(parsed.savedAt).toBeTruthy();
    });

    it('保存のたびに savedAt が更新される', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordPersistence({ open: true }),
      );

      const input = createTestDraftInput();

      act(() => {
        result.current.saveDraft(input);
      });

      const first = result.current.draftSavedAt;

      act(() => {
        result.current.saveDraft({
          ...input,
          searchQuery: 'updated',
        });
      });

      const second = result.current.draftSavedAt;

      // Both should exist
      expect(first).toBeTruthy();
      expect(second).toBeTruthy();

      // Verify stored data has updated content
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as TableDailyRecordDraft;
      expect(stored.searchQuery).toBe('updated');
    });

    it('localStorage.setItem が例外を投げた場合、クラッシュしない', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordPersistence({ open: false }),
      );

      // draftSavedAt is null initially
      expect(result.current.draftSavedAt).toBeNull();

      // Mock the globally stubbed localStorage to throw
      const originalSetItem = localStorage.setItem;
      (localStorage as unknown as { setItem: typeof localStorage.setItem }).setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      act(() => {
        // Should not throw
        result.current.saveDraft(createTestDraftInput());
      });

      // draftSavedAt should not be updated on failure
      expect(result.current.draftSavedAt).toBeNull();

      // Restore
      (localStorage as unknown as { setItem: typeof localStorage.setItem }).setItem = originalSetItem;
    });
  });

  // ── 下書き削除 ───────────────────────────────

  describe('clearDraft', () => {
    it('下書きを localStorage から削除する', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(createTestDraft()));

      const { result } = renderHook(() =>
        useTableDailyRecordPersistence({ open: true }),
      );

      expect(result.current.loadedDraft).not.toBeNull();

      act(() => {
        result.current.clearDraft();
      });

      expect(result.current.draftSavedAt).toBeNull();
      expect(result.current.loadedDraft).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('下書きが存在しない場合でもエラーなく動作する', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordPersistence({ open: true }),
      );

      act(() => {
        // Should not throw
        result.current.clearDraft();
      });

      expect(result.current.draftSavedAt).toBeNull();
      expect(result.current.loadedDraft).toBeNull();
    });
  });
});
