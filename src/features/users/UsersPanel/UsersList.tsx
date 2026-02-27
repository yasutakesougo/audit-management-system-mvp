import { TESTIDS, tid, tidWithSuffix } from '@/testids';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SortRoundedIcon from '@mui/icons-material/SortRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Fade from '@mui/material/Fade';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ElementType, FC, KeyboardEvent, MouseEvent as ReactMouseEvent, RefObject } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import ErrorState from '../../../ui/components/ErrorState';
import Loading from '../../../ui/components/Loading';
import type { IUserMaster } from '../types';
import UserDetailSections from '../UserDetailSections/index';
import {
    getUserStatusChips,
    isUserInactive,
    sortUsersByPriority,
    type StatusChip,
} from './userStatusUtils';

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
  const [search, setSearch] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);
  const [onlySevere, setOnlySevere] = useState(false);
  const [prioritySort, setPrioritySort] = useState(false);

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

  const displayUsers = useMemo(
    () => (prioritySort ? sortUsersByPriority(filteredUsers) : filteredUsers),
    [filteredUsers, prioritySort],
  );

  // ── ④ 行クリックで詳細表示 ──
  const handleRowClick = useCallback(
    (event: ReactMouseEvent<HTMLTableRowElement>, user: IUserMaster) => {
      // meta/ctrl → リンクのデフォルト動作を許可（新タブ）
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      // ReactMouseEvent<HTMLTableRowElement> → HTMLButtonElement へ型変換
      onSelectDetail(event as unknown as ReactMouseEvent<HTMLButtonElement>, user);
    },
    [onSelectDetail],
  );

  const handleRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>, user: IUserMaster) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelectDetail(event as unknown as ReactMouseEvent<HTMLButtonElement>, user);
      }
    },
    [onSelectDetail],
  );

  const renderChip = (chip: StatusChip) => {
    const el = (
      <Chip
        key={chip.label}
        label={chip.label}
        color={chip.color}
        variant={chip.variant ?? 'filled'}
        size="small"
        sx={{ height: 22, fontSize: '0.75rem' }}
      />
    );
    return chip.tooltip ? (
      <Tooltip key={chip.label} title={chip.tooltip} arrow>
        {el}
      </Tooltip>
    ) : el;
  };

  return (
    <Stack spacing={1.5}>
      {/* ── ① ヘッダー統合：1行にタイトル+件数+ボタン ── */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ minHeight: 40 }}
      >
        <Typography variant="h6" component="h3" sx={{ fontWeight: 700, fontSize: '1.15rem' }}>
          利用者一覧
        </Typography>
        <Chip
          label={`${filteredUsers.length} / ${users.length}`}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: '0.75rem' }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={<RefreshRoundedIcon />}
          onClick={onRefresh}
          disabled={busyId !== null}
          size="small"
          sx={{ textTransform: 'none' }}
        >
          {isRefreshing ? '更新中…' : '更新'}
        </Button>
      </Stack>

      {/* Loading indicator (replaces ステータス text) */}
      {status === 'loading' && <LinearProgress sx={{ borderRadius: 1 }} />}

      {/* ── ② フィルター横1行 ── */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        sx={{ rowGap: 1 }}
      >
        <TextField
          size="small"
          placeholder="ID / 氏名 / フリガナ"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{
            flex: 1,
            minWidth: 220,
            maxWidth: 360,
            '& .MuiOutlinedInput-root': { borderRadius: 2 },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
          {...tid(TESTIDS['users-panel-search'])}
        />
        <Chip
          label="利用中のみ"
          clickable
          color={onlyActive ? 'primary' : 'default'}
          variant={onlyActive ? 'filled' : 'outlined'}
          size="small"
          onClick={() => setOnlyActive((prev) => !prev)}
          sx={{ fontWeight: 500 }}
          {...tid(TESTIDS['users-panel-filter-active'])}
        />
        <Chip
          label="重度対象"
          clickable
          color={onlySevere ? 'error' : 'default'}
          variant={onlySevere ? 'filled' : 'outlined'}
          size="small"
          onClick={() => setOnlySevere((prev) => !prev)}
          sx={{ fontWeight: 500 }}
          {...tid(TESTIDS['users-panel-filter-severe'])}
        />
        <Chip
          icon={<SortRoundedIcon />}
          label="重要順"
          clickable
          color={prioritySort ? 'warning' : 'default'}
          variant={prioritySort ? 'filled' : 'outlined'}
          size="small"
          onClick={() => setPrioritySort((prev) => !prev)}
          sx={{ fontWeight: 500 }}
        />
      </Stack>

      {/* ── メインコンテンツ ── */}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch">
        {/* ── テーブル ── */}
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{
            flex: { lg: 1.1 },
            minWidth: { lg: 0 },
            borderRadius: 2,
            maxHeight: { lg: 'calc(100vh - 280px)' },
            overflow: 'auto',
          }}
          data-testid={TESTIDS['users-list-table']}
        >
          {/* ── ③ dense table ── */}
          <Table stickyHeader size="small" aria-label="利用者一覧テーブル">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    minWidth: 140,
                    whiteSpace: 'nowrap',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    bgcolor: 'grey.50',
                  }}
                >
                  状態
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', bgcolor: 'grey.50' }}>
                  ユーザーID
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', bgcolor: 'grey.50' }}>
                  氏名
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ fontWeight: 700, fontSize: '0.8rem', bgcolor: 'grey.50', width: 120 }}
                >
                  操作
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayUsers.map((user) => {
                const rowBusy = busyId === Number(user.Id);
                const userKey = user.UserID || String(user.Id);
                const isSelected = selectedUserKey === userKey;
                const inactive = isUserInactive(user);
                const { visible: visibleChips, overflow: overflowChips } = getUserStatusChips(user);
                const overflowText = overflowChips.map((c) => c.label).join(', ');
                return (
                  <TableRow
                    key={user.Id}
                    hover
                    selected={isSelected}
                    // ── ④ 行クリック ──
                    onClick={(e) => handleRowClick(e, user)}
                    onKeyDown={(e) => handleRowKeyDown(e, user)}
                    tabIndex={0}
                    role="button"
                    sx={{
                      cursor: 'pointer',
                      ...(inactive ? { opacity: 0.55 } : {}),
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: -2,
                      },
                    }}
                    {...tidWithSuffix(TESTIDS['users-list-table-row'], `-${userKey}`)}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', py: 0.75 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {visibleChips.map(renderChip)}
                        {overflowChips.length > 0 && (
                          <Tooltip title={overflowText} arrow>
                            <Chip
                              label={`+${overflowChips.length}`}
                              size="small"
                              variant="outlined"
                              sx={{ height: 22, fontSize: '0.7rem' }}
                            />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ py: 0.75, fontSize: '0.85rem' }}>
                      {user.UserID}
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 0.75,
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        ...(inactive ? { color: 'text.secondary' } : {}),
                      }}
                    >
                      {user.FullName}
                    </TableCell>
                    <TableCell align="center" sx={{ py: 0.75 }}>
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <IconButton
                          size="small"
                          color="default"
                          component={RouterLink as unknown as ElementType}
                          to={`/users/${encodeURIComponent(userKey)}`}
                          state={{ user }}
                          disabled={rowBusy}
                          title="詳細"
                          onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                            event.stopPropagation();
                            onSelectDetail(event, user);
                          }}
                          aria-pressed={isSelected}
                          aria-label="詳細"
                        >
                          <InfoOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                            event.stopPropagation();
                            onEdit(user);
                          }}
                          disabled={rowBusy}
                          title="編集"
                          aria-label="編集"
                        >
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                            event.stopPropagation();
                            onDelete(user.Id);
                          }}
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
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    <Stack spacing={1} alignItems="center">
                      <SearchRoundedIcon sx={{ fontSize: 32, opacity: 0.4 }} />
                      <Typography variant="body2" color="text.secondary">
                        条件に一致する利用者がいません
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ── 詳細ペイン ── */}
        <Box
          ref={detailSectionRef}
          sx={{ flex: { lg: 0.9 }, minWidth: { xs: '100%', lg: 380 } }}
          data-testid={TESTIDS['users-detail-pane']}
        >
          {detailUser ? (
            <Fade in timeout={200}>
              <div>
                <UserDetailSections
                  user={detailUser}
                  variant="embedded"
                  backLink={{ onClick: onCloseDetail, label: '詳細表示を閉じる' }}
                />
              </div>
            </Fade>
          ) : (
            /* ── ⑤ 空状態改善 ── */
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 3, md: 4 },
                borderRadius: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 200,
                bgcolor: 'grey.50',
              }}
            >
              <PersonSearchRoundedIcon
                sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }}
              />
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                利用者詳細
              </Typography>
              <Typography variant="body2" color="text.disabled" textAlign="center" sx={{ mt: 0.5 }}>
                一覧から利用者を選択すると、ここに詳細が表示されます
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ mt: 1 }}>
                ⌘/Ctrl + クリックで新しいタブに開きます
              </Typography>
            </Paper>
          )}
        </Box>
      </Stack>
    </Stack>
  );
};

export default UsersList;
