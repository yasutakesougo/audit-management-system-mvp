import type { ElementType, FC, MouseEvent as ReactMouseEvent, RefObject } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { Link as RouterLink } from 'react-router-dom';
import Loading from '../../../ui/components/Loading';
import ErrorState from '../../../ui/components/ErrorState';
import UserDetailSections from '../UserDetailSections/index';
import { TESTIDS } from '@/testids';
import type { IUserMaster } from '../types';

type UsersListProps = {
  users: IUserMaster[];
  status: string;
  busyId: number | null;
  selectedUserKey: string | null;
  detailUser: IUserMaster | null;
  detailSectionRef: RefObject<HTMLDivElement | null>;
  errorMessage: string | null;
  onRefresh: () => Promise<void> | void;
  onDelete: (id: number | string) => Promise<void> | void;
  onEdit: (user: IUserMaster) => void;
  onSelectDetail: (event: ReactMouseEvent<HTMLButtonElement>, user: IUserMaster) => void;
  onCloseDetail: () => void;
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
}) => {
  if (status === 'loading' && users.length === 0) {
    return <Loading />;
  }

  if (status === 'error' && errorMessage) {
    return <ErrorState message={errorMessage} />;
  }

  const isRefreshing = busyId === -2;

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
          onClick={onRefresh}
          disabled={busyId !== null}
          size="small"
        >
          {isRefreshing ? '更新中…' : '一覧を更新'}
        </Button>
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
              {users.map((user) => {
                const rowBusy = busyId === Number(user.Id);
                const userKey = user.UserID || String(user.Id);
                const isSelected = selectedUserKey === userKey;
                return (
                  <TableRow key={user.Id} hover selected={isSelected}>
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
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 && (
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
