import { TESTIDS, tid, tidWithSuffix } from '@/testids';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
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
import type { ElementType, FC, MouseEvent as ReactMouseEvent, RefObject } from 'react';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import ErrorState from '../../../ui/components/ErrorState';
import Loading from '../../../ui/components/Loading';
import type { IUserMaster } from '../types';
import UserDetailSections from '../UserDetailSections/index';

type UsersListProps = {
  users: IUserMaster[];
  status: string;
  busyId: number | null;
  selectedUserKey: string | null;
  detailUser: IUserMaster | null;
  detailSectionRef: RefObject<HTMLDivElement>;
  errorMessage: string | null;
  onRefresh: () => Promise<void> | void;
  onDelete: (id: number | string) => Promise<void> | void;
  onEdit: (user: IUserMaster) => void;
  onSelectDetail: (event: ReactMouseEvent<HTMLButtonElement>, user: IUserMaster) => void;
  onCloseDetail: () => void;
  onExportPDF?: (userId: string) => void;
  integrityErrors?: string[];
};

const UsersList: FC<UsersListProps> = ({
  users,
  status,
  busyId,
  selectedUserKey,
  detailUser,
  detailSectionRef,
  errorMessage,
  onRefresh,
  onDelete,
  onEdit,
  onSelectDetail,
  onCloseDetail,
  onExportPDF,
  integrityErrors = [],
}) => {
  if (status === 'loading' && users.length === 0) {
    return <Loading />;
  }

  if (status === 'error' && errorMessage) {
    return <ErrorState message={errorMessage} />;
  }

  const isRefreshing = busyId === -2;
  const [search, setSearch] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);
  const [onlySevere, setOnlySevere] = useState(false);

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
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
  }, [onlyActive, onlySevere, search, users]);

  return (
    <Stack spacing={2.5}>
      {integrityErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 1 }} data-testid="integrity-error-alert">
          <AlertTitle sx={{ fontWeight: 700 }}>データ整合性エラーを検出しました</AlertTitle>
          <Typography variant="body2" sx={{ mb: 1 }}>
            SharePoint上のデータが期待される形式と一致しません。管理者はマニュアルに従い、リストの列設定を確認してください。
          </Typography>
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {integrityErrors.slice(0, 5).map((err, idx) => (
              <li key={idx} style={{ fontSize: '0.75rem' }}>{err}</li>
            ))}
            {integrityErrors.length > 5 && (
              <li style={{ fontSize: '0.75rem' }}>他 {integrityErrors.length - 5} 件...</li>
            )}
          </ul>
        </Alert>
      )}

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
          onClick={onRefresh}
          disabled={busyId !== null}
          size="small"
        >
          {isRefreshing ? '更新中…' : '一覧を更新'}
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
          {...tid(TESTIDS['users-panel-search'])}
        />
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <FormControlLabel
            control={
              <Checkbox
                checked={onlyActive}
                onChange={(event) => setOnlyActive(event.target.checked)}
                {...tid(TESTIDS['users-panel-filter-active'])}
              />
            }
            label="利用中のみ"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={onlySevere}
                onChange={(event) => setOnlySevere(event.target.checked)}
                {...tid(TESTIDS['users-panel-filter-severe'])}
              />
            }
            label="重度加算対象のみ"
          />
        </Stack>
      </Stack>
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} alignItems="stretch">
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ flex: { lg: 1.1 }, minWidth: { lg: 0 } }}
          data-testid={TESTIDS['users-list-table']}
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
                const isSelected = selectedUserKey === userKey;
                return (
                  <TableRow
                    key={user.Id}
                    hover
                    selected={isSelected}
                    {...tidWithSuffix(TESTIDS['users-list-table-row'], `-${userKey}`)}
                  >
                    <TableCell>{user.Id}</TableCell>
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
                          onClick={(event: ReactMouseEvent<HTMLButtonElement>) => onSelectDetail(event, user)}
                          aria-pressed={isSelected}
                          aria-label="詳細"
                        >
                          <InfoOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => onEdit(user)}
                          disabled={rowBusy}
                          title="編集"
                          aria-label="編集"
                        >
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => onDelete(user.Id)}
                          disabled={rowBusy}
                          title="削除"
                          aria-label="削除"
                        >
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => onExportPDF?.(userKey)}
                          disabled={rowBusy}
                          title="実績記録票 (PDF) 出力"
                          aria-label="PDF出力"
                        >
                          <PictureAsPdfRoundedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    条件に一致する利用者がいません
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
              backLink={{ onClick: onCloseDetail, label: '詳細表示を閉じる' }}
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

export default UsersList;
