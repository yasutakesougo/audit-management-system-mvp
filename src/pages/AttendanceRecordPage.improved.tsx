import { ABSENCE_MONTHLY_LIMIT, DISCREPANCY_THRESHOLD } from '@/config/serviceRecords';
import {
    buildAbsentVisit,
    buildInitialVisits,
    canCheckOut,
    computeAbsenceEligibility,
    diffMinutes,
    formatTime,
    getDiscrepancyCount,
    isBeforeCloseTime,
    type AbsentMethod,
    type AttendanceUser,
    type AttendanceVisit,
} from '@/features/attendance/attendance.logic';
import {
    methodImpliesShuttle,
    resolveFromMethod,
    resolveToMethod,
    TRANSPORT_METHOD_LABEL,
    TRANSPORT_METHODS,
    type TransportMethod,
} from '@/features/attendance/transportMethod';
import { warmDataEntryComponents } from '@/mui/warm';
import { TESTIDS } from '@/testids';
import Snackbar from '@mui/material/Snackbar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LandscapeFab } from '../components/ui/LandscapeFab';

// Icons
import ActivityIcon from '@mui/icons-material/Assignment';
import AttendanceIcon from '@mui/icons-material/AssignmentInd';
import AbsenceIcon from '@mui/icons-material/CancelScheduleSend';
import CheckIcon from '@mui/icons-material/CheckCircle';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import BusIcon from '@mui/icons-material/DirectionsBus';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import RefreshIcon from '@mui/icons-material/Refresh';
import ResetIcon from '@mui/icons-material/Replay';
import MorningIcon from '@mui/icons-material/School';
import SearchIcon from '@mui/icons-material/Search';
import TimelineIcon from '@mui/icons-material/Timeline';
import EveningIcon from '@mui/icons-material/WbTwilight';

// MUI Components
import { getFlag } from '@/env';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

interface AbsenceDialogState {
  user: AttendanceUser;
  visit: AttendanceVisit;
  morningContacted: boolean;
  morningMethod: AbsentMethod;
  eveningChecked: boolean;
  eveningNote: string;
}

type FilterStatus = 'all' | 'pending' | 'completed' | 'absent';
type SortOrder = 'name' | 'status' | 'time';

const initialUsers: AttendanceUser[] = [
  { userCode: 'I001', userName: '田中太郎', isTransportTarget: true,  absenceClaimedThisMonth: 2, standardMinutes: 360 },
  { userCode: 'I002', userName: '佐藤花子', isTransportTarget: false, absenceClaimedThisMonth: 4, standardMinutes: 300 },
  { userCode: 'I003', userName: '鈴木一郎', isTransportTarget: true,  absenceClaimedThisMonth: 1, standardMinutes: 420 },
  { userCode: 'I004', userName: '高橋美里', isTransportTarget: true,  absenceClaimedThisMonth: 0, standardMinutes: 300 },
  { userCode: 'I005', userName: '山田健二', isTransportTarget: false, absenceClaimedThisMonth: 3, standardMinutes: 360 }
];

type AttendanceRecordPageProps = {
  'data-testid'?: string;
};



const AttendanceRecordPage: React.FC<AttendanceRecordPageProps> = ({ 'data-testid': dataTestId }) => {
  // Navigation hooks for cross-module navigation
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const targetUserIdFromQuery = searchParams.get('userId') ?? '';
  const _targetDateFromQuery = searchParams.get('date') ?? ''; // 将来の拡張用

  // State management
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [users, setUsers] = useState<AttendanceUser[]>(initialUsers);
  const [visits, setVisits] = useState<Record<string, AttendanceVisit>>(() =>
    buildInitialVisits(initialUsers, today)
  );
  const [absenceDialog, setAbsenceDialog] = useState<AbsenceDialogState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('name');
  const [expandedUserCode, setExpandedUserCode] = useState<string | null>(null);
  const toggleExpanded = useCallback((userCode: string) => {
    setExpandedUserCode((prev) => (prev === userCode ? null : userCode));
  }, []);

  // Toast notifications
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info'
  } | null>(null);

  const openToast = useCallback((message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleSnackbarClose = useCallback(() => {
    setSnackbar((prev) => (prev ? { ...prev, open: false } : prev));
  }, []);

  // MUI コンポーネントの事前読み込み（パフォーマンス最適化）
  useEffect(() => {
    warmDataEntryComponents();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    const interval = setInterval(() => {
      // Auto-save or sync with server in real implementation
      if (import.meta.env.DEV) console.log('Auto-refresh tick');
    }, 30000); // 30秒間隔

    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'r': {
            event.preventDefault();
            window.location.reload();
            break;
          }
          case 'f': {
            event.preventDefault();
            const searchInput = document.querySelector('[data-testid="search-users"]') as HTMLInputElement;
            searchInput?.focus();
            break;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Filtered and sorted users
  const filteredAndSortedUsers = useMemo(() => {
    const filtered = users.filter(user => {
      const matchesSearch = searchQuery === '' ||
        user.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.userCode.toLowerCase().includes(searchQuery.toLowerCase());

      const visit = visits[user.userCode];
      const matchesFilter = (() => {
        switch (filterStatus) {
          case 'pending':
            return visit.status === '未';
          case 'completed':
            return visit.status === '退所済' || !!visit.userConfirmedAt;
          case 'absent':
            return visit.status === '当日欠席';
          default:
            return true;
        }
      })();

      return matchesSearch && matchesFilter;
    });

    // Sort users
    filtered.sort((a, b) => {
      switch (sortOrder) {
        case 'name':
          return a.userName.localeCompare(b.userName, 'ja');
        case 'status':
          return visits[a.userCode].status.localeCompare(visits[b.userCode].status, 'ja');
        case 'time': {
          const aTime = visits[a.userCode].checkInAt || '';
          const bTime = visits[b.userCode].checkInAt || '';
          return bTime.localeCompare(aTime); // Latest first
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [users, visits, searchQuery, filterStatus, sortOrder]);

  // Summary calculations
  const summary = useMemo(() => {
    const values = Object.values(visits) as AttendanceVisit[];
    const attendIn = values.filter((visit) => visit.cntAttendIn === 1).length;
    const attendOut = values.filter((visit) => visit.cntAttendOut === 1).length;
    const transportTo = values.filter((visit) => {
      if (visit.transportToMethod) return visit.transportToMethod === 'office_shuttle';
      return visit.transportTo;
    }).length;
    const transportFrom = values.filter((visit) => {
      if (visit.transportFromMethod) return visit.transportFromMethod === 'office_shuttle';
      return visit.transportFrom;
    }).length;
    const absenceAddon = values.filter((visit) => visit.isAbsenceAddonClaimable).length;
    const pending = values.filter((visit) => visit.status === '未').length;
    const inProgress = values.filter((visit) => visit.status === '通所中').length;

    return {
      attendIn,
      attendOut,
      transportTo,
      transportFrom,
      absenceAddon,
      pending,
      inProgress,
      total: values.length
    };
  }, [visits]);

  const discrepancyCount = useMemo(
    () => getDiscrepancyCount(visits, users, DISCREPANCY_THRESHOLD),
    [visits, users]
  );

  // Event handlers
  const handleCheckIn = useCallback((user: AttendanceUser) => {
    setVisits((prev) => {
      const current = prev[user.userCode];
      if (!current || current.status === '当日欠席' || current.cntAttendIn === 1) {
        return prev;
      }
      const now = new Date().toISOString();
      return {
        ...prev,
        [user.userCode]: {
          ...current,
          status: '通所中',
          checkInAt: now,
          cntAttendIn: 1
        }
      };
    });
    openToast(`${user.userName}さんが通所しました`, 'success');
  }, [openToast]);

  const handleCheckOut = useCallback((user: AttendanceUser) => {
    setVisits((prev) => {
      const current = prev[user.userCode];
      if (!canCheckOut(current)) {
        return prev;
      }
      const now = new Date();
      const providedMinutes = diffMinutes(current.checkInAt, now.toISOString());
      const isEarly = isBeforeCloseTime(now);

      return {
        ...prev,
        [user.userCode]: {
          ...current,
          checkOutAt: now.toISOString(),
          cntAttendOut: 1,
          isEarlyLeave: isEarly,
          providedMinutes,
          status: '退所済'
        }
      };
    });
    openToast(`${user.userName}さんが退所しました`, 'success');
  }, [openToast]);

  const handleTransportMethodChange = useCallback((user: AttendanceUser, dir: 'to' | 'from', method: TransportMethod) => {
    setVisits((prev) => {
      const current = prev[user.userCode];
      if (!current) return prev;

      if (dir === 'to') {
        return {
          ...prev,
          [user.userCode]: {
            ...current,
            transportToMethod: method,
            transportTo: methodImpliesShuttle(method),
          },
        };
      } else {
        return {
          ...prev,
          [user.userCode]: {
            ...current,
            transportFromMethod: method,
            transportFrom: methodImpliesShuttle(method),
          },
        };
      }
    });

    const direction = dir === 'to' ? '往路' : '復路';
    openToast(`${user.userName}さんの${direction}を「${TRANSPORT_METHOD_LABEL[method]}」に設定しました`, 'info');
  }, [openToast]);

  const openAbsenceDialog = useCallback((user: AttendanceUser) => {
    const visit = visits[user.userCode];
    if (!visit) return;
    setAbsenceDialog({
      user,
      visit,
      morningContacted: visit.absentMorningContacted,
      morningMethod: visit.absentMorningMethod,
      eveningChecked: visit.eveningChecked,
      eveningNote: visit.eveningNote
    });
  }, [visits]);

  const closeAbsenceDialog = useCallback(() => setAbsenceDialog(null), []);

  const handleAbsenceSave = useCallback(() => {
    if (!absenceDialog) return;

    const { user, visit, morningContacted, morningMethod, eveningChecked, eveningNote } = absenceDialog;
    const eligible = computeAbsenceEligibility(
      user,
      morningContacted,
      eveningChecked,
      ABSENCE_MONTHLY_LIMIT
    );

    setVisits((prev) => ({
      ...prev,
      [user.userCode]: buildAbsentVisit(visit, {
        morningContacted,
        morningMethod,
        eveningChecked,
        eveningNote,
        eligible,
      }),
    }));

    if (eligible) {
      setUsers((prev) =>
        prev.map((entry) =>
          entry.userCode === user.userCode
            ? { ...entry, absenceClaimedThisMonth: entry.absenceClaimedThisMonth + 1 }
            : entry
        )
      );
    }

    const eligibilityMsg = eligible ? '（加算対象）' : '（加算対象外）';
    openToast(`${user.userName}さんの欠席を記録しました${eligibilityMsg}`, 'success');
    closeAbsenceDialog();
  }, [absenceDialog, openToast, closeAbsenceDialog]);

  const handleReset = useCallback((user: AttendanceUser) => {
    setVisits((prev) => ({
      ...prev,
      [user.userCode]: buildInitialVisits([user], today)[user.userCode]
    }));
    openToast(`${user.userName}さんの記録をリセットしました`, 'warning');
  }, [today, openToast]);

  const handleUserConfirm = useCallback((user: AttendanceUser) => {
    setVisits(prev => ({
      ...prev,
      [user.userCode]: {
        ...prev[user.userCode],
        userConfirmedAt: prev[user.userCode].userConfirmedAt ?? new Date().toISOString()
      }
    }));
    openToast(`${user.userName}さんの確認を記録しました`, 'success');
  }, [openToast]);

  const renderUserRow = (user: AttendanceUser) => {
    const visit = visits[user.userCode];
    const disableCheckIn = visit.status === '当日欠席' || visit.cntAttendIn === 1;
    const disableCheckOut = !canCheckOut(visit);
    const disableAbsence = visit.status !== '未' && visit.status !== '当日欠席';
    const absenceLimitReached = user.absenceClaimedThisMonth >= ABSENCE_MONTHLY_LIMIT;
    const isFocused = targetUserIdFromQuery === user.userCode;
    const isExpanded = expandedUserCode === user.userCode;

    const E2E_UNLOCK_CONFIRM = getFlag('VITE_E2E_UNLOCK_CONFIRM');
    const confirmDisabled = !!visit.userConfirmedAt || (visit.status !== '退所済' && visit.status !== '当日欠席');
    const confirmDisabledFinal = E2E_UNLOCK_CONFIRM ? false : confirmDisabled;

    // Status chip color
    const statusColor = visit.status === '退所済' ? 'success' as const
      : visit.status === '当日欠席' ? 'error' as const
      : visit.status === '通所中' ? 'primary' as const
      : 'default' as const;

    return (
      <React.Fragment key={user.userCode}>
        <ListItem
          disablePadding
          data-testid={`row-${user.userCode}`}
          secondaryAction={
            <Stack direction="row" spacing={{ xs: 3, sm: 2 }} alignItems="center">
              {/* 通所 */}
              <Tooltip title={disableCheckIn ? '通所済み/欠席' : '通所'}>
                <span>
                  <IconButton
                    size="medium"
                    color="primary"
                    disabled={disableCheckIn}
                    data-testid={`btn-checkin-${user.userCode}`}
                    onClick={(e) => { e.stopPropagation(); handleCheckIn(user); }}
                    sx={{ minWidth: 48, minHeight: 48 }}
                  >
                    <LoginIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              {/* 退所 */}
              <Tooltip title={disableCheckOut ? '通所後に退所可能' : '退所'}>
                <span>
                  <IconButton
                    size="medium"
                    color="success"
                    disabled={disableCheckOut}
                    data-testid={`btn-checkout-${user.userCode}`}
                    onClick={(e) => { e.stopPropagation(); handleCheckOut(user); }}
                    sx={{ minWidth: 48, minHeight: 48 }}
                  >
                    <LogoutIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              {/* 欠席 */}
              <Tooltip title={disableAbsence ? '通所後は欠席不可' : '欠席'}>
                <span>
                  <IconButton
                    size="medium"
                    color="warning"
                    disabled={disableAbsence}
                    data-testid={`btn-absence-${user.userCode}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!disableAbsence) warmDataEntryComponents();
                      openAbsenceDialog(user);
                    }}
                    sx={{ minWidth: 48, minHeight: 48 }}
                  >
                    <AbsenceIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              {/* 確認 */}
              <Tooltip
                title={
                  visit.userConfirmedAt
                    ? `確認済 ${new Date(visit.userConfirmedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`
                    : '利用者確認'
                }
              >
                <span style={{ marginLeft: 8 }}>
                  <IconButton
                    size="medium"
                    color="success"
                    disabled={confirmDisabledFinal}
                    data-testid={`btn-confirm-${user.userCode}`}
                    onClick={(e) => { e.stopPropagation(); handleUserConfirm(user); }}
                    sx={{ minWidth: 48, minHeight: 48 }}
                  >
                    <CheckIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              {/* 展開/折りたたみ */}
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); toggleExpanded(user.userCode); }}
                aria-label={isExpanded ? '詳細を閉じる' : '詳細を開く'}
                aria-expanded={isExpanded}
                aria-controls={`attendance-row-details-${user.userCode}`}
              >
                {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
              </IconButton>
            </Stack>
          }
          sx={{
            borderLeft: isFocused ? '3px solid' : 'none',
            borderLeftColor: isFocused ? 'primary.main' : undefined,
            bgcolor: isFocused ? 'action.selected' : undefined,
          }}
        >
          <ListItemButton
            onClick={() => toggleExpanded(user.userCode)}
            sx={{ minHeight: 48, pr: 38 }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%', minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: 700, minWidth: 0, flex: 1 }}>
                {user.userName}
              </Typography>

              <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
                {user.userCode}
              </Typography>

              <Chip
                size="small"
                label={visit.status}
                color={statusColor}
                variant={visit.status === '未' ? 'outlined' : 'filled'}
              />

              {visit.checkInAt && (
                <Chip label={formatTime(visit.checkInAt)} size="small" sx={{ display: { xs: 'none', sm: 'flex' } }} />
              )}

              {visit.isAbsenceAddonClaimable && (
                <Chip label="加算" color="warning" size="small" sx={{ display: { xs: 'none', md: 'flex' } }} />
              )}

              {visit.userConfirmedAt && (
                <CheckIcon fontSize="small" color="success" sx={{ display: { xs: 'none', sm: 'flex' } }} />
              )}
            </Stack>
          </ListItemButton>
        </ListItem>

        {/* Expanded detail */}
        <Collapse in={isExpanded} timeout="auto" unmountOnExit id={`attendance-row-details-${user.userCode}`}>
          <Stack spacing={1.5} sx={{ px: 3, py: 2, bgcolor: 'action.hover' }}>
            {/* 時刻チップ群 */}
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip label={`ステータス: ${visit.status}`} color={statusColor} variant={visit.status === '未' ? 'outlined' : 'filled'} size="small" />
              {visit.checkInAt && <Chip label={`通所 ${formatTime(visit.checkInAt)}`} size="small" />}
              {visit.checkOutAt && <Chip label={`退所 ${formatTime(visit.checkOutAt)}`} color="success" size="small" />}
              {visit.providedMinutes > 0 && <Chip label={`実提供 ${visit.providedMinutes}分`} size="small" />}
              <Chip label={`算定 ${user.standardMinutes}分`} variant="outlined" size="small" />
              {(visit.providedMinutes ?? 0) > 0 && visit.providedMinutes! < user.standardMinutes * DISCREPANCY_THRESHOLD && (
                <Chip label="乖離あり" color="warning" variant="outlined" size="small" />
              )}
              {visit.isEarlyLeave && <Chip label="早退" color="warning" variant="outlined" size="small" />}
              {visit.isAbsenceAddonClaimable && <Chip label="欠席加算対象" color="warning" size="small" />}
              {visit.userConfirmedAt && (
                <Chip
                  label={`確認済 ${new Date(visit.userConfirmedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`}
                  color="success"
                  size="small"
                />
              )}
            </Stack>

            {/* 送迎手段 */}
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>行き</InputLabel>
                <Select
                  value={resolveToMethod(user, visit)}
                  label="行き"
                  onChange={(e) => handleTransportMethodChange(user, 'to', e.target.value as TransportMethod)}
                  disabled={visit.status === '当日欠席'}
                >
                  {TRANSPORT_METHODS.map((m) => (
                    <MenuItem key={m} value={m}>{TRANSPORT_METHOD_LABEL[m]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>帰り</InputLabel>
                <Select
                  value={resolveFromMethod(user, visit)}
                  label="帰り"
                  onChange={(e) => handleTransportMethodChange(user, 'from', e.target.value as TransportMethod)}
                  disabled={visit.status === '当日欠席'}
                >
                  {TRANSPORT_METHODS.map((m) => (
                    <MenuItem key={m} value={m}>{TRANSPORT_METHOD_LABEL[m]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            {/* 欠席ステータス */}
            {visit.status === '当日欠席' && (
              <Alert severity={visit.isAbsenceAddonClaimable ? 'warning' : 'info'}>
                欠席対応: 朝連絡 {visit.absentMorningContacted ? '済' : '未'} / 夕方様子{' '}
                {visit.eveningChecked ? '済' : '未'}{' '}
                {absenceLimitReached && visit.isAbsenceAddonClaimable === false ? '（上限超過のため請求対象外）' : ''}
              </Alert>
            )}

            {/* クロスモジュールリンク */}
            <Divider />
            <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
              <Tooltip title="今日の支援記録（ケース記録）を開く">
                <Button
                  variant="text" color="primary" size="small"
                  onClick={() => navigate(`/daily/activity?userId=${user.userCode}&date=${today}`)}
                  data-testid={`btn-activity-${user.userCode}`}
                  startIcon={<ActivityIcon />}
                >
                  支援記録
                </Button>
              </Tooltip>
              <Tooltip title="申し送りタイムラインを開く">
                <Button
                  variant="text" color="secondary" size="small"
                  onClick={() => navigate('/handoff-timeline', {
                    state: { dayScope: 'today', timeFilter: 'all', userId: user.userCode, date: today, focus: true },
                  })}
                  data-testid={`btn-handoff-${user.userCode}`}
                  startIcon={<TimelineIcon />}
                >
                  申し送り
                </Button>
              </Tooltip>
              <Tooltip title="初期状態へリセット">
                <Button
                  variant="text" color="inherit" size="small"
                  onClick={() => handleReset(user)}
                  data-testid={`btn-reset-${user.userCode}`}
                  startIcon={<ResetIcon />}
                >
                  リセット
                </Button>
              </Tooltip>
            </Stack>
          </Stack>
          <Divider />
        </Collapse>
      </React.Fragment>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }} data-testid={dataTestId ?? TESTIDS['attendance-page']}>
      {/* Toast Notifications */}
      {snackbar && (
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            onClose={handleSnackbarClose}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
            data-testid="toast"
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      )}

      <Stack spacing={3}>
        {/* Header */}
        <Stack spacing={1}>
          <Typography variant="h3" component="h1" data-testid="heading-attendance">
            通所実績入力
          </Typography>
          <Typography color="text.secondary">
            リアルタイム記録・通所・送迎・欠席加算の状態管理
          </Typography>
        </Stack>

        {/* Enhanced Summary Dashboard */}
        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" alignItems="center">
            <Badge badgeContent={summary.pending} color="error">
              <Chip icon={<AttendanceIcon />} color="primary" label={`通所 ${summary.attendIn}`} />
            </Badge>
            <Chip icon={<CheckIcon />} color="success" label={`退所 ${summary.attendOut}`} />
            <Chip icon={<BusIcon />} color="secondary" label={`往路送迎 ${summary.transportTo}`} />
            <Chip icon={<BusIcon />} color="secondary" label={`復路送迎 ${summary.transportFrom}`} />
            <Chip icon={<AbsenceIcon />} color="warning" label={`欠席加算 ${summary.absenceAddon}`} />
            <Chip
              label={`乖離 ${discrepancyCount}`}
              variant="outlined"
              color={discrepancyCount > 0 ? "error" : "default"}
              data-testid="chip-discrepancy"
            />

            <Divider orientation="vertical" flexItem />

            <Typography variant="body2" color="text.secondary">
              進行中: {summary.inProgress} | 未完了: {summary.pending} | 総数: {summary.total}
            </Typography>
          </Stack>
        </Paper>

        {/* Enhanced Controls */}
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            {/* Search & Filter Row */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <TextField
                size="small"
                placeholder="利用者名・IDで検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                sx={{ flexGrow: 1 }}
                data-testid="search-users"
              />

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>フィルタ</InputLabel>
                <Select
                  value={filterStatus}
                  label="フィルタ"
                  onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                >
                  <MenuItem value="all">すべて</MenuItem>
                  <MenuItem value="pending">未完了</MenuItem>
                  <MenuItem value="completed">完了</MenuItem>
                  <MenuItem value="absent">欠席</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>並び順</InputLabel>
                <Select
                  value={sortOrder}
                  label="並び順"
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                >
                  <MenuItem value="name">氏名順</MenuItem>
                  <MenuItem value="status">ステータス順</MenuItem>
                  <MenuItem value="time">時刻順</MenuItem>
                </Select>
              </FormControl>


            </Stack>

            {/* Results Info */}
            {searchQuery && (
              <Typography variant="body2" color="text.secondary">
                "{searchQuery}" の検索結果: {filteredAndSortedUsers.length}件
              </Typography>
            )}
          </Stack>
        </Paper>

        {/* User List */}
        <Paper variant="outlined">
          <List dense disablePadding>
            {filteredAndSortedUsers.map(renderUserRow)}
          </List>

          {filteredAndSortedUsers.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                {searchQuery ? '検索条件に一致する利用者が見つかりません' : '利用者が登録されていません'}
              </Typography>
              {searchQuery && (
                <Button
                  variant="outlined"
                  onClick={() => setSearchQuery('')}
                  sx={{ mt: 2 }}
                >
                  検索をクリア
                </Button>
              )}
              </Paper>
            )}
        </Paper>
      </Stack>

      {/* Floating Action Button */}
      <LandscapeFab
        icon={<RefreshIcon />}
        ariaLabel="再読込"
        onClick={() => window.location.reload()}
        testId="fab-refresh"
      />

      {/* Absence Dialog */}
      <Dialog open={Boolean(absenceDialog)} onClose={closeAbsenceDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AbsenceIcon />
            <Typography variant="h6">欠席対応記録</Typography>
          </Stack>
        </DialogTitle>
        {absenceDialog && (
          <DialogContent dividers>
            <Stack spacing={3}>
              <Typography variant="body1" fontWeight="bold">
                対象: {absenceDialog.user.userName}（{absenceDialog.user.userCode}）
              </Typography>

              <Alert severity="info" icon={<AbsenceIcon />}>
                当月欠席加算確定 {absenceDialog.user.absenceClaimedThisMonth} 件 / {ABSENCE_MONTHLY_LIMIT} 件
              </Alert>

              <FormControlLabel
                control={
                  <Switch
                    checked={absenceDialog.morningContacted}
                    onChange={(_, checked) =>
                      setAbsenceDialog((prev) =>
                        prev
                          ? {
                              ...prev,
                              morningContacted: checked,
                              morningMethod: checked ? prev.morningMethod || '電話' : ''
                            }
                          : prev
                      )
                    }
                  />
                }
                label={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <MorningIcon fontSize="small" />
                    <Typography>朝の受入連絡</Typography>
                  </Stack>
                }
              />

              {absenceDialog.morningContacted && (
                <FormControl fullWidth size="small">
                  <InputLabel id="morning-method-label">連絡方法</InputLabel>
                  <Select
                    labelId="morning-method-label"
                    label="連絡方法"
                    value={absenceDialog.morningMethod}
                    onChange={(event) =>
                      setAbsenceDialog((prev) =>
                        prev ? { ...prev, morningMethod: event.target.value as AbsentMethod } : prev
                      )
                    }
                  >
                    <MenuItem value="電話">電話</MenuItem>
                    <MenuItem value="SMS">SMS</MenuItem>
                    <MenuItem value="家族">家族</MenuItem>
                    <MenuItem value="その他">その他</MenuItem>
                  </Select>
                </FormControl>
              )}

              <FormControlLabel
                control={
                  <Switch
                    checked={absenceDialog.eveningChecked}
                    onChange={(_, checked) =>
                      setAbsenceDialog((prev) =>
                        prev ? { ...prev, eveningChecked: checked } : prev
                      )
                    }
                  />
                }
                label={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <EveningIcon fontSize="small" />
                    <Typography>夕方の様子伺い</Typography>
                  </Stack>
                }
              />

              {absenceDialog.eveningChecked && (
                <TextField
                  label="夕方の様子メモ"
                  multiline
                  minRows={3}
                  value={absenceDialog.eveningNote}
                  onChange={(event) =>
                    setAbsenceDialog((prev) =>
                      prev ? { ...prev, eveningNote: event.target.value } : prev
                    )
                  }
                  placeholder="体調、家庭の様子、次回の利用予定など..."
                  fullWidth
                />
              )}
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={closeAbsenceDialog}>キャンセル</Button>
          <Button
            onClick={handleAbsenceSave}
            variant="contained"
            disabled={
              !absenceDialog ||
              (absenceDialog.morningContacted && absenceDialog.morningMethod === '')
            }
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AttendanceRecordPage;
