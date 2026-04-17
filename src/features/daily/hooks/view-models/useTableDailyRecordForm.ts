import { useUsers } from '@/features/users/store';
import type { StoreUser } from '@/features/users/store';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useHandoffNotesForTable } from '../../repositories/adapters/useHandoffNotesForTable';
import type { TableDailyRecordFormStructured, TableDailyRecordViewModel } from './tableDailyRecordFormTypes';
import type { TableDailyRecordRow } from '../../table/models/tableDailyRecordRow';
import { useTableDailyRecordFiltering } from '../orchestrators/useTableDailyRecordFiltering';
import { useTableDailyRecordHydrationOrchestrator, createInitialFormData } from '../orchestrators/useTableDailyRecordHydrationOrchestrator';
import { useTableDailyRecordSaveOrchestrator } from '../orchestrators/useTableDailyRecordSaveOrchestrator';
import { useTableDailyRecordRouting } from '../orchestrators/useTableDailyRecordRouting';
import { useTableDailyRecordRowHandlers } from '../orchestrators/useTableDailyRecordRowHandlers';
import { useTableDailyRecordSelection } from '../orchestrators/useTableDailyRecordSelection';
import { buildTableDailyRecordRows } from '../../table/models/buildTableDailyRecordRows';
import { appendSuggestionMemo, createSuggestionAction } from '../../domain/legacy/suggestionAction';
import type { PatternSuggestion } from '../../domain/behavior/behaviorPatternSuggestions';

import type { DailyRecordDomain, DailyRecordUserRow } from '../../domain/schema';

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

import type { DailyRecordRepository } from '../../domain/legacy/DailyRecordRepository';

export type UseTableDailyRecordFormParams = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  repository: DailyRecordRepository;
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
  visibleRows: TableDailyRecordRow[];
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

  // ── Initialization state (Hydration Orchestrator) ──
  hydrationLoading: boolean;
  hydrated: boolean;
  hydrationError: Error | null;

  // ── Structured sub-objects ─────────────────────────
  /**
   * 構造化アクセス: 責務別サブオブジェクト。
   * フラットフィールドと同じ値を構造化して返す。
   * 消費者は `result.header.formData` のように参照可能。
   */
  vm: TableDailyRecordViewModel;
} & TableDailyRecordFormStructured;


export const useTableDailyRecordForm = ({
  open,
  onClose,
  onSuccess,
  repository,
}: UseTableDailyRecordFormParams): UseTableDailyRecordFormResult => {
  // ── Routing ───────────────────────────────────────
  const { initialDateFromUrl, showUnsentOnly, setShowUnsentOnly, showMissingOnly, setShowMissingOnly } = useTableDailyRecordRouting(open);

  const { data: users = [] } = useUsers();

  // ── Hydration / Initialization Orchestrator ─────────
  const {
    formData,
    setFormData,
    searchQuery,
    setSearchQuery,
    showTodayOnly,
    setShowTodayOnly,
    loading: hydrationLoading,
    hydrated,
    error: hydrationError,
    initialSelectedUserIds,
    hasDraft,
    draftSavedAt,
    handleSaveDraft,
    clearDraft,
  } = useTableDailyRecordHydrationOrchestrator({
    open,
    initialDateFromUrl,
    repository,
  });

  // ── Filtering ─────────────────────────────────────
  const targetDate = useMemo(() => new Date(formData.date), [formData.date]);
  const {
    filteredUsers,
    attendanceFilteredUsers,
  } = useTableDailyRecordFiltering({ 
    users, 
    targetDate,
    showTodayOnly,
    searchQuery,
  });

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
    loadedDraftSelectedUserIds: initialSelectedUserIds,
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
    visibleRows: rawVisibleRows,
    unsentRowCount,
  } = useTableDailyRecordRowHandlers({
    setFormData,
    selectedUsers,
    selectedUserIds,
    showUnsentOnly,
    formData,
    handoffNotesByUser,
  });

  const tableRows = useMemo(() => buildTableDailyRecordRows(rawVisibleRows), [rawVisibleRows]);

  // ── Side effects ──────────────────────────────────

  // Auto-disable unsent filter when no unsent rows remain
  useEffect(() => {
    if (showUnsentOnly && unsentRowCount === 0) {
      setShowUnsentOnly(false);
    }
  }, [showUnsentOnly, unsentRowCount, setShowUnsentOnly]);

  // ── Auto-save draft (debounced) ────────────────────
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 行データがなければ自動保存しない（初期状態）
    if (formData.userRows.length === 0) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveDraft(selectedUserIds);
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData, selectedUserIds, handleSaveDraft]);

  // ── Actions ────────────────────────────────────────

  const handleSaveDraftVoid = useCallback(() => {
    handleSaveDraft(selectedUserIds);
  }, [handleSaveDraft, selectedUserIds]);

  // ── Save Orchestrator ──────────────────────────────
  const handleSaveSuccess = useCallback(() => {
    onClose();
    setSelectedUserIds([]);
    setSearchQuery('');
    setShowTodayOnly(true);
    setShowUnsentOnly(false);
    setSelectionManuallyEdited(false);
    setFormData(createInitialFormData());
    onSuccess();
  }, [onClose, setSelectedUserIds, setSearchQuery, setShowTodayOnly, setShowUnsentOnly, setSelectionManuallyEdited, setFormData, onSuccess]);

  const {
    saving,
    validationErrors,
    clearValidationErrors,
    handleSave,
  } = useTableDailyRecordSaveOrchestrator({
    formData,
    selectedUserIds,
    repository,
    draftSavedAt,
    clearDraft,
    onSuccess: handleSaveSuccess,
  });

  // ── ViewModel Architecture (PR 3-C) ───────────────
  const vm: TableDailyRecordViewModel = {
    state: {
      formData,
      targetDate: formData.date,
      selectedUserIds,
      filteredUsers,
      visibleRows: tableRows,
      searchQuery,
      showTodayOnly,
      showUnsentOnly,
      showMissingOnly,
      validationErrors,
      handoff: {
        loading: handoffLoading,
        totalCount: handoffTotalCount,
        affectedUserCount: handoffAffectedUserCount,
      },
      loading: hydrationLoading || handoffLoading,
      saving,
      error: hydrationError,
    },
    flags: {
      hydrated,
      isDirty: unsentRowCount > 0, // Simplified flag
      canSave: selectedUserIds.length > 0 && !saving,
      canReset: hasDraft,
      showDraftNotice: hasDraft && !hydrated,
      showEmptyState: tableRows.length === 0,
      hasValidationErrors: Object.keys(validationErrors).length > 0,
    },
    actions: {
      changeDate: useCallback((date: string) => {
        setFormData((prev) => ({ ...prev, date }));
      }, [setFormData]),
      changeSelectedUsers: setSelectedUserIds,
      changeRecorder: useCallback((recorder: string) => {
        setFormData((prev) => ({ ...prev, reporter: { ...prev.reporter, name: recorder } }));
      }, [setFormData]),
      updateRowData: handleRowDataChange,
      clearRowData: handleClearRow,
      changeProblemBehavior: handleProblemBehaviorChange,
      toggleBehaviorTag: handleBehaviorTagToggle,
      acceptSuggestion: useCallback((userId: string, suggestion: PatternSuggestion) => {
        setFormData(prev => {
          const row = prev.userRows.find(r => r.userId === userId);
          if (!row) return prev;
          const newNotes = appendSuggestionMemo(row.specialNotes, suggestion, prev.date);
          const action = createSuggestionAction(suggestion, 'accept', userId);
          // Explicitly cast to the SSOT structure to satisfy the row update
          const domainAction = {
            ...action,
            category: action.category as import('../../domain/behavior/behaviorPatternSuggestions').SuggestionCategory
          };
          return {
            ...prev,
            userRows: prev.userRows.map(r =>
              r.userId === userId
                ? { ...r, specialNotes: newNotes, acceptedSuggestions: [...(r.acceptedSuggestions ?? []), domainAction] }
                : r,
            ),
          };
        });
      }, [setFormData]),
      dismissSuggestion: useCallback((userId: string, suggestion: PatternSuggestion) => {
        setFormData(prev => {
          const action = createSuggestionAction(suggestion, 'dismiss', userId);
          // Explicitly cast to the SSOT structure to satisfy the row update
          const domainAction = {
            ...action,
            category: action.category as import('../../domain/behavior/behaviorPatternSuggestions').SuggestionCategory
          };
          return {
            ...prev,
            userRows: prev.userRows.map(r =>
              r.userId === userId
                ? { ...r, acceptedSuggestions: [...(r.acceptedSuggestions ?? []), domainAction] }
                : r,
            ),
          };
        });
      }, [setFormData]),
      setSearchQuery,
      setShowTodayOnly,
      setShowUnsentOnly,
      setShowMissingOnly,
      toggleUser: handleUserToggle,
      selectAllUsers: handleSelectAll,
      clearAllUsers: handleClearAll,
      clearValidationErrors,
      save: handleSave,
      saveDraft: handleSaveDraftVoid,
      clearDraft,
      reset: useCallback(() => {
        setFormData(createInitialFormData());
        setSelectedUserIds([]);
        setSearchQuery('');
        clearDraft();
      }, [setFormData, setSelectedUserIds, setSearchQuery, clearDraft]),
    },
    sections: {
      picker: {
        formDate: formData.date,
        searchQuery,
        onSearchQueryChange: setSearchQuery,
        showTodayOnly,
        onToggleShowToday: () => setShowTodayOnly(!showTodayOnly),
        onSelectAll: handleSelectAll,
        onClearAll: handleClearAll,
        filteredUsers,
        selectedUserIds,
        onUserToggle: handleUserToggle,
      },
      table: {
        rows: tableRows,
        onRowDataChange: handleRowDataChange,
        onProblemBehaviorChange: handleProblemBehaviorChange,
        onBehaviorTagToggle: handleBehaviorTagToggle,
        onClearRow: handleClearRow,
        showUnsentOnly,
        onToggleUnsentOnly: () => setShowUnsentOnly(!showUnsentOnly),
        showMissingOnly,
        onToggleMissingOnly: () => setShowMissingOnly(!showMissingOnly),
      },
      suggestion: {
        visibleRows: tableRows,
        acceptSuggestion: (userId, suggestion) => vm.actions.acceptSuggestion(userId, suggestion),
        dismissSuggestion: (userId, suggestion) => vm.actions.dismissSuggestion(userId, suggestion),
      },
      footer: {
        canSave: selectedUserIds.length > 0 && !saving,
        saving,
        onSave: handleSave,
        onSaveDraft: handleSaveDraftVoid,
        selectedUserCount: selectedUserIds.length,
      },
    },
  };

  // ── Return ────────────────────────────────────────

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
    visibleRows: tableRows,
    unsentRowCount,
    hasDraft,
    draftSavedAt,
    handleSaveDraft: handleSaveDraftVoid,
    handleSave,
    saving,
    validationErrors,
    clearValidationErrors,
    handoffAffectedUserCount,
    handoffTotalCount,
    handoffLoading,
    hydrationLoading,
    hydrated,
    hydrationError,

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
      visibleRows: tableRows, 
      showUnsentOnly, setShowUnsentOnly,
      showMissingOnly, setShowMissingOnly,
      unsentRowCount,
    },
    draft: { hasDraft, draftSavedAt, handleSaveDraft: handleSaveDraftVoid },
    handoff: {
      affectedUserCount: handoffAffectedUserCount,
      totalCount: handoffTotalCount,
      loading: handoffLoading,
    },
    actions: { handleSave, saving },
    initialization: { loading: hydrationLoading, hydrated, error: hydrationError },
    vm,
  };
};
