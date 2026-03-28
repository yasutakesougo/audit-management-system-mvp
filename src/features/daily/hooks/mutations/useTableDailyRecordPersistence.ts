/**
 * @fileoverview Table型の日次記録の下書き永続化処理を管理するHook
 * @description
 * localStorage への下書き保存/復元/削除ロジックを分離し、
 * 将来的な IndexedDB や Server 連携への移行を容易にする。
 */

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { TableDailyRecordData } from '../view-models/useTableDailyRecordForm';

/** Storage key for draft persistence */
const TABLE_DAILY_DRAFT_STORAGE_KEY = 'daily-table-record:draft:v1';

/**
 * 下書き保存対象スキーマ
 *
 * ✅ 保存する（入力保護・状態復元に必須）:
 *   - formData (date, reporter, userRows) — 全入力データ
 *   - selectedUserIds — 選択済み利用者の復元に必要
 *   - searchQuery — 検索状態の復元
 *   - showTodayOnly — フィルタ状態の復元
 *
 * ❌ 保存しない（一時的 or 再取得可能）:
 *   - validationErrors — 一時的な UI 状態。再バリデーション時に再生成
 *   - handoff data — 常時 API から再取得。下書きの鮮度より最新データを優先
 *   - saving flag — 一時的な処理状態
 *   - showUnsentOnly — URL パラメータから復元（useTableDailyRecordRouting）
 *   - visibleRows / unsentRowCount — formData.userRows からの派生値
 *
 * 🔄 保存時に自動付与:
 *   - savedAt — ISO タイムスタンプ（復元時に下書き日時として表示）
 *
 * 📌 今後の追加候補:
 *   - schemaVersion — 下書き互換性のためのバージョン番号
 *   - acceptedSuggestions — 提案アクション履歴（UserRowData 内に含まれるため現状は間接的に保存済み）
 */
export type TableDailyRecordDraft = {
  formData: TableDailyRecordData;
  selectedUserIds: string[];
  searchQuery: string;
  showTodayOnly: boolean;
  savedAt: string; // ISO timestamp
};

/**
 * 下書き保存用の入力データ（savedAtは自動付与される）
 */
export type DraftInput = Omit<TableDailyRecordDraft, 'savedAt'>;

export type UseTableDailyRecordPersistenceParams = {
  /** ダイアログが開かれているか（開いた時に下書きを読み込む） */
  open: boolean;
};

export type UseTableDailyRecordPersistenceReturn = {
  /** 下書き保存日時（ISO文字列）、未保存の場合はnull */
  draftSavedAt: string | null;
  /** 読み込まれた下書きデータ（nullの場合は下書きなし） */
  loadedDraft: TableDailyRecordDraft | null;
  /** 下書きを保存する */
  saveDraft: (input: DraftInput) => void;
  /** 下書きを削除する */
  clearDraft: () => void;
};

/**
 * Table型の日次記録の下書き永続化処理
 *
 * @description
 * - ダイアログが開かれた時に自動的に下書きを読み込む
 * - saveDraft() で現在の状態を localStorage に保存
 * - clearDraft() で下書きを削除
 * - 将来的な IndexedDB/Server 連携への移行を想定した設計
 *
 * @example
 * ```tsx
 * const { draftSavedAt, loadedDraft, saveDraft, clearDraft } = useTableDailyRecordPersistence({ open });
 *
 * // ダイアログが開かれた時、loadedDraft が変更される
 * useEffect(() => {
 *   if (loadedDraft) {
 *     setFormData(loadedDraft.formData);
 *     setSelectedUserIds(loadedDraft.selectedUserIds);
 *     // ...
 *   }
 * }, [loadedDraft]);
 *
 * // 保存ボタン
 * const handleSave = () => {
 *   saveDraft({ formData, selectedUserIds, searchQuery, showTodayOnly });
 * };
 * ```
 */
export function useTableDailyRecordPersistence({
  open,
}: UseTableDailyRecordPersistenceParams): UseTableDailyRecordPersistenceReturn {
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [loadedDraft, setLoadedDraft] = useState<TableDailyRecordDraft | null>(null);

  /**
   * ダイアログが開かれた時に下書きを読み込む
   * （openがfalse→trueになった時のみ実行）
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    try {
      const rawDraft = localStorage.getItem(TABLE_DAILY_DRAFT_STORAGE_KEY);
      if (!rawDraft) {
        setDraftSavedAt(null);
        setLoadedDraft(null);
        return;
      }

      const parsed = JSON.parse(rawDraft) as Partial<TableDailyRecordDraft>;

      // 必須フィールドのバリデーション
      if (!parsed.formData || !Array.isArray(parsed.selectedUserIds)) {
        console.warn('下書きデータが不正なため読み込みをスキップしました');
        setDraftSavedAt(null);
        setLoadedDraft(null);
        return;
      }

      // 下書きを復元用にセット
      const draft: TableDailyRecordDraft = {
        formData: parsed.formData,
        selectedUserIds: parsed.selectedUserIds,
        searchQuery: typeof parsed.searchQuery === 'string' ? parsed.searchQuery : '',
        showTodayOnly: typeof parsed.showTodayOnly === 'boolean' ? parsed.showTodayOnly : true,
        savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
      };

      setLoadedDraft(draft);
      setDraftSavedAt(draft.savedAt);
    } catch (error) {
      console.error('下書き復元に失敗しました:', error);
      setDraftSavedAt(null);
      setLoadedDraft(null);
    }
  }, [open]);

  /**
   * 下書きを localStorage に保存する
   *
   * @param input - 保存する下書きデータ（savedAtは自動付与）
   */
  const saveDraft = (input: DraftInput) => {
    const draft: TableDailyRecordDraft = {
      ...input,
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(TABLE_DAILY_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      setDraftSavedAt(draft.savedAt);
    } catch (error) {
      console.error('下書き保存に失敗しました:', error);
      toast.error('下書き保存に失敗しました。', { duration: 3000 });
    }
  };

  /**
   * 下書きを localStorage から削除する
   */
  const clearDraft = () => {
    try {
      localStorage.removeItem(TABLE_DAILY_DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error('下書き削除に失敗しました:', error);
    }
    setDraftSavedAt(null);
    setLoadedDraft(null);
  };

  return {
    draftSavedAt,
    loadedDraft,
    saveDraft,
    clearDraft,
  };
}
