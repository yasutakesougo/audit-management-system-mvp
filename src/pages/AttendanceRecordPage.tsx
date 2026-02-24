/* eslint-disable boundaries/element-types */
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
  getActiveUsers,
  type AttendanceUserItem 
} from '@/features/attendance/infra/attendanceUsersRepository';
import { 
  getDailyByDate,
  upsertDailyByKey,
  type AttendanceDailyItem 
} from '@/features/attendance/infra/attendanceDailyRepository';
import { AttendanceRow } from '@/features/attendance/components/AttendanceRow';
import { AttendanceDetailDrawer } from '@/features/attendance/components/AttendanceDetailDrawer';
import {
  isAttendanceError,
  type AttendanceErrorCode,
  useAttendanceActions,
} from '@/features/attendance/hooks/useAttendanceActions';
import { useAuth } from '@/auth/useAuth';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { warmDataEntryComponents } from '@/mui/warm';
import { TESTIDS } from '@/testids';
import AttendanceIcon from '@mui/icons-material/AssignmentInd';
import AbsenceIcon from '@mui/icons-material/CancelScheduleSend';
import CheckIcon from '@mui/icons-material/CheckCircle';
import BusIcon from '@mui/icons-material/DirectionsBus';
import MorningIcon from '@mui/icons-material/School';
import SearchIcon from '@mui/icons-material/Search';
import EveningIcon from '@mui/icons-material/WbTwilight';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FullScreenDailyDialogPage } from '@/features/daily/components/FullScreenDailyDialogPage';

type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

type UndoPayload = {
  userCode: string;
  prevVisit: AttendanceVisit;
  message: string;
};

type FilterStatus = 'all' | 'pending' | 'completed' | 'absent';

const ATTENDANCE_ERROR_MESSAGES: Record<AttendanceErrorCode, string> = {
  CONFLICT: '他の端末で更新されています。画面を更新してから再試行してください。',
  THROTTLED: 'サーバーが混み合っています。数十秒待ってから再度押してください。',
  NETWORK: '通信エラーです。ネット接続を確認してください。',
  UNKNOWN: '保存に失敗しました。管理者へ連絡してください。',
};

interface AbsenceDialogState {
  user: AttendanceUser;
  visit: AttendanceVisit;
  morningContacted: boolean;
  morningMethod: AbsentMethod;
  eveningChecked: boolean;
  eveningNote: string;
}

const initialUsers: AttendanceUser[] = [
  { userCode: 'I001', userName: '田中太郎', isTransportTarget: true,  absenceClaimedThisMonth: 2, standardMinutes: 360 },
  { userCode: 'I002', userName: '佐藤花子', isTransportTarget: false, absenceClaimedThisMonth: 4, standardMinutes: 300 },
  { userCode: 'I003', userName: '鈴木一郎', isTransportTarget: true,  absenceClaimedThisMonth: 1, standardMinutes: 420 }
];

type AttendanceRecordPageProps = {
  'data-testid'?: string;
};

const AttendanceRecordPage: React.FC<AttendanceRecordPageProps> = ({ 'data-testid': dataTestId }) => {
  // Navigation hooks for cross-module navigation
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const targetUserIdFromQuery = searchParams.get('userId') ?? '';
  const _targetDateFromQuery = searchParams.get('date') ?? ''; // 将来の拡張用（today以外の日対応時）

  // MUI コンポーネントの事前読み込み（パフォーマンス最適化）
  useEffect(() => {
    // Dialog、TextField、Select等の重要コンポーネントを事前ロード
    // 欠席ダイアログ表示時の遅延を防ぐ
    warmDataEntryComponents();
  }, []);

  // Snackbar state for toast notifications
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: ToastSeverity } | null>(null);
  const [undo, setUndo] = useState<UndoPayload | null>(null);

  const openToast = (message: string, severity: ToastSeverity, options?: { keepUndo?: boolean }) => {
    if (!options?.keepUndo) {
      setUndo(null);
    }
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = () => {
    setSnackbar((prev) => (prev ? { ...prev, open: false } : prev));
  };
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 8000);
    return () => window.clearTimeout(timer);
  }, [undo]);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AttendanceUser[]>(initialUsers);
  const [visits, setVisits] = useState<Record<string, AttendanceVisit>>(() =>
    buildInitialVisits(initialUsers, today)
  );
  const [absenceDialog, setAbsenceDialog] = useState<AbsenceDialogState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [detailDrawer, setDetailDrawer] = useState<{ user: AttendanceUser; visit: AttendanceVisit } | null>(null);

  // SharePoint client setup
  const { acquireToken } = useAuth();
  const spClient = useMemo(() => {
    if (!acquireToken) return null;
    try {
      return createSpClient(acquireToken, ensureConfig().baseUrl);
    } catch {
      return null;
    }
  }, [acquireToken]);

  // Map SharePoint items to local types
  const mapUserItem = (item: AttendanceUserItem): AttendanceUser => ({
    userCode: item.UserCode,
    userName: item.Title,
    isTransportTarget: item.IsTransportTarget,
    absenceClaimedThisMonth: 0, // TODO: 月次集計から取得
    standardMinutes: item.StandardMinutes,
  });

  const mapDailyToVisit = (item: AttendanceDailyItem): AttendanceVisit => ({
    userCode: item.UserCode,
    status: item.Status as AttendanceVisit['status'],
    recordDate: item.RecordDate,
    cntAttendIn: item.CntAttendIn ?? 0,
    cntAttendOut: item.CntAttendOut ?? 0,
    transportTo: item.TransportTo ?? false,
    transportFrom: item.TransportFrom ?? false,
    isEarlyLeave: item.IsEarlyLeave ?? false,
    absentMorningContacted: item.AbsentMorningContacted ?? false,
    absentMorningMethod: (item.AbsentMorningMethod as AbsentMethod) ?? '',
    eveningChecked: item.EveningChecked ?? false,
    eveningNote: item.EveningNote ?? '',
    isAbsenceAddonClaimable: item.IsAbsenceAddonClaimable ?? false,
    providedMinutes: item.ProvidedMinutes ?? 0,
    userConfirmedAt: item.UserConfirmedAt ?? undefined,
    checkInAt: item.CheckInAt ?? undefined,
    checkOutAt: item.CheckOutAt ?? undefined,
  });

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      if (!spClient) {
        // Demo mode: use initialUsers
        setLoading(false);
        return;
      }

      try {
        // 1. Load AttendanceUsers
        const userItems = await getActiveUsers(spClient);
        const loadedUsers = userItems.map(mapUserItem);
        setUsers(loadedUsers);

        // 2. Load today's AttendanceDaily
        const dailyItems = await getDailyByDate(spClient, today);
        const loadedVisits: Record<string, AttendanceVisit> = {};
        
        dailyItems.forEach((item) => {
          loadedVisits[item.UserCode] = mapDailyToVisit(item);
        });

        // 3. Fill in missing users with initial visits
        const initialVisits = buildInitialVisits(loadedUsers, today);
        loadedUsers.forEach((user) => {
          if (!loadedVisits[user.userCode]) {
            loadedVisits[user.userCode] = initialVisits[user.userCode];
          }
        });

        setVisits(loadedVisits);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load attendance data:', error);
        openToast('データの読み込みに失敗しました', 'error');
        setLoading(false);
      }
    };

    loadData();
  }, [spClient, today]);

  // Save visit to SharePoint
  const saveVisitByMap = useCallback(async (userCode: string, sourceVisits: Record<string, AttendanceVisit>) => {
    if (!spClient) return; // Demo mode: no save

    const visit = sourceVisits[userCode];
    const user = users.find(u => u.userCode === userCode);
    if (!visit || !user) return;

    const key = `${userCode}|${today}`;
    const item: AttendanceDailyItem = {
      Key: key,
      UserCode: userCode,
      RecordDate: today,
      Status: visit.status,
      CheckInAt: visit.checkInAt ?? null,
      CheckOutAt: visit.checkOutAt ?? null,
      CntAttendIn: visit.cntAttendIn ?? 0,
      CntAttendOut: visit.cntAttendOut ?? 0,
      TransportTo: !!visit.transportTo,
      TransportFrom: !!visit.transportFrom,
      ProvidedMinutes: visit.providedMinutes ?? null,
      IsEarlyLeave: !!visit.isEarlyLeave,
      UserConfirmedAt: visit.userConfirmedAt ?? null,
      AbsentMorningContacted: !!visit.absentMorningContacted,
      AbsentMorningMethod: visit.absentMorningMethod ?? '',
      EveningChecked: !!visit.eveningChecked,
      EveningNote: visit.eveningNote ?? '',
      IsAbsenceAddonClaimable: !!visit.isAbsenceAddonClaimable,
    };

    await upsertDailyByKey(spClient, item);
  }, [spClient, users, today]);

  const visitsRef = useRef(visits);
  useEffect(() => {
    visitsRef.current = visits;
  }, [visits]);

  const persistVisits = useCallback(
    async (nextVisits: Record<string, AttendanceVisit>) => {
      const prevVisits = visitsRef.current;
      const changedUserCodes = Object.keys(nextVisits).filter(
        (userCode) => nextVisits[userCode] !== prevVisits[userCode],
      );

      if (!changedUserCodes.length) return;

      for (const userCode of changedUserCodes) {
        await saveVisitByMap(userCode, nextVisits);
      }
    },
    [saveVisitByMap],
  );

  // 乖離件数（サマリー用）
  const discrepancyCount = useMemo(
    () => getDiscrepancyCount(visits, users, DISCREPANCY_THRESHOLD),
    [visits, users]
  );

  const summary = useMemo(() => {
  const values = Object.values(visits) as AttendanceVisit[];
    const attendIn = values.filter((visit) => visit.cntAttendIn === 1).length;
    const attendOut = values.filter((visit) => visit.cntAttendOut === 1).length;
    const transportTo = values.filter((visit) => visit.transportTo).length;
    const transportFrom = values.filter((visit) => visit.transportFrom).length;
    const absenceAddon = values.filter((visit) => visit.isAbsenceAddonClaimable).length;
    const warnDiff = values.filter((v) => {
      const provided = v.providedMinutes ?? 0;
      const u = users.find(u => u.userCode === v.userCode);
  return provided > 0 && u && provided < u.standardMinutes * DISCREPANCY_THRESHOLD;
    }).length;
    return { attendIn, attendOut, transportTo, transportFrom, absenceAddon, warnDiff };
  }, [visits, users]);

  // フィルタリングされたユーザーリスト
  const filteredUsers = useMemo(() => {
    let filtered = users;

    // 検索フィルタ
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        user.userName.toLowerCase().includes(query) ||
        user.userCode.toLowerCase().includes(query)
      );
    }

    // ステータスフィルタ
    if (filterStatus !== 'all') {
      filtered = filtered.filter(user => {
        const visit = visits[user.userCode];
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
      });
    }

    return filtered;
  }, [users, searchQuery, filterStatus, visits]);

  const attendanceActions = useAttendanceActions<Record<string, AttendanceVisit>>({
    setVisits,
    persist: persistVisits,
    buildNextVisits: ({ prev, userId, type, nowIso }) => {
      const current = prev[userId];
      if (!current) return prev;

      if (type === 'checkIn') {
        if (current.status === '当日欠席' || current.cntAttendIn === 1) {
          return prev;
        }

        return {
          ...prev,
          [userId]: {
            ...current,
            status: '通所中',
            checkInAt: nowIso,
            cntAttendIn: 1,
          },
        };
      }

      if (type === 'checkOut') {
        if (!canCheckOut(current)) {
          return prev;
        }

        const nowDate = new Date(nowIso);
        return {
          ...prev,
          [userId]: {
            ...current,
            status: '退所済',
            checkOutAt: nowIso,
            cntAttendOut: 1,
            isEarlyLeave: isBeforeCloseTime(nowDate),
            providedMinutes: diffMinutes(current.checkInAt, nowIso),
          },
        };
      }

      if (type === 'markAbsent') {
        return {
          ...prev,
          [userId]: {
            ...current,
            status: '当日欠席',
          },
        };
      }

      return {
        ...prev,
        [userId]: {
          ...current,
          status: '未',
          checkInAt: undefined,
          checkOutAt: undefined,
          cntAttendIn: 0,
          cntAttendOut: 0,
          providedMinutes: 0,
          isEarlyLeave: false,
        },
      };
    },
  });

  const showAttendanceError = useCallback((error: unknown) => {
    if (isAttendanceError(error)) {
      openToast(ATTENDANCE_ERROR_MESSAGES[error.code], 'error');
      return;
    }
    openToast(ATTENDANCE_ERROR_MESSAGES.UNKNOWN, 'error');
  }, [openToast]);

  const applyAndPersist = attendanceActions.applyAndPersist;

  const handleCheckIn = useCallback(async (user: AttendanceUser) => {
    const current = visits[user.userCode];
    if (!current || current.status === '当日欠席' || current.cntAttendIn === 1) return;

    setUndo({
      userCode: user.userCode,
      prevVisit: { ...current },
      message: `${user.userName}さんの通所を取り消しますか？`,
    });

    try {
      await attendanceActions.checkIn(user.userCode);
      openToast(`${user.userName}さんが通所しました`, 'success', { keepUndo: true });
    } catch (error) {
      showAttendanceError(error);
    }
  }, [attendanceActions, showAttendanceError, visits]);

  const handleCheckOut = useCallback(async (user: AttendanceUser) => {
    const current = visits[user.userCode];
    if (!canCheckOut(current)) return;

    setUndo({
      userCode: user.userCode,
      prevVisit: { ...current },
      message: `${user.userName}さんの退所を取り消しますか？`,
    });

    try {
      await attendanceActions.checkOut(user.userCode);
      openToast(`${user.userName}さんが退所しました`, 'success', { keepUndo: true });
    } catch (error) {
      showAttendanceError(error);
    }
  }, [attendanceActions, showAttendanceError, visits]);

  const openAbsenceDialog = (user: AttendanceUser) => {
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
  };

  const closeAbsenceDialog = () => setAbsenceDialog(null);

  const handleAbsenceSave = async () => {
    if (!absenceDialog) return;
    const { user, visit, morningContacted, morningMethod, eveningChecked, eveningNote } =
      absenceDialog;
    const eligible = computeAbsenceEligibility(
      user,
      morningContacted,
      eveningChecked,
      ABSENCE_MONTHLY_LIMIT
    );

    try {
      await applyAndPersist(
        (prev) => ({
          ...prev,
          [user.userCode]: buildAbsentVisit(visit, {
            morningContacted,
            morningMethod,
            eveningChecked,
            eveningNote,
            eligible,
          }),
        }),
        `absence:${user.userCode}`,
      );

      if (eligible) {
        setUsers((prev) =>
          prev.map((entry) =>
            entry.userCode === user.userCode
              ? { ...entry, absenceClaimedThisMonth: entry.absenceClaimedThisMonth + 1 }
              : entry
          )
        );
        openToast(`${user.userName}さんの欠席を記録しました（加算対象）`, 'success');
      } else {
        openToast(`${user.userName}さんの欠席を記録しました（加算対象外）`, 'warning');
      }
      closeAbsenceDialog();
    } catch (error) {
      showAttendanceError(error);
    }
  };

  return (
    <FullScreenDailyDialogPage
      title="通所（出欠）"
      backTo="/dashboard"
      testId="daily-attendance-page"
    >
      <Container maxWidth="lg" sx={{ py: 4 }} data-testid={dataTestId ?? TESTIDS['attendance-page']}>
        {/* Snackbar for save/failure notifications */}
        {snackbar && (
          <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
            <Alert
              onClose={handleSnackbarClose}
              severity={snackbar.severity}
              sx={{ width: '100%' }}
              data-testid="toast"
              action={
                undo ? (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => {
                      setVisits((prev) => ({
                        ...prev,
                        [undo.userCode]: undo.prevVisit,
                      }));
                      setUndo(null);
                      openToast('取り消しました', 'info');
                    }}
                  >
                    取り消し
                  </Button>
                ) : null
              }
            >
              {snackbar.message}
            </Alert>
          </Snackbar>
        )}

        {loading ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 8 }}>
            <Typography variant="h6" color="text.secondary">
              データを読み込んでいます...
            </Typography>
          </Stack>
        ) : (
          <>
            <Stack spacing={3}>
              <Stack spacing={1}>
                <Typography variant="h3" component="h1" data-testid="heading-attendance">
                  通所実績入力（サンプル）
                </Typography>
                <Typography color="text.secondary">
                  押したら即反映する想定で、通所・送迎・欠席加算の状態変化をタブレットで確認できます。
                </Typography>
              </Stack>

              <Card>
                <CardContent>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
                    <Chip icon={<AttendanceIcon />} color="primary" label={`通所 ${summary.attendIn}`} />
                    <Chip icon={<CheckIcon />} color="success" label={`退所 ${summary.attendOut}`} />
                    <Chip icon={<BusIcon />} color="secondary" label={`送迎 行き ${summary.transportTo}`} />
                    <Chip icon={<BusIcon />} color="secondary" label={`送迎 帰り ${summary.transportFrom}`} />
                    <Chip icon={<AbsenceIcon />} color="warning" label={`欠席加算 ${summary.absenceAddon}`} />
                    <Chip label={`乖離あり ${discrepancyCount}`} variant="outlined" data-testid="chip-discrepancy" />
                  </Stack>
                </CardContent>
              </Card>

        {/* 検索・フィルタ機能 */}
        <Card>
          <CardContent>
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

              {searchQuery && (
                <Typography variant="body2" color="text.secondary">
                  検索結果: {filteredUsers.length}件
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={2}>
          {filteredUsers.map((user) => {
            const visit = visits[user.userCode];
            const disableAbsence = visit.status !== '未' && visit.status !== '当日欠席';
            const rangeText = visit.checkInAt && visit.checkOutAt
              ? `${formatTime(visit.checkInAt)}〜${formatTime(visit.checkOutAt)}`
              : '—';

            // ★ 追加: クエリで指定された利用者かどうか
            const isFocused = targetUserIdFromQuery === user.userCode;

            return (
              <Card
                key={user.userCode}
                data-testid={`card-${user.userCode}`}
                sx={{
                  border: '2px solid',
                  borderColor: isFocused ? 'primary.main' : 'divider',
                  boxShadow: isFocused ? 4 : 1,
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                }}
              >
                <CardContent sx={{ py: 1.25 }}>
                  <Stack spacing={2}>
                    <AttendanceRow
                      user={{
                        id: user.userCode,
                        name: `${user.userName}（${user.userCode}）`,
                        needsTransport: user.isTransportTarget,
                      }}
                      visit={{
                        status: visit.status,
                        checkInAtText: visit.checkInAt ? formatTime(visit.checkInAt) : undefined,
                        checkOutAtText: visit.checkOutAt ? formatTime(visit.checkOutAt) : undefined,
                        rangeText,
                      }}
                      canAbsence={!disableAbsence}
                      onCheckIn={() => handleCheckIn(user)}
                      onCheckOut={() => handleCheckOut(user)}
                      onAbsence={() => {
                        if (!disableAbsence) {
                          openAbsenceDialog(user);
                        }
                      }}
                      onDetail={() => {
                        setDetailDrawer({ user, visit });
                      }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Stack>

      <Dialog open={Boolean(absenceDialog)} onClose={closeAbsenceDialog} fullWidth maxWidth="sm">
        <DialogTitle>欠席対応記録</DialogTitle>
        {absenceDialog && (
          <DialogContent dividers>
            <Stack spacing={2}>
              <Typography>
                対象: {absenceDialog.user.userName}（{absenceDialog.user.userCode}）
              </Typography>
              <Alert severity="info" icon={<AbsenceIcon />}>
                当月欠席加算確定 {absenceDialog.user.absenceClaimedThisMonth} 件 / {ABSENCE_MONTHLY_LIMIT} 件
              </Alert>
              <FormControlLabel
                control={
                  <Switch
                    checked={absenceDialog.morningContacted}
                    onChange={(_event, checked) =>
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
                    onChange={(_event, checked) =>
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
                />
              )}
            </Stack>
          </DialogContent>
        )}
        <DialogActions
          sx={{
            position: 'sticky',
            bottom: 0,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            p: 1,
            zIndex: 1,
          }}
        >
          <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
            <Button
              onClick={closeAbsenceDialog}
              variant="outlined"
              size="large"
              fullWidth
              sx={{ minHeight: 48 }}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleAbsenceSave}
              variant="contained"
              size="large"
              fullWidth
              sx={{ minHeight: 48 }}
              disabled={
                !absenceDialog ||
                (absenceDialog.morningContacted && absenceDialog.morningMethod === '')
              }
            >
              保存
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* 詳細Drawer */}
      <AttendanceDetailDrawer
        open={Boolean(detailDrawer)}
        user={
          detailDrawer
            ? {
                id: detailDrawer.user.userCode,
                name: `${detailDrawer.user.userName}（${detailDrawer.user.userCode}）`,
              }
            : null
        }
        visit={
          detailDrawer
            ? {
                status: detailDrawer.visit.status,
                transportTo: detailDrawer.visit.transportTo,
                transportFrom: detailDrawer.visit.transportFrom,
                actualService: detailDrawer.visit.providedMinutes
                  ? `${detailDrawer.visit.providedMinutes}分`
                  : undefined,
                billing: undefined, // TODO: 算定分数フィールドが実装されたら追加
                isUserConfirmed: Boolean(detailDrawer.visit.userConfirmedAt),
                absentMorningContacted: detailDrawer.visit.absentMorningContacted,
                eveningChecked: detailDrawer.visit.eveningChecked,
                isAbsenceAddonClaimable: detailDrawer.visit.isAbsenceAddonClaimable,
                absenceLimitReached:
                  detailDrawer.user.absenceClaimedThisMonth >= ABSENCE_MONTHLY_LIMIT,
              }
            : null
        }
        onClose={() => setDetailDrawer(null)}
        onTransportToChange={(value) => {
          if (!detailDrawer) return;
          let nextVisit: AttendanceVisit | null = null;
          void applyAndPersist((prev) => {
            const current = prev[detailDrawer.user.userCode];
            if (!current) return prev;
            nextVisit = { ...current, transportTo: value };
            return { ...prev, [detailDrawer.user.userCode]: nextVisit };
          }, `drawer:${detailDrawer.user.userCode}:transportTo`).then(() => {
            if (!nextVisit) return;
            setDetailDrawer((prev) => (prev ? { ...prev, visit: nextVisit! } : prev));
          });
        }}
        onTransportFromChange={(value) => {
          if (!detailDrawer) return;
          let nextVisit: AttendanceVisit | null = null;
          void applyAndPersist((prev) => {
            const current = prev[detailDrawer.user.userCode];
            if (!current) return prev;
            nextVisit = { ...current, transportFrom: value };
            return { ...prev, [detailDrawer.user.userCode]: nextVisit };
          }, `drawer:${detailDrawer.user.userCode}:transportFrom`).then(() => {
            if (!nextVisit) return;
            setDetailDrawer((prev) => (prev ? { ...prev, visit: nextVisit! } : prev));
          });
        }}
        onUserConfirm={() => {
          if (!detailDrawer) return;
          let nextVisit: AttendanceVisit | null = null;
          const currentlyConfirmed = Boolean(detailDrawer.visit.userConfirmedAt);
          const newValue = currentlyConfirmed ? undefined : new Date().toISOString();
          void applyAndPersist((prev) => {
            const current = prev[detailDrawer.user.userCode];
            if (!current) return prev;
            nextVisit = { ...current, userConfirmedAt: newValue };
            return { ...prev, [detailDrawer.user.userCode]: nextVisit };
          }, `drawer:${detailDrawer.user.userCode}:confirm`).then(() => {
            if (!nextVisit) return;
            setDetailDrawer((prev) => (prev ? { ...prev, visit: nextVisit! } : prev));
            openToast(newValue ? '利用者確認を完了しました' : '利用者確認を解除しました', 'success');
          });
        }}
        onReset={() => {
          if (!detailDrawer) return;
          if (
            !window.confirm(
              `${detailDrawer.user.userName}さんの打刻を全てリセットします。この操作は取り消せません。よろしいですか？`
            )
          ) {
            return;
          }
          let nextVisit: AttendanceVisit | null = null;
          void applyAndPersist((prev) => {
            const current = prev[detailDrawer.user.userCode];
            if (!current) return prev;
            const base = buildInitialVisits([detailDrawer.user], today)[detailDrawer.user.userCode];
            nextVisit = {
              ...base,
              status: current.status,
              absentMorningContacted: current.absentMorningContacted,
              absentMorningMethod: current.absentMorningMethod,
              eveningChecked: current.eveningChecked,
              eveningNote: current.eveningNote,
              isAbsenceAddonClaimable: current.isAbsenceAddonClaimable,
            };
            return { ...prev, [detailDrawer.user.userCode]: nextVisit };
          }, `drawer:${detailDrawer.user.userCode}:reset`).then(() => {
            setDetailDrawer(null);
            openToast('打刻をリセットしました', 'info');
          });
        }}
        onViewHandoff={() => {
          if (!detailDrawer) return;
          navigate(`/handoff-timeline?userId=${detailDrawer.user.userCode}`);
        }}
      />
      </>
    )}
      </Container>
    </FullScreenDailyDialogPage>
  );
};

export default AttendanceRecordPage;
