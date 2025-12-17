import type { ElementType, MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import PostAddIcon from '@mui/icons-material/PostAdd';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { AuthRequiredError } from '../../lib/errors';
import ErrorState from '../../ui/components/ErrorState';
import Loading from '../../ui/components/Loading';
import { TESTIDS, tid, tidWithSuffix } from '@/testids';
import { useUsersStore } from './store';
import { useUsersDemoSeed } from './useUsersDemoSeed';
import type { IUserMaster, IUserMasterCreateDto } from './types';
import UserForm from './UserForm';
import UserDetailSections from './UserDetailSections/index';

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

export default function UsersPanel() {
  useUsersDemoSeed();
  const location = useLocation();
  const { data, status, create, remove, refresh, error } = useUsersStore();
  const [userId, setUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);
  const [onlySevere, setOnlySevere] = useState(false);
  const [selectedUser, setSelectedUser] = useState<IUserMaster | null>(null);
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
  const [detailUserKey, setDetailUserKey] = useState<string | null>(null);
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
        detailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [detailUser, detailUserKey]);

  const canCreate = useMemo(
    () => !!userId.trim() && !!fullName.trim() && busyId === null,
    [busyId, fullName, userId]
  );

  const generateSimpleUserID = useCallback(() => {
    const existingIds = data.map((user) => user.UserID).filter(Boolean);
    let nextNumber = 1;
    let newId = '';
    do {
      newId = `U-${nextNumber.toString().padStart(3, '0')}`;
      nextNumber += 1;
    } while (existingIds.includes(newId));
    setUserId(newId);
  }, [data]);

  const handleCreate = useCallback(async () => {
    if (!canCreate) return;
    const payload: IUserMasterCreateDto = {
      UserID: userId.trim(),
      FullName: fullName.trim(),
      IsHighIntensitySupportTarget: false,
    };
    setBusyId(-1);
    try {
      await create(payload);
      setUserId('');
      setFullName('');
      setActiveTab('list');
    } finally {
      setBusyId(null);
    }
  }, [canCreate, create, fullName, userId]);

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

  const handleDetailOpen = useCallback((event: ReactMouseEvent<HTMLButtonElement>, user: IUserMaster) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const key = user.UserID || String(user.Id);
    setActiveTab('list');
    setDetailUserKey((prev) => (prev === key ? null : key));
  }, [setActiveTab]);

  const handleDetailClose = useCallback(() => {
    setDetailUserKey(null);
  }, []);

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.filter((user) => {
      const matchesSearch = needle
        ? [user.UserID, user.FullName, user.Furigana, user.FullNameKana]
            .map((value) => (value ?? '').toString().toLowerCase())
            .some((value) => value.includes(needle))
        : true;
      const isActive = user.IsActive !== false;
      const isSevere = Boolean(user.severeFlag ?? user.IsHighIntensitySupportTarget);
      if (onlyActive && !isActive) {
        return false;
      }
      if (onlySevere && !isSevere) {
        return false;
      }
      return matchesSearch;
    });
  }, [data, onlyActive, onlySevere, search]);

  const onCreateKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') void handleCreate();
  }, [handleCreate]);

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

  const renderMenuTab = () => (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
          利用者メニュー
        </Typography>
        <Typography variant="body2" color="text.secondary">
          利用者一覧を確認するか、新規利用者登録を選択してください。
        </Typography>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<PeopleAltRoundedIcon />}
          onClick={() => setActiveTab('list')}
        >
          利用者一覧を表示
        </Button>
        <Button
          fullWidth
          variant="contained"
          startIcon={<PersonAddRoundedIcon />}
          onClick={() => setActiveTab('create')}
        >
          新規利用者登録
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        利用者一覧タブでは詳細表示・編集・削除、登録タブでは簡易登録や詳細フォームによる登録が行えます。
      </Typography>
    </Stack>
  );

  const renderListTab = () => {
    if (status === 'loading' && !data.length) {
      return <Loading />;
    }

    if (status === 'error' && error) {
      return <ErrorState message={buildErrorMessage(error)} />;
    }

    return (
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
            利用者一覧
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
            ステータス: {status}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={handleRefresh}
            disabled={busyId !== null}
            size="small"
          >
            {busyId === -2 ? '更新中…' : '一覧を更新'}
          </Button>
        </Stack>
        <Stack spacing={1.5} alignItems="flex-start">
          <TextField
            size="small"
            label="利用者検索"
            placeholder="ID / 氏名 / フリガナ"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 320 }, maxWidth: 420 }}
            inputProps={{ 'data-testid': TESTIDS['users-panel-search'] }}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <FormControlLabel
              control={(
                <Checkbox
                  checked={onlyActive}
                  onChange={(event) => setOnlyActive(event.target.checked)}
                  {...tid(TESTIDS['users-panel-filter-active'])}
                />
              )}
              label="利用中のみ"
            />
            <FormControlLabel
              control={(
                <Checkbox
                  checked={onlySevere}
                  onChange={(event) => setOnlySevere(event.target.checked)}
                  {...tid(TESTIDS['users-panel-filter-severe'])}
                />
              )}
              label="重度加算対象のみ"
            />
          </Stack>
        </Stack>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} alignItems="stretch">
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ flex: { lg: 1.1 }, minWidth: { lg: 0 } }}
            {...tid(TESTIDS['users-list-table'])}
          >
            <Table stickyHeader aria-label="利用者一覧テーブル">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>ユーザーID</TableCell>
                <TableCell>氏名</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((user) => {
                const rowBusy = busyId === Number(user.Id);
                const userKey = user.UserID || String(user.Id);
                const isSelected = detailUserKey === userKey;
                return (
                  <TableRow key={user.Id} hover selected={isSelected}>
                    <TableCell>
                      <span {...tidWithSuffix(TESTIDS['users-list-table-row'], `-${userKey}`)}>{user.Id}</span>
                    </TableCell>
                    <TableCell>{user.UserID}</TableCell>
                    <TableCell>{user.FullName}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <IconButton
                          size="small"
                          color="default"
                          component={RouterLink as unknown as ElementType}
                          to={`/users/${encodeURIComponent(userKey)}`}
                          state={{ user }}
                          disabled={rowBusy}
                          title="詳細"
                          onClick={(event: ReactMouseEvent<HTMLButtonElement>) => handleDetailOpen(event, user)}
                          aria-pressed={isSelected}
                          aria-label="詳細"
                        >
                          <InfoOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleEditClick(user)}
                          disabled={rowBusy}
                          title="編集"
                          aria-label="編集"
                        >
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(user.Id)}
                          disabled={rowBusy}
                          title="削除"
                          aria-label="削除"
                        >
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    データがありません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </TableContainer>
          <Box
            ref={detailSectionRef}
            sx={{ flex: { lg: 0.9 }, minWidth: { xs: '100%', lg: 380 } }}
            data-testid={TESTIDS['users-detail-pane']}
          >
            {detailUser ? (
              <UserDetailSections
                user={detailUser}
                variant="embedded"
                backLink={{ onClick: handleDetailClose, label: '詳細表示を閉じる' }}
              />
            ) : (
              <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    利用者詳細
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    表の「詳細」ボタンを選択すると、一覧ページ内で利用者情報を確認できます。
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    新しいタブで開く場合は、詳細アイコンを ⌘/Ctrl キーを押しながらクリックしてください。
                  </Typography>
                </Stack>
              </Paper>
            )}
          </Box>
        </Stack>
      </Stack>
    );
  };

  const renderCreateTab = () => (
    <Stack spacing={2.5}>
      <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
        新規利用者登録
      </Typography>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="end">
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            label="ユーザーID"
            placeholder="U-001"
            size="small"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            onKeyDown={onCreateKeyDown}
            required
            sx={{ minWidth: 150 }}
          />
          <Button
            variant="outlined"
            onClick={generateSimpleUserID}
            size="small"
            sx={{ minWidth: 'auto', px: 1.5 }}
          >
            自動
          </Button>
        </Box>
        <TextField
          label="氏名"
          placeholder="山田太郎"
          size="small"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          onKeyDown={onCreateKeyDown}
          required
          sx={{ minWidth: 200 }}
        />
        <Button
          variant="contained"
          startIcon={<PersonAddRoundedIcon />}
          onClick={handleCreate}
          disabled={!canCreate}
          sx={{ minWidth: 120 }}
        >
          {busyId === -1 ? '作成中…' : '簡易作成'}
        </Button>
      </Stack>
      <Divider sx={{ my: 1 }} />
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          詳細情報を含む新規登録はこちら：
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<PostAddIcon />}
          onClick={() => setShowCreateForm(true)}
          sx={{ minWidth: 160 }}
        >
          詳細登録フォーム
        </Button>
      </Box>
    </Stack>
  );

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
          {activeTab === 'menu' && renderMenuTab()}
          {activeTab === 'list' && renderListTab()}
          {activeTab === 'create' && renderCreateTab()}
        </Box>
      </Paper>

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
}
