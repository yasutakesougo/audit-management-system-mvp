import { useCallback, useMemo, useState } from 'react';
// MUI Components
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
// MUI Icons
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import PostAddIcon from '@mui/icons-material/PostAdd';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
// Local imports
import { AuthRequiredError } from '../../lib/errors';
import ErrorState from '../../ui/components/ErrorState';
import Loading from '../../ui/components/Loading';
import { useUsersStore } from './store';
import type { IUserMaster, IUserMasterCreateDto } from './types';
import UserForm from './UserForm';

export default function UsersPanel() {
  const { data, status, create, remove, refresh, error } = useUsersStore();
  const [userId, setUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<IUserMaster | null>(null);



  const canCreate = useMemo(
    () => !!userId.trim() && !!fullName.trim() && busyId === null,
    [userId, fullName, busyId]
  );

  // 簡易作成用のID自動生成
  const generateSimpleUserID = useCallback(() => {
    const existingIds = data.map(user => user.UserID).filter(Boolean);

    let nextNumber = 1;
    let newId = '';

    do {
      newId = `U-${nextNumber.toString().padStart(3, '0')}`;
      nextNumber++;
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
    } finally {
      setBusyId(null);
    }
  }, [canCreate, create, fullName, userId]);



  const handleDelete = useCallback(async (id: number | string) => {
    if (!window.confirm('Delete this user?')) return;
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

  const onCreateKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void handleCreate();
  }, [handleCreate]);

  const handleCreateFormSuccess = useCallback((newUser: IUserMaster) => {
    console.log('利用者が作成されました:', newUser);
    setShowCreateForm(false);
    refresh();
  }, [refresh]);

  const handleEditFormSuccess = useCallback((updatedUser: IUserMaster) => {
    console.log('利用者情報が更新されました:', updatedUser);
    setShowEditForm(false);
    setSelectedUser(null);
    refresh();
  }, [refresh]);

  const handleEditClick = useCallback((user: IUserMaster) => {
    setSelectedUser(user);
    setShowEditForm(true);
  }, []);

    const handleCloseForm = () => {
    console.log('handleCloseForm called');
    setShowCreateForm(false);
    setShowEditForm(false);
    setSelectedUser(null);
  };

  if (status === 'loading' && !data.length) {
    return <Loading />;
  }

  if (status === 'error' && error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof AuthRequiredError || errMessage === 'AUTH_REQUIRED') {
      return (
        <ErrorState message="サインインが必要です。上部の「Sign in」を押して認証を完了してください。" />
      );
    }
    return <ErrorState message={errMessage} />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" component="h3" gutterBottom>
          新規利用者登録
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="end" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField
              label="ユーザーID"
              placeholder="U-001"
              size="small"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
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
            onChange={(e) => setFullName(e.target.value)}
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
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={handleRefresh}
            disabled={busyId !== null}
          >
            {busyId === -2 ? '更新中…' : '更新'}
          </Button>
        </Stack>

        <Box sx={{ borderTop: '1px solid', borderColor: 'grey.300', pt: 2 }}>
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
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        ステータス: {status}
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>ユーザーID</TableCell>
              <TableCell>氏名</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((u) => {
              const rowBusy = busyId === Number(u.Id);
              return (
                <TableRow key={u.Id} hover>
                  <TableCell>{u.Id}</TableCell>
                  <TableCell>{u.UserID}</TableCell>
                  <TableCell>{u.FullName}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleEditClick(u)}
                        disabled={rowBusy}
                        title="編集"
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(u.Id)}
                        disabled={rowBusy}
                        title="削除"
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

      {/* 新規作成フォームダイアログ */}
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

      {/* 編集フォームダイアログ */}
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
