import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { useLocation } from 'react-router-dom';
import { AuthRequiredError } from '../../../lib/errors';
import UsersCreateForm from './UsersCreateForm';
import UsersList from './UsersList';
import UsersMenu from './UsersMenu';
import UserForm from '../UserForm';
import { TESTIDS } from '@/testids';
import { useUsersStore } from '../store';
import { useUsersDemoSeed } from '../useUsersDemoSeed';
import type { IUserMaster, IUserMasterCreateDto } from '../types';

type UsersTab = 'menu' | 'list' | 'create';

const buildErrorMessage = (error: unknown): string => {
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

const UsersPanel = () => {
  useUsersDemoSeed();
  const location = useLocation();
  const { data, status, create, remove, refresh, error } = useUsersStore();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<IUserMaster | null>(null);
  const [detailUserKey, setDetailUserKey] = useState<string | null>(null);

  const isUsersTab = useCallback((value: unknown): value is UsersTab => (
    value === 'menu' || value === 'list' || value === 'create'
  ), []);

  const readTabFromLocation = useCallback((): UsersTab | null => {
    const stateTab = (location.state as { tab?: unknown } | null)?.tab;
    if (isUsersTab(stateTab)) {
      return stateTab;
    }
    const params = new URLSearchParams(location.search ?? '');
    const queryTab = params.get('tab');
    if (isUsersTab(queryTab)) {
      return queryTab;
    }
    return null;
  }, [isUsersTab, location.search, location.state]);

  const [activeTab, setActiveTab] = useState<UsersTab>(() => readTabFromLocation() ?? 'menu');
  const panelOpenButtonRef = useRef<HTMLButtonElement | null>(null);
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

  const detailSectionRef = useRef<HTMLDivElement | null>(null);

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

  const handleCreate = useCallback(async (payload: IUserMasterCreateDto) => {
    setBusyId(-1);
    try {
      await create(payload);
      setActiveTab('list');
    } finally {
      setBusyId(null);
    }
  }, [create]);

  const handleDelete = useCallback(async (id: number | string) => {
    if (!window.confirm('この利用者を削除しますか？')) return;
    setBusyId(Number(id));
    try {
      await remove(id);
    } finally {
      setBusyId(null);
    }
  }, [remove]);

  const handleRefresh = useCallback(async () => {
    if (busyId !== null) return;
    setBusyId(-2);
    try {
      await refresh();
    } finally {
      setBusyId(null);
    }
  }, [busyId, refresh]);

  const handleDetailSelect = useCallback((event: ReactMouseEvent<HTMLButtonElement>, user: IUserMaster) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const key = user.UserID || String(user.Id);
    setActiveTab('list');
    setDetailUserKey((prev) => (prev === key ? null : key));
  }, []);

  const handleDetailClose = useCallback(() => {
    setDetailUserKey(null);
  }, []);

  const handleCreateFormSuccess = useCallback((newUser: IUserMaster) => {
    console.log('利用者が作成されました:', newUser);
    setShowCreateForm(false);
    void refresh();
    setActiveTab('list');
  }, [refresh]);

  const handleEditFormSuccess = useCallback((updatedUser: IUserMaster) => {
    console.log('利用者情報が更新されました:', updatedUser);
    setShowEditForm(false);
    setSelectedUser(null);
    void refresh();
    setActiveTab('list');
  }, [refresh]);

  const handleEditClick = useCallback((user: IUserMaster) => {
    setSelectedUser(user);
    setShowEditForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowCreateForm(false);
    setShowEditForm(false);
    setSelectedUser(null);
  }, []);

  const errorMessage = error ? buildErrorMessage(error) : null;
  const isCreatePending = busyId === -1;

  return (
    <Box sx={{ p: 3 }} data-testid={TESTIDS['users-panel-root']}>
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value as UsersTab)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="利用者タブメニュー"
          sx={{ px: 2, pt: 1 }}
        >
          <Tab value="menu" label="利用者メニュー" />
          <Tab
            value="list"
            label={`利用者一覧 (${data.length})`}
            iconPosition="start"
            icon={<PeopleAltRoundedIcon fontSize="small" />}
          />
          <Tab
            value="create"
            label="新規利用者登録"
            iconPosition="start"
            icon={<PersonAddRoundedIcon fontSize="small" />}
          />
        </Tabs>
        <Divider />
        <Box sx={{ p: { xs: 2.5, md: 3 } }}>
          {activeTab === 'menu' && (
            <UsersMenu
              onNavigateToList={() => setActiveTab('list')}
              onNavigateToCreate={() => setActiveTab('create')}
            />
          )}
          {activeTab === 'list' && (
            <UsersList
              users={data}
              status={status}
              busyId={busyId}
              selectedUserKey={detailUserKey}
              detailUser={detailUser}
              detailSectionRef={detailSectionRef}
              errorMessage={errorMessage}
              onRefresh={handleRefresh}
              onDelete={handleDelete}
              onEdit={handleEditClick}
              onSelectDetail={handleDetailSelect}
              onCloseDetail={handleDetailClose}
            />
          )}
          {activeTab === 'create' && (
            <UsersCreateForm
              isSubmitting={isCreatePending}
              onCreate={handleCreate}
              onOpenDetailForm={() => setShowCreateForm(true)}
            />
          )}
        </Box>
      </Paper>

      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <button
          type="button"
          ref={panelOpenButtonRef}
          data-testid={TESTIDS['users-panel-open']}
          onClick={() => setActiveTab('list')}
          style={{ display: 'none' }}
          aria-label="利用者一覧を開く"
        >
          <ChevronRightRoundedIcon />
        </button>
      </Box>

      <Dialog
        open={showCreateForm}
        onClose={handleCloseForm}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown={false}
        disableAutoFocus={false}
        disableEnforceFocus={false}
        disableRestoreFocus={false}
      >
        <DialogContent sx={{ p: 0 }}>
          <UserForm
            mode="create"
            onSuccess={handleCreateFormSuccess}
            onClose={handleCloseForm}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditForm}
        onClose={handleCloseForm}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown={false}
        disableAutoFocus={false}
        disableEnforceFocus={false}
        disableRestoreFocus={false}
      >
        <DialogContent sx={{ p: 0 }}>
          <UserForm
            user={selectedUser || undefined}
            mode="update"
            onSuccess={handleEditFormSuccess}
            onClose={handleCloseForm}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default UsersPanel;
