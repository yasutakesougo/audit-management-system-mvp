import { emitDailySubmissionEvents } from '@/features/ibd/analysis/pdca/dailyMetricsAdapter';
import { useUsers, type StoreUser } from '@/features/users/store';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { saveLastActivities } from './useLastActivities';
import { useHandoffNotesForTable } from '../adapters/useHandoffNotesForTable';
import type { TableDailyRecordFormStructured } from './tableDailyRecordFormTypes';
import { useTableDailyRecordFiltering } from './useTableDailyRecordFiltering';
import type { DraftInput } from './useTableDailyRecordPersistence';
import { useTableDailyRecordPersistence } from './useTableDailyRecordPersistence';
import { useTableDailyRecordRouting } from './useTableDailyRecordRouting';
import { useTableDailyRecordRowHandlers } from './useTableDailyRecordRowHandlers';
import { useTableDailyRecordSelection } from './useTableDailyRecordSelection';
import { toLocalDateISO } from '@/utils/getNow';
import type { DailyRecordDomain, DailyRecordUserRow } from '../domain/schema';

export type UserRowData = DailyRecordUserRow;
export type TableDailyRecordData = DailyRecordDomain;

/** バリデーションエラー構造 */
export type TableDailyRecordValidationErrors = {
  /** 日付に関するエラー */
  date?: string;
  /** 記録者名に関するエラー */
  reporterName?: string;
  /** 利用者選択に関するエラー */
  selectedUsers?: string;
  /** 行データに関するエラー（key = userId） */
  rows?: Record<string, string>;
};

export type UseTableDailyRecordFormParams = {
  open: boolean;
  onClose: () => void;
  onSave: (data: TableDailyRecordData) => Promise<void>;
};

export type UseTableDailyRecordFormResult = {
  // ── Flat fields (backward-compatible) ──────────────
  formData: TableDailyRecordData;
  setFormData: Dispatch<SetStateAction<TableDailyRecordData>>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  showTodayOnly: boolean;
  setShowTodayOnly: Dispatch<SetStateAction<boolean>>;
  filteredUsers: StoreUser[];
  selectedUsers: StoreUser[];
  selectedUserIds: string[];
  handleUserToggle: (userId: string) => void;
  handleSelectAll: () => void;
  handleClearAll: () => void;
  handleRowDataChange: (userId: string, field: string, value: string | boolean) => void;
  handleProblemBehaviorChange: (userId: string, behaviorType: string, checked: boolean) => void;
  handleBehaviorTagToggle: (userId: string, tagKey: string) => void;
  handleClearRow: (userId: string) => void;
  showUnsentOnly: boolean;
  setShowUnsentOnly: Dispatch<SetStateAction<boolean>>;
  showMissingOnly: boolean;
  setShowMissingOnly: Dispatch<SetStateAction<boolean>>;
  visibleRows: UserRowData[];
  unsentRowCount: number;
  hasDraft: boolean;
  draftSavedAt: string | null;
  handleSaveDraft: () => void;
  handleSave: () => Promise<void>;
  saving: boolean;
  /** バリデーションエラー（空オブジェクト = エラーなし） */
  validationErrors: TableDailyRecordValidationErrors;
  /** バリデーションエラーをクリアする */
  clearValidationErrors: () => void;
  /** 申し送り連携: 重要申し送りが反映された利用者数 */
  handoffAffectedUserCount: number;
  /** 申し送り連携: 重要申し送りの総件数 */
  handoffTotalCount: number;
  /** 申し送り連携: データ読み込み中 */
  handoffLoading: boolean;

  // ── Structured sub-objects ─────────────────────────
  /**
   * 構造化アクセス: 責務別サブオブジェクト。
   * フラットフィールドと同じ値を構造化して返す。
   * 消費者は `result.header.formData` のように参照可能。
   */
} & TableDailyRecordFormStructured;

const createInitialFormData = (initialDate?: string | null): TableDailyRecordData => ({
  date: initialDate ?? toLocalDateISO(),
  reporter: {
    name: '',
    role: '生活支援員',
  },
  userRows: [],
  userCount: 0,
});

/** YYYY-MM-DD 形式の日付バリデーション */
const isValidDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
};

/**
 * フォームデータのバリデーション
 * @returns エラーオブジェクト（空 = エラーなし）
 */
const validateFormData = (
  formData: TableDailyRecordData,
  selectedUserIds: string[],
): TableDailyRecordValidationErrors => {
  const errors: TableDailyRecordValidationErrors = {};

  // 日付
  if (!formData.date.trim()) {
    errors.date = '日付を入力してください';
  } else if (!isValidDate(formData.date)) {
    errors.date = '有効な日付を入力してください（例: 2026-03-03）';
  }

  // 記録者名
  if (!formData.reporter.name.trim()) {
    errors.reporterName = '記録者名を入力してください';
  }

  // 利用者選択
  if (selectedUserIds.length === 0) {
    errors.selectedUsers = '利用者を1人以上選択してください';
  }

  return errors;
};

export const useTableDailyRecordForm = ({
  open,
  onClose,
  onSave,
}: UseTableDailyRecordFormParams): UseTableDailyRecordFormResult => {
  // ── Routing ───────────────────────────────────────
  const { initialDateFromUrl, showUnsentOnly, setShowUnsentOnly, showMissingOnly, setShowMissingOnly } = useTableDailyRecordRouting(open);

  // ── Core state ────────────────────────────────────
  const [formData, setFormData] = useState<TableDailyRecordData>(() => createInitialFormData(initialDateFromUrl));
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<TableDailyRecordValidationErrors>({});

  const clearValidationErrors = useCallback(() => setValidationErrors({}), []);

  const { data: users = [] } = useUsers();

  // ── Persistence ───────────────────────────────────
  const { draftSavedAt, loadedDraft, saveDraft, clearDraft } = useTableDailyRecordPersistence({ open });

  // ── Filtering ─────────────────────────────────────
  const targetDate = useMemo(() => new Date(formData.date), [formData.date]);
  const {
    filteredUsers,
    attendanceFilteredUsers,
    filters: { showTodayOnly, setShowTodayOnly, searchQuery, setSearchQuery },
  } = useTableDailyRecordFiltering({ users, targetDate });

  // ── Selection ─────────────────────────────────────
  const {
    selectedUserIds,
    selectedUsers,
    selectionManuallyEdited: _selectionManuallyEdited,
    handleUserToggle,
    handleSelectAll,
    handleClearAll,
    setSelectedUserIds,
    setSelectionManuallyEdited,
  } = useTableDailyRecordSelection({
    open,
    showTodayOnly,
    filteredUsers,
    attendanceFilteredUsers,
    targetDate,
    users,
    loadedDraftSelectedUserIds: loadedDraft?.selectedUserIds,
    recordedUserIds: useMemo(() => formData.userRows.map(r => r.userId), [formData.userRows]),
    showMissingOnly,
  });

  // ── Handoff notes 連携 ─────────────────────────────
  const {
    notesByUser: handoffNotesByUser,
    affectedUserCount: handoffAffectedUserCount,
    totalHandoffCount: handoffTotalCount,
    loading: handoffLoading,
  } = useHandoffNotesForTable(formData.date);

  // ── Row handlers (抽出済み) ───────────────────────
  const {
    handleRowDataChange,
    handleProblemBehaviorChange,
    handleBehaviorTagToggle,
    handleClearRow,
    visibleRows,
    unsentRowCount,
  } = useTableDailyRecordRowHandlers({
    setFormData,
    selectedUsers,
    selectedUserIds,
    showUnsentOnly,
    formData,
    handoffNotesByUser,
  });

  // ── Side effects ──────────────────────────────────

  // Auto-disable unsent filter when no unsent rows remain
  useEffect(() => {
    if (showUnsentOnly && unsentRowCount === 0) {
      setShowUnsentOnly(false);
    }
  }, [showUnsentOnly, unsentRowCount, setShowUnsentOnly]);

  // Restore draft when loaded
  useEffect(() => {
    if (!loadedDraft) {
      return;
    }

    setFormData(loadedDraft.formData);
    setSearchQuery(loadedDraft.searchQuery);
    setShowTodayOnly(loadedDraft.showTodayOnly);
  }, [loadedDraft, setSearchQuery, setShowTodayOnly]);

  // ── Actions ───────────────────────────────────────

  const handleSaveDraft = useCallback(() => {
    const input: DraftInput = {
      formData,
      selectedUserIds,
      searchQuery,
      showTodayOnly,
    };
    saveDraft(input);
  }, [formData, selectedUserIds, searchQuery, showTodayOnly, saveDraft]);

  // ── Auto-save draft (debounced) ────────────────────
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 行データがなければ自動保存しない（初期状態）
    if (formData.userRows.length === 0) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveDraft();
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData, selectedUserIds, handleSaveDraft]);

  const handleSave = async () => {
    // バリデーション実行
    const errors = validateFormData(formData, selectedUserIds);
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      // 最初のエラーメッセージをトーストに表示
      const firstError = Object.values(errors)[0];
      const errorMessage = typeof firstError === 'string'
        ? firstError
        : '入力内容にエラーがあります';
      toast.error(errorMessage, { duration: 4000 });
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);

      const submittedAt = new Date().toISOString();
      const submissionEvents = selectedUserIds.map((userId) => ({
        userId,
        recordDate: formData.date,
        submittedAt,
        draftCreatedAt: draftSavedAt ?? undefined,
      }));
      emitDailySubmissionEvents(submissionEvents);

      clearDraft();
      setValidationErrors({});

      // 前回の午前・午後活動を保存（次回のプリフィル用）
      saveLastActivities(formData.userRows);

      toast.success(
        `${selectedUserIds.length}人分の活動記録を保存しました`,
        { duration: 3000 },
      );
      onClose();
      setSelectedUserIds([]);
      setSearchQuery('');
      setShowTodayOnly(true);
      setShowUnsentOnly(false);
      setSelectionManuallyEdited(false);
      setFormData(createInitialFormData());
    } catch (error) {
      console.error('保存に失敗しました:', error);
      toast.error('保存に失敗しました。もう一度お試しください。', { duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  // ── Return ────────────────────────────────────────

  const hasDraft = Boolean(draftSavedAt);

  return {
    // ── Flat fields (backward-compatible) ───────────
    formData,
    setFormData,
    searchQuery,
    setSearchQuery,
    showTodayOnly,
    setShowTodayOnly,
    filteredUsers,
    selectedUsers,
    selectedUserIds,
    handleUserToggle,
    handleSelectAll,
    handleClearAll,
    handleRowDataChange,
    handleProblemBehaviorChange,
    handleBehaviorTagToggle,
    handleClearRow,
    showUnsentOnly,
    setShowUnsentOnly,
    showMissingOnly,
    setShowMissingOnly,
    visibleRows,
    unsentRowCount,
    hasDraft,
    draftSavedAt,
    handleSaveDraft,
    handleSave,
    saving,
    validationErrors,
    clearValidationErrors,
    handoffAffectedUserCount,
    handoffTotalCount,
    handoffLoading,

    // ── Structured sub-objects ─────────────────────
    header: { formData, setFormData, validationErrors, clearValidationErrors },
    picker: {
      searchQuery, setSearchQuery,
      showTodayOnly, setShowTodayOnly,
      filteredUsers, selectedUsers, selectedUserIds,
      handleUserToggle, handleSelectAll, handleClearAll,
    },
    table: {
      handleRowDataChange, handleProblemBehaviorChange,
      handleBehaviorTagToggle, handleClearRow,
      visibleRows, showUnsentOnly, setShowUnsentOnly, 
      showMissingOnly, setShowMissingOnly,
      unsentRowCount,
    },
    draft: { hasDraft, draftSavedAt, handleSaveDraft },
    handoff: {
      affectedUserCount: handoffAffectedUserCount,
      totalCount: handoffTotalCount,
      loading: handoffLoading,
    },
    actions: { handleSave, saving },
  };
};
