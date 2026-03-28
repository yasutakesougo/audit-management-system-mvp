import { useUsers } from '@/stores/useUsers';
import type { User } from '@/types';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHandoffNotesForTable } from '../../repositories/adapters/useHandoffNotesForTable';
import type { TableDailyRecordFormStructured } from './tableDailyRecordFormTypes';
import { useTableDailyRecordFiltering } from '../orchestrators/useTableDailyRecordFiltering';
import type { DraftInput } from '../mutations/useTableDailyRecordPersistence';
import { useTableDailyRecordPersistence } from '../mutations/useTableDailyRecordPersistence';
import { useTableDailyRecordSaveOrchestrator } from '../orchestrators/useTableDailyRecordSaveOrchestrator';
import { useTableDailyRecordRouting } from '../orchestrators/useTableDailyRecordRouting';
import { useTableDailyRecordRowHandlers } from '../orchestrators/useTableDailyRecordRowHandlers';
import { useTableDailyRecordSelection } from '../orchestrators/useTableDailyRecordSelection';
import { toLocalDateISO } from '@/utils/getNow';

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
});

export const useTableDailyRecordForm = ({
  open,
  onClose,
  onSuccess,
  repository,
}: UseTableDailyRecordFormParams): UseTableDailyRecordFormResult => {
  // ── Routing ───────────────────────────────────────
  const { initialDateFromUrl, showUnsentOnly, setShowUnsentOnly } = useTableDailyRecordRouting(open);

  // ── Core state ────────────────────────────────────
  const [formData, setFormData] = useState<TableDailyRecordData>(() => createInitialFormData(initialDateFromUrl));

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
      visibleRows, showUnsentOnly, setShowUnsentOnly, unsentRowCount,
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
