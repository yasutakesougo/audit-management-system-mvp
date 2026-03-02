/**
 * useUsersPanel
 *
 * UsersPanel のオーケストレータ。
 * 責務ごとの sub-hook を合成し、UseUsersPanelReturn を返す。
 *
 * Sub-hooks:
 *   - useUsersPanelTabs  : タブ管理 + 詳細ユーザー選択 + URL同期
 *   - useUsersPanelCrud  : CRUD + 非同期状態 + フォーム管理
 *   - useUsersPanelExport: PDF / Excel 出力
 */
import { useRef, type MouseEvent as ReactMouseEvent } from 'react';
import type { IUserMaster, IUserMasterCreateDto } from '../types';
import { useUsersPanelCrud } from './hooks/useUsersPanelCrud';
import { useUsersPanelExport } from './hooks/useUsersPanelExport';
import { useUsersPanelTabs, type UsersTab } from './hooks/useUsersPanelTabs';

// Re-export sub-hook types for consumers
export type { UsersTab } from './hooks/useUsersPanelTabs';

// ---------------------------------------------------------------------------
// 戻り値型（既存 UI との互換性を維持）
// ---------------------------------------------------------------------------

export type UseUsersPanelReturn = {
  // Data
  data: IUserMaster[];
  status: string;
  errorMessage: string | null;
  // Tab
  activeTab: UsersTab;
  setActiveTab: (tab: UsersTab) => void;
  // Detail
  detailUserKey: string | null;
  detailUser: IUserMaster | null;
  detailSectionRef: React.RefObject<HTMLDivElement>;
  // Busy
  busyId: number | null;
  isCreatePending: boolean;
  // Form dialogs
  showCreateForm: boolean;
  showEditForm: boolean;
  selectedUser: IUserMaster | null;
  setShowCreateForm: (v: boolean) => void;
  // Handlers
  handleCreate: (payload: IUserMasterCreateDto) => Promise<void>;
  handleDelete: (id: number | string) => Promise<void>;
  handleRefresh: () => Promise<void>;
  handleDetailSelect: (event: ReactMouseEvent<HTMLButtonElement>, user: IUserMaster) => void;
  handleDetailClose: () => void;
  handleEditClick: (user: IUserMaster) => void;
  handleCloseForm: () => void;
  handleCreateFormSuccess: (newUser: IUserMaster) => void;
  handleEditFormSuccess: (updatedUser: IUserMaster) => void;
  handleExportAchievementPDF: (userId: string) => Promise<void>;
  handleExportMonthlySummary: () => Promise<void>;
  integrityErrors: string[];
  // Refs
  panelOpenButtonRef: React.RefObject<HTMLButtonElement>;
};

// ---------------------------------------------------------------------------
// ユーティリティ（後方互換 re-export）
// ---------------------------------------------------------------------------
export { buildErrorMessage } from './utils';

// ---------------------------------------------------------------------------
// メインフック（合成のみ）
// ---------------------------------------------------------------------------

export function useUsersPanel(): UseUsersPanelReturn {
  // setActiveTab を ref で橋渡し（hook 順序の循環を回避）
  const setActiveTabRef = useRef<(tab: UsersTab) => void>(() => {});

  // 1) CRUD — データ・ストア操作・フォーム状態（ref 経由で setActiveTab を参照）
  const crud = useUsersPanelCrud(setActiveTabRef);

  // 2) Tabs — タブ管理 + 詳細ユーザー選択（CRUD のデータを受け取る）
  const tabs = useUsersPanelTabs(crud.data);

  // ref を接続（Tabs の setActiveTab を CRUD が使えるようにする）
  setActiveTabRef.current = tabs.setActiveTab;

  // 3) Export — PDF / Excel 出力
  const exportHook = useUsersPanelExport(crud.data, crud.setBusyId);

  return {
    // Data (from CRUD)
    data: crud.data,
    status: crud.status,
    errorMessage: crud.errorMessage,
    // Tab (from Tabs)
    activeTab: tabs.activeTab,
    setActiveTab: tabs.setActiveTab,
    // Detail (from Tabs)
    detailUserKey: tabs.detailUserKey,
    detailUser: tabs.detailUser,
    detailSectionRef: tabs.detailSectionRef,
    // Busy (from CRUD)
    busyId: crud.busyId,
    isCreatePending: crud.isCreatePending,
    // Form (from CRUD)
    showCreateForm: crud.showCreateForm,
    showEditForm: crud.showEditForm,
    selectedUser: crud.selectedUser,
    setShowCreateForm: crud.setShowCreateForm,
    // CRUD handlers
    handleCreate: crud.handleCreate,
    handleDelete: crud.handleDelete,
    handleRefresh: crud.handleRefresh,
    // Detail handlers (from Tabs)
    handleDetailSelect: tabs.handleDetailSelect,
    handleDetailClose: tabs.handleDetailClose,
    // Form handlers (from CRUD)
    handleEditClick: crud.handleEditClick,
    handleCloseForm: crud.handleCloseForm,
    handleCreateFormSuccess: crud.handleCreateFormSuccess,
    handleEditFormSuccess: crud.handleEditFormSuccess,
    // Export handlers
    handleExportAchievementPDF: exportHook.handleExportAchievementPDF,
    handleExportMonthlySummary: exportHook.handleExportMonthlySummary,
    // Other
    integrityErrors: crud.integrityErrors,
    panelOpenButtonRef: tabs.panelOpenButtonRef,
  };
}
