/**
 * useUsersPanel
 *
 * UsersPanel のパネルロジックを集約するカスタムフック。
 * タブ管理、詳細ユーザー管理、CRUD ハンドラ、フォーム表示管理を担う。
 */
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthRequiredError } from '../../../lib/errors';
import { useUsersStore } from '../store';
import type { IUserMaster, IUserMasterCreateDto } from '../types';
import { useUsersDemoSeed } from '../useUsersDemoSeed';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type UsersTab = 'menu' | 'list' | 'create';

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
  // Refs
  panelOpenButtonRef: React.RefObject<HTMLButtonElement>;
};

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

export const buildErrorMessage = (error: unknown): string => {
  if (!error) return '原因不明のエラーが発生しました。';
  if (error instanceof AuthRequiredError) {
    return 'サインインが必要です。上部の「Sign in」を押して認証を完了してください。';
  }
  if (error instanceof Error) {
    if (error.message === 'AUTH_REQUIRED') {
      return 'サインインが必要です。上部の「Sign in」を押して認証を完了してください。';
    }
    return error.message;
  }
  return String(error);
};

// ---------------------------------------------------------------------------
// メインフック
// ---------------------------------------------------------------------------

export function useUsersPanel(): UseUsersPanelReturn {
  useUsersDemoSeed();
  const location = useLocation();
  const { data, status, create, remove, refresh, error } = useUsersStore();

  // ---- State ----
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<IUserMaster | null>(null);
  const [detailUserKey, setDetailUserKey] = useState<string | null>(null);

  // ---- Tab management ----
  const isUsersTab = useCallback(
    (value: unknown): value is UsersTab =>
      value === 'menu' || value === 'list' || value === 'create',
    [],
  );

  const readTabFromLocation = useCallback((): UsersTab | null => {
    const stateTab = (location.state as { tab?: unknown } | null)?.tab;
    if (isUsersTab(stateTab)) return stateTab;
    const params = new URLSearchParams(location.search ?? '');
    const queryTab = params.get('tab');
    if (isUsersTab(queryTab)) return queryTab;
    return null;
  }, [isUsersTab, location.search, location.state]);

  const [activeTab, setActiveTab] = useState<UsersTab>(() => readTabFromLocation() ?? 'menu');
  const handledLocationRef = useRef<{ key: string; tab: UsersTab | null }>({
    key: location.key,
    tab: readTabFromLocation(),
  });

  useEffect(() => {
    const nextTab = readTabFromLocation();
    const handled = handledLocationRef.current;
    const keyChanged = location.key !== handled.key;
    const tabChanged = nextTab !== handled.tab;

    if (!nextTab) {
      if (keyChanged) {
        handledLocationRef.current = { key: location.key, tab: nextTab };
      }
      return;
    }

    if (!keyChanged && (!tabChanged || nextTab === activeTab)) {
      return;
    }

    handledLocationRef.current = { key: location.key, tab: nextTab };

    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, location.key, readTabFromLocation]);

  // ---- Detail user ----
  const detailSectionRef = useRef<HTMLDivElement | null>(null);
  const panelOpenButtonRef = useRef<HTMLButtonElement | null>(null);

  const detailUser = useMemo(() => {
    if (!detailUserKey) return null;
    return data.find((user) => (user.UserID || String(user.Id)) === detailUserKey) ?? null;
  }, [data, detailUserKey]);

  useEffect(() => {
    if (!detailUserKey) return;
    if (!detailUser) {
      setDetailUserKey(null);
      return;
    }

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const element = detailSectionRef.current;
        if (element && typeof element.scrollIntoView === 'function') {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }, [detailUser, detailUserKey]);

  // ---- CRUD handlers ----
  const handleCreate = useCallback(
    async (payload: IUserMasterCreateDto) => {
      setBusyId(-1);
      try {
        await create(payload);
        setActiveTab('list');
      } finally {
        setBusyId(null);
      }
    },
    [create],
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

  // ---- Detail handlers ----
  const handleDetailSelect = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, user: IUserMaster) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
        return;
      }
      event.preventDefault();
      const key = user.UserID || String(user.Id);
      setActiveTab('list');
      setDetailUserKey((prev) => (prev === key ? null : key));
    },
    [],
  );

  const handleDetailClose = useCallback(() => {
    setDetailUserKey(null);
  }, []);

  // ---- Form dialog handlers ----
  const handleCreateFormSuccess = useCallback(
    (newUser: IUserMaster) => {
      console.log('利用者が作成されました:', newUser);
      setShowCreateForm(false);
      void refresh();
      setActiveTab('list');
    },
    [refresh],
  );

  const handleEditFormSuccess = useCallback(
    (updatedUser: IUserMaster) => {
      console.log('利用者情報が更新されました:', updatedUser);
      setShowEditForm(false);
      setSelectedUser(null);
      void refresh();
      setActiveTab('list');
    },
    [refresh],
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
    activeTab,
    setActiveTab,
    detailUserKey,
    detailUser,
    detailSectionRef,
    busyId,
    isCreatePending,
    showCreateForm,
    showEditForm,
    selectedUser,
    setShowCreateForm,
    handleCreate,
    handleDelete,
    handleRefresh,
    handleDetailSelect,
    handleDetailClose,
    handleEditClick,
    handleCloseForm,
    handleCreateFormSuccess,
    handleEditFormSuccess,
    panelOpenButtonRef,
  };
}
