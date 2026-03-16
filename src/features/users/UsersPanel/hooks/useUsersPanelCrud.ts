/**
 * useUsersPanelCrud
 *
 * CRUD ハンドラ + 非同期状態 (busy) + フォームダイアログ管理
 *
 * setActiveTab は外部から注入（orchestrator が Tabs と接続）
 */
import { useCallback, useEffect, useState } from 'react';
import { ZodError } from 'zod';
import { useUsersStore } from '../../store';
import type { IUserMaster, IUserMasterCreateDto } from '../../types';
import { getCurrentUserRepositoryKind } from '../../repositoryFactory';
import { useUsersDemoSeed } from '../../useUsersDemoSeed';
import { buildErrorMessage } from '../utils';
import type { UsersTab } from './useUsersPanelTabs';

/** 削除確認ダイアログの状態 */
export type DeleteConfirmState = {
  open: boolean;
  targetId: number | string | null;
  targetName: string | null;
};

export type UseUsersPanelCrudReturn = {
  data: IUserMaster[];
  status: string;
  errorMessage: string | null;
  busyId: number | null;
  isCreatePending: boolean;
  integrityErrors: string[];
  // Form state
  showCreateForm: boolean;
  showEditForm: boolean;
  selectedUser: IUserMaster | null;
  setShowCreateForm: (v: boolean) => void;
  // setBusyId（Export からも使える）
  setBusyId: (id: number | null) => void;
  // Delete confirmation
  deleteConfirm: DeleteConfirmState;
  // Handlers
  handleCreate: (payload: IUserMasterCreateDto) => Promise<void>;
  handleDeleteRequest: (id: number | string, name?: string) => void;
  handleDeleteConfirm: () => Promise<void>;
  handleDeleteCancel: () => void;
  handleRefresh: () => Promise<void>;
  handleEditClick: (user: IUserMaster) => void;
  handleCloseForm: () => void;
  handleCreateFormSuccess: (newUser: IUserMaster) => void;
  handleEditFormSuccess: (updatedUser: IUserMaster) => void;
};

/**
 * @param setActiveTabRef - Ref to setActiveTab (avoids hook ordering issues)
 */
export function useUsersPanelCrud(
  setActiveTabRef: React.MutableRefObject<(tab: UsersTab) => void>,
): UseUsersPanelCrudReturn {
  // Demo モードの場合のみシードを実行
  const repositoryKind = getCurrentUserRepositoryKind();
  useUsersDemoSeed(repositoryKind === 'demo');
  const { data, status, create, remove, refresh, error } = useUsersStore();

  // ---- State ----
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<IUserMaster | null>(null);
  const [integrityErrors, setIntegrityErrors] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    open: false,
    targetId: null,
    targetName: null,
  });

  // ---- Initial fetch ----
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIntegrityErrors([]);
        await refresh();
      } catch (err: unknown) {
        if (err instanceof ZodError) {
          const messages = err.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
          setIntegrityErrors(messages);
        }
      }
    };
    fetchUsers();
  }, [refresh]);

  // ---- CRUD handlers ----
  const handleCreate = useCallback(
    async (payload: IUserMasterCreateDto) => {
      setBusyId(-1);
      try {
        await create(payload);
        setActiveTabRef.current('list');
      } finally {
        setBusyId(null);
      }
    },
    [create, setActiveTabRef],
  );

  /** 削除リクエスト: 確認ダイアログを開く */
  const handleDeleteRequest = useCallback(
    (id: number | string, name?: string) => {
      setDeleteConfirm({ open: true, targetId: id, targetName: name ?? null });
    },
    [],
  );

  /** 削除確定: 確認ダイアログの「削除」ボタン */
  const handleDeleteConfirm = useCallback(async () => {
    const { targetId } = deleteConfirm;
    if (targetId == null) return;

    setDeleteConfirm({ open: false, targetId: null, targetName: null });
    setBusyId(Number(targetId));
    try {
      await remove(targetId);
    } finally {
      setBusyId(null);
    }
  }, [deleteConfirm, remove]);

  /** 削除キャンセル */
  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirm({ open: false, targetId: null, targetName: null });
  }, []);

  const handleRefresh = useCallback(async () => {
    if (busyId !== null) return;
    setBusyId(-2);
    try {
      await refresh();
    } finally {
      setBusyId(null);
    }
  }, [busyId, refresh]);

  // ---- Form dialog handlers ----
  const handleCreateFormSuccess = useCallback(
    (_newUser: IUserMaster) => {

      setShowCreateForm(false);
      void refresh();
      setActiveTabRef.current('list');
    },
    [refresh, setActiveTabRef],
  );

  const handleEditFormSuccess = useCallback(
    (_updatedUser: IUserMaster) => {

      setShowEditForm(false);
      setSelectedUser(null);
      void refresh();
      setActiveTabRef.current('list');
    },
    [refresh, setActiveTabRef],
  );

  const handleEditClick = useCallback((user: IUserMaster) => {
    setSelectedUser(user);
    setShowEditForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowCreateForm(false);
    setShowEditForm(false);
    setSelectedUser(null);
  }, []);

  // ---- Derived ----
  const errorMessage = error ? buildErrorMessage(error) : null;
  const isCreatePending = busyId === -1;

  return {
    data,
    status,
    errorMessage,
    busyId,
    isCreatePending,
    integrityErrors,
    showCreateForm,
    showEditForm,
    selectedUser,
    setShowCreateForm,
    setBusyId,
    deleteConfirm,
    handleCreate,
    handleDeleteRequest,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleRefresh,
    handleEditClick,
    handleCloseForm,
    handleCreateFormSuccess,
    handleEditFormSuccess,
  };
}
