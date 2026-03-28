import { useUsers } from '@/stores/useUsers';
import type { User } from '@/types';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useHandoffNotesForTable } from '../../repositories/adapters/useHandoffNotesForTable';
import type { TableDailyRecordFormStructured, TableDailyRecordViewModel } from './tableDailyRecordFormTypes';
import { useTableDailyRecordFiltering } from '../orchestrators/useTableDailyRecordFiltering';
import { useTableDailyRecordHydrationOrchestrator, createInitialFormData } from '../orchestrators/useTableDailyRecordHydrationOrchestrator';
import { useTableDailyRecordSaveOrchestrator } from '../orchestrators/useTableDailyRecordSaveOrchestrator';
import { useTableDailyRecordRouting } from '../orchestrators/useTableDailyRecordRouting';
import { useTableDailyRecordRowHandlers } from '../orchestrators/useTableDailyRecordRowHandlers';
import { useTableDailyRecordSelection } from '../orchestrators/useTableDailyRecordSelection';
import { appendSuggestionMemo, createSuggestionAction } from '../../domain/legacy/suggestionAction';
import type { PatternSuggestion } from '../../domain/behavior/behaviorPatternSuggestions';

export type UserRowData = {
  userId: string;
  userName: string;
  amActivity: string;
  pmActivity: string;
  lunchAmount: string;
  problemBehavior: {
    selfHarm: boolean;
    otherInjury: boolean;
    loudVoice: boolean;
    pica: boolean;
    other: boolean;
  };
  specialNotes: string;
  behaviorTags: string[];
  /** 提案に対するアクション記録（Issue #9） */
  acceptedSuggestions?: import('../../domain/legacy/suggestionAction').SuggestionAction[];
};

export type TableDailyRecordData = {
  date: string;
  reporter: {
    name: string;
    role: string;
  };
  userRows: UserRowData[];
};

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
  filteredUsers: User[];
  selectedUsers: User[];
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
  const { initialDateFromUrl, showUnsentOnly, setShowUnsentOnly } = useTableDailyRecordRouting(open);

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
      visibleRows,
      searchQuery,
      showTodayOnly,
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
      showEmptyState: visibleRows.length === 0,
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
          return {
            ...prev,
            userRows: prev.userRows.map(r =>
              r.userId === userId
                ? { ...r, specialNotes: newNotes, acceptedSuggestions: [...(r.acceptedSuggestions ?? []), action] }
                : r,
            ),
          };
        });
      }, [setFormData]),
      dismissSuggestion: useCallback((userId: string, suggestion: PatternSuggestion) => {
        setFormData(prev => {
          const action = createSuggestionAction(suggestion, 'dismiss', userId);
          return {
            ...prev,
            userRows: prev.userRows.map(r =>
              r.userId === userId
                ? { ...r, acceptedSuggestions: [...(r.acceptedSuggestions ?? []), action] }
                : r,
            ),
          };
        });
      }, [setFormData]),
      setSearchQuery,
      setShowTodayOnly,
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
    visibleRows,
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
      visibleRows, showUnsentOnly, setShowUnsentOnly, unsentRowCount,
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
