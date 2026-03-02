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
import { useUsersDemoSeed } from '../../useUsersDemoSeed';
import { buildErrorMessage } from '../utils';
import type { UsersTab } from './useUsersPanelTabs';

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
  // Handlers
  handleCreate: (payload: IUserMasterCreateDto) => Promise<void>;
  handleDelete: (id: number | string) => Promise<void>;
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
  useUsersDemoSeed();
  const { data, status, create, remove, refresh, error } = useUsersStore();

  // ---- State ----
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<IUserMaster | null>(null);
  const [integrityErrors, setIntegrityErrors] = useState<string[]>([]);

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

  const handleDelete = useCallback(
    async (id: number | string) => {
      if (!window.confirm('この利用者を削除しますか？')) return;
      setBusyId(Number(id));
      try {
        await remove(id);
      } finally {
        setBusyId(null);
      }
    },
    [remove],
  );

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
    (newUser: IUserMaster) => {
      console.log('利用者が作成されました:', newUser);
      setShowCreateForm(false);
      void refresh();
      setActiveTabRef.current('list');
    },
    [refresh, setActiveTabRef],
  );

  const handleEditFormSuccess = useCallback(
    (updatedUser: IUserMaster) => {
      console.log('利用者情報が更新されました:', updatedUser);
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
    handleCreate,
    handleDelete,
    handleRefresh,
    handleEditClick,
    handleCloseForm,
    handleCreateFormSuccess,
    handleEditFormSuccess,
  };
}
