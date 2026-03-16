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

/** 削除確認ダイアログ用の対象情報 */
export type DeleteTarget = {
  id: number | string;
  userName: string;
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
  // Delete confirmation state
  deleteTarget: DeleteTarget | null;
  requestDelete: (id: number | string, userName: string) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  // Handlers
  handleCreate: (payload: IUserMasterCreateDto) => Promise<void>;
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
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

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

  const requestDelete = useCallback(
    (id: number | string, userName: string) => {
      setDeleteTarget({ id, userName });
    },
    [],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    setBusyId(Number(id));
    try {
      await remove(id);
    } finally {
      setBusyId(null);
    }
  }, [deleteTarget, remove]);

  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
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
    deleteTarget,
    requestDelete,
    confirmDelete,
    cancelDelete,
    handleCreate,
    handleRefresh,
    handleEditClick,
    handleCloseForm,
    handleCreateFormSuccess,
    handleEditFormSuccess,
  };
}
