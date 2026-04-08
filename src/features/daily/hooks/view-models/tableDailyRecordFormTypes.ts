/**
 * useTableDailyRecordForm の戻り値をドメイン別に構造化した型定義。
 *
 * フラットな UseTableDailyRecordFormResult (37フィールド) を
 * 6 つの責務別オブジェクトに整理し、消費者コンポーネントが
 * 必要なスライスだけを参照できるようにする。
 *
 * 移行期間中は UseTableDailyRecordFormResult が
 * フラットフィールドとサブオブジェクトの両方を保持する。
 */

import type { Dispatch, SetStateAction } from 'react';
import type { StoreUser } from '@/stores/useUsers';
import type {
  TableDailyRecordData,
  TableDailyRecordValidationErrors,
} from './useTableDailyRecordForm';
import type { TableDailyRecordRow } from '../../table/models/tableDailyRecordRow';

// ────────────────────────────────────────────────────────────
// 1. Header — フォームのメタデータ（日付・記録者・バリデーション）
// ────────────────────────────────────────────────────────────

export interface FormHeader {
  formData: TableDailyRecordData;
  setFormData: Dispatch<SetStateAction<TableDailyRecordData>>;
  validationErrors: TableDailyRecordValidationErrors;
  clearValidationErrors: () => void;
}

// ────────────────────────────────────────────────────────────
// 2. Picker — 利用者選択・検索・フィルタリング
// ────────────────────────────────────────────────────────────

export interface FormPicker {
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
}

// ────────────────────────────────────────────────────────────
// 3. Table — 行データ操作・表示行・未送信フィルタ
// ────────────────────────────────────────────────────────────

export interface FormTable {
  handleRowDataChange: (userId: string, field: string, value: string | boolean) => void;
  handleProblemBehaviorChange: (userId: string, behaviorType: string, checked: boolean) => void;
  handleBehaviorTagToggle: (userId: string, tagKey: string) => void;
  handleClearRow: (userId: string) => void;
  visibleRows: TableDailyRecordRow[];
  showUnsentOnly: boolean;
  setShowUnsentOnly: Dispatch<SetStateAction<boolean>>;
  showMissingOnly: boolean;
  setShowMissingOnly: Dispatch<SetStateAction<boolean>>;
  unsentRowCount: number;
}

// ────────────────────────────────────────────────────────────
// 4. Draft — 下書き保存
// ────────────────────────────────────────────────────────────

export interface FormDraft {
  hasDraft: boolean;
  draftSavedAt: string | null;
  handleSaveDraft: () => void;
}

// ────────────────────────────────────────────────────────────
// 5. Handoff — 申し送り連携
// ────────────────────────────────────────────────────────────

export interface FormHandoff {
  /** 重要申し送りが反映された利用者数 */
  affectedUserCount: number;
  /** 重要申し送りの総件数 */
  totalCount: number;
  /** データ読み込み中 */
  loading: boolean;
}

// ────────────────────────────────────────────────────────────
// 6. Actions — 保存アクション
// ────────────────────────────────────────────────────────────

export interface FormActions {
  handleSave: () => Promise<void>;
  saving: boolean;
}

// ────────────────────────────────────────────────────────────
// 7. Initialization — 初期化・データロード状態
// ────────────────────────────────────────────────────────────

export interface FormInitialization {
  loading: boolean;
  hydrated: boolean;
  error: Error | null;
}

// ────────────────────────────────────────────────────────────
// Composite — 全サブオブジェクトを持つ構造化リザルト
// ────────────────────────────────────────────────────────────

export interface TableDailyRecordFormStructured {
  header: FormHeader;
  picker: FormPicker;
  table: FormTable;
  draft: FormDraft;
  handoff: FormHandoff;
  actions: FormActions;
  initialization: FormInitialization;
}

// ────────────────────────────────────────────────────────────
// New ViewModel Architecture (PR 3-C)
// ────────────────────────────────────────────────────────────

export interface TableDailyRecordViewModel {
  state: {
    formData: TableDailyRecordData;
    targetDate: string;
    selectedUserIds: string[];
    filteredUsers: StoreUser[];
    visibleRows: TableDailyRecordRow[];
    searchQuery: string;
    showTodayOnly: boolean;
    showMissingOnly: boolean;
    showUnsentOnly: boolean;
    validationErrors: TableDailyRecordValidationErrors;
    handoff: {
      loading: boolean;
      totalCount: number;
      affectedUserCount: number;
    };
    loading: boolean; // equivalent to hydrationLoading
    saving: boolean;
    error: Error | null; // equivalent to hydrationError
  };

  flags: {
    hydrated: boolean;
    isDirty: boolean;
    canSave: boolean;
    canReset: boolean;
    showDraftNotice: boolean;
    showEmptyState: boolean;
    hasValidationErrors: boolean;
  };

  actions: {
    changeDate: (date: string) => void;
    changeSelectedUsers: (userIds: string[]) => void;
    changeRecorder: (recorder: string) => void;
    updateRowData: (userId: string, field: string, value: string | boolean) => void;
    clearRowData: (userId: string) => void;
    changeProblemBehavior: (userId: string, behaviorType: string, checked: boolean) => void;
    toggleBehaviorTag: (userId: string, tagKey: string) => void;
    acceptSuggestion: (userId: string, suggestion: import('../../domain/behavior/behaviorPatternSuggestions').PatternSuggestion) => void;
    dismissSuggestion: (userId: string, suggestion: import('../../domain/behavior/behaviorPatternSuggestions').PatternSuggestion) => void;
    setSearchQuery: (query: string) => void;
    setShowTodayOnly: (show: boolean) => void;
    setShowUnsentOnly: (show: boolean) => void;
    setShowMissingOnly: (show: boolean) => void;
    toggleUser: (userId: string) => void;
    selectAllUsers: () => void;
    clearAllUsers: () => void;
    clearValidationErrors: () => void;
    save: () => Promise<void>;
    saveDraft: () => void;
    clearDraft: () => void;
    reset: () => void;
  };

  sections: {
    picker: {
      formDate: string;
      searchQuery: string;
      onSearchQueryChange: (query: string) => void;
      showTodayOnly: boolean;
      onToggleShowToday: () => void;
      onSelectAll: () => void;
      onClearAll: () => void;
      filteredUsers: StoreUser[];
      selectedUserIds: string[];
      onUserToggle: (userId: string) => void;
    };
    table: {
      rows: TableDailyRecordRow[];
      onRowDataChange: (userId: string, field: string, value: string | boolean) => void;
      onProblemBehaviorChange: (userId: string, behaviorType: string, checked: boolean) => void;
      onBehaviorTagToggle: (userId: string, tagKey: string) => void;
      onClearRow: (userId: string) => void;
      showUnsentOnly: boolean;
      onToggleUnsentOnly: () => void;
      showMissingOnly: boolean;
      onToggleMissingOnly: () => void;
    };
    suggestion: {
      visibleRows: TableDailyRecordRow[];
      acceptSuggestion: (userId: string, suggestion: import('../../domain/behavior/behaviorPatternSuggestions').PatternSuggestion) => void;
      dismissSuggestion: (userId: string, suggestion: import('../../domain/behavior/behaviorPatternSuggestions').PatternSuggestion) => void;
    };
    footer: {
      canSave: boolean;
      saving: boolean;
      onSave: () => Promise<void>;
      onSaveDraft: () => void;
      selectedUserCount: number;
    };
  };
}
