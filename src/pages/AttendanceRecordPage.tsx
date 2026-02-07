/* eslint-disable boundaries/element-types */
import { ABSENCE_MONTHLY_LIMIT, DISCREPANCY_THRESHOLD } from '@/config/serviceRecords';
import { getFlag } from '@/env';
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
import { useAuth } from '@/auth/useAuth';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { warmDataEntryComponents } from '@/mui/warm';
import { TESTIDS } from '@/testids';
import TransportIcon from '@mui/icons-material/AirportShuttle';
import AttendanceIcon from '@mui/icons-material/AssignmentInd';
import AbsenceIcon from '@mui/icons-material/CancelScheduleSend';
import CheckIcon from '@mui/icons-material/CheckCircle';
import BusIcon from '@mui/icons-material/DirectionsBus';
import ResetIcon from '@mui/icons-material/Replay';
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
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

type FilterStatus = 'all' | 'pending' | 'completed' | 'absent';

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

  const openToast = (message: string, severity: ToastSeverity) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = () => {
    setSnackbar((prev) => (prev ? { ...prev, open: false } : prev));
  };
  
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AttendanceUser[]>(initialUsers);
  const [visits, setVisits] = useState<Record<string, AttendanceVisit>>(() =>
    buildInitialVisits(initialUsers, today)
  );
  const [absenceDialog, setAbsenceDialog] = useState<AbsenceDialogState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

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
  const saveVisit = useCallback(async (userCode: string) => {
    if (!spClient) return; // Demo mode: no save

    const visit = visits[userCode];
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

    try {
      await upsertDailyByKey(spClient, item);
    } catch (error) {
      console.error('Failed to save visit:', error);
      openToast('保存に失敗しました', 'error');
    }
  }, [spClient, visits, users, today]);

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

  const handleCheckIn = useCallback(async (user: AttendanceUser) => {
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
    
    // Save to SharePoint after state update
    await saveVisit(user.userCode);
  }, [saveVisit]);

  const handleCheckOut = useCallback(async (user: AttendanceUser) => {
    setVisits((prev) => {
      const current = prev[user.userCode];
      if (!canCheckOut(current)) {
        return prev;
      }
      const now = new Date();
      return {
        ...prev,
        [user.userCode]: {
          ...current,
          checkOutAt: now.toISOString(),
          cntAttendOut: 1,
          isEarlyLeave: isBeforeCloseTime(now),
          providedMinutes: diffMinutes(current.checkInAt, now.toISOString()),
        }
      };
    });
    openToast(`${user.userName}さんが退所しました`, 'success');
    
    // Save to SharePoint after state update
    await saveVisit(user.userCode);
  }, [saveVisit]);

  const handleTransportToggle = async (user: AttendanceUser, field: 'transportTo' | 'transportFrom') => {
    setVisits((prev) => {
      const current = prev[user.userCode];
      if (!current || !user.isTransportTarget) {
        return prev;
      }
      return {
        ...prev,
        [user.userCode]: {
          ...current,
          [field]: !current[field]
        }
      };
    });
    
    // Save to SharePoint after state update
    await saveVisit(user.userCode);
  };

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
      openToast(`${user.userName}さんの欠席を記録しました（加算対象）`, 'success');
    } else {
      openToast(`${user.userName}さんの欠席を記録しました（加算対象外）`, 'warning');
    }
    closeAbsenceDialog();
    
    // Save to SharePoint after state update
    await saveVisit(user.userCode);
  };

  const handleReset = async (user: AttendanceUser) => {
    setVisits((prev) => ({
      ...prev,
      [user.userCode]: buildInitialVisits([user], today)[user.userCode]
    }));
    
    // Save to SharePoint after state update
    await saveVisit(user.userCode);
  };

  return (
  <Container maxWidth="lg" sx={{ py: 4 }} data-testid={dataTestId ?? TESTIDS['attendance-page']}>
    {/* Snackbar for save/failure notifications */}
    {snackbar && (
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }} data-testid="toast">
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
            const disableCheckIn = visit.status === '当日欠席' || visit.cntAttendIn === 1;
            const disableCheckOut = !canCheckOut(visit);
            const disableAbsence = visit.status !== '未' && visit.status !== '当日欠席';
            const absenceLimitReached = user.absenceClaimedThisMonth >= ABSENCE_MONTHLY_LIMIT;

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
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                      <Stack flex={1}>
                        <Typography variant="h6">
                          {user.userName}{' '}
                          <Typography component="span" variant="body2" color="text.secondary">
                            ({user.userCode})
                          </Typography>
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                          <Chip
                            label={`ステータス: ${visit.status}`}
                            color={
                              visit.status === '退所済' ? 'success' :
                              visit.status === '当日欠席' ? 'error' :
                              visit.status === '通所中' ? 'primary' : 'default'
                            }
                            variant={visit.status === '未' ? 'outlined' : 'filled'}
                          />
                          <Chip label={`通所 ${formatTime(visit.checkInAt)}`} size="small" />
                          <Chip label={`退所 ${formatTime(visit.checkOutAt)}`} size="small" />
                          <Chip label={`実提供 ${visit.providedMinutes ?? 0}分`} size="small" />
                          <Chip label={`算定 ${user.standardMinutes}分`} variant="outlined" size="small" />
                          { (visit.providedMinutes ?? 0) > 0 && visit.providedMinutes! < user.standardMinutes * DISCREPANCY_THRESHOLD && (
                            <Chip label="乖離あり（備考推奨）" color="warning" variant="outlined" size="small" />
                          )}
                          {visit.isEarlyLeave && (
                            <Chip label="早退" color="warning" variant="outlined" size="small" />
                          )}
                          {visit.isAbsenceAddonClaimable && (
                            <Chip label="欠席加算対象" color="warning" size="small" />
                          )}
                          {visit.userConfirmedAt && (
                            <Chip
                              label={`確認 ${new Date(visit.userConfirmedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`}
                              color="success"
                              size="small"
                            />
                          )}
                        </Stack>
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title={disableCheckIn ? '通所済みまたは欠席日により実行不可' : ''}>
                          <span>
                            <Button
                              variant="contained"
                              onClick={() => handleCheckIn(user)}
                              disabled={disableCheckIn}
                              data-testid={`btn-checkin-${user.userCode}`}
                            >
                              通所
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title={disableCheckOut ? '通所後に退所できます' : ''}>
                          <span>
                            <Button
                              variant="contained"
                              color="success"
                              onClick={() => handleCheckOut(user)}
                              disabled={disableCheckOut}
                              data-testid={`btn-checkout-${user.userCode}`}
                            >
                              退所
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title={disableAbsence ? '通所操作後は欠席へ切り替え不可' : ''}>
                          <span>
                            <Button
                              variant="outlined"
                              color="warning"
                              onClick={() => openAbsenceDialog(user)}
                              disabled={disableAbsence}
                              startIcon={<AbsenceIcon />}
                              data-testid={`btn-absence-${user.userCode}`}
                              onMouseEnter={() => {
                                // ダイアログ関連コンポーネントの事前読み込み
                                // ホバー時に読み込んでクリック時の応答性を向上
                                if (!disableAbsence) {
                                  warmDataEntryComponents();
                                }
                              }}
                            >
                              欠席
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip
                          title={
                            visit.userConfirmedAt
                              ? `確認済: ${new Date(visit.userConfirmedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`
                              : (visit.status === '退所済' || visit.status === '当日欠席'
                                ? '確認できます'
                                : '退所または欠席確定後に確認可能')
                          }
                        >
                          <span>
                            {(() => {
                              // --- E2E専用confirm強制有効化（src/env.tsのgetFlagで判定） ---
                              const E2E_UNLOCK_CONFIRM = getFlag('VITE_E2E_UNLOCK_CONFIRM');
                              const disabled = !!visit.userConfirmedAt || (visit.status !== '退所済' && visit.status !== '当日欠席');
                              const disabledFinal = E2E_UNLOCK_CONFIRM ? false : disabled;
                              if (typeof window !== 'undefined') {
                                type ConfirmDebugPayload = {
                                  userCode: string;
                                  disabled: boolean;
                                  disabledFinal: boolean;
                                  reasons: {
                                    userConfirmedAt: boolean;
                                    status: typeof visit.status;
                                    E2E_UNLOCK_CONFIRM: boolean;
                                  };
                                };
                                const debugWindow = window as typeof window & { __CONFIRM_DEBUG?: ConfirmDebugPayload };
                                debugWindow.__CONFIRM_DEBUG = {
                                  userCode: user.userCode,
                                  disabled,
                                  disabledFinal,
                                  reasons: {
                                    userConfirmedAt: !!visit.userConfirmedAt,
                                    status: visit.status,
                                    E2E_UNLOCK_CONFIRM,
                                  },
                                };
                              }
                              return (
                                <Button
                                  variant="outlined"
                                  color="success"
                                  onClick={async () => {
                                    setVisits(prev => ({
                                      ...prev,
                                      [user.userCode]: {
                                        ...prev[user.userCode],
                                        userConfirmedAt: prev[user.userCode].userConfirmedAt ?? new Date().toISOString()
                                      }
                                    }));
                                    openToast('保存しました', 'success');
                                    
                                    // Save to SharePoint after state update
                                    await saveVisit(user.userCode);
                                  }}
                                  disabled={disabledFinal}
                                  startIcon={<CheckIcon />}
                                  data-testid={`btn-confirm-${user.userCode}`}
                                >
                                  利用者確認
                                </Button>
                              );
                            })()}
                          </span>
                        </Tooltip>
                        <Tooltip title="初期状態へ戻します">
                          <span>
                            <Button
                              variant="text"
                              color="inherit"
                              onClick={() => handleReset(user)}
                              startIcon={<ResetIcon />}
                              data-testid={`btn-reset-${user.userCode}`}
                            >
                              リセット
                            </Button>
                          </span>
                        </Tooltip>

                        {/* ★ 追加: 支援記録（ケース記録）へのクロスリンク */}
                        <Tooltip title="今日の支援記録（ケース記録）（/daily/activity）を開きます">
                          <span>
                            <Button
                              variant="text"
                              color="primary"
                              size="small"
                              onClick={() => {
                                navigate(`/daily/activity?userId=${user.userCode}&date=${today}`);
                              }}
                              data-testid={`btn-activity-${user.userCode}`}
                            >
                              支援記録（ケース記録）を見る
                            </Button>
                          </span>
                        </Tooltip>

                        {/* ★ 追加: 申し送りタイムラインへのクロスリンク */}
                        <Tooltip title="この利用者の申し送りタイムライン（/handoff-timeline）を開きます">
                          <span>
                            <Button
                              variant="text"
                              color="secondary"
                              size="small"
                              onClick={() => {
                                navigate('/handoff-timeline', {
                                  state: {
                                    dayScope: 'today',
                                    timeFilter: 'all',
                                    userId: user.userCode,
                                    date: today,
                                    focus: true,
                                  },
                                });
                              }}
                              data-testid={`btn-handoff-${user.userCode}`}
                            >
                              申し送りを見る
                            </Button>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>

                    {user.isTransportTarget ? (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={visit.transportTo}
                              onChange={() => handleTransportToggle(user, 'transportTo')}
                            />
                          }
                          label="送迎（行き）"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={visit.transportFrom}
                              onChange={() => handleTransportToggle(user, 'transportFrom')}
                            />
                          }
                          label="送迎（帰り）"
                        />
                      </Stack>
                    ) : (
                      <Alert severity="info" icon={<TransportIcon />}>
                        送迎対象外です
                      </Alert>
                    )}

                    {visit.status === '当日欠席' && (
                      <Alert severity={visit.isAbsenceAddonClaimable ? 'warning' : 'info'}>
                        欠席対応: 朝連絡 {visit.absentMorningContacted ? '済' : '未'} / 夕方様子{' '}
                        {visit.eveningChecked ? '済' : '未'}{' '}
                        {absenceLimitReached && visit.isAbsenceAddonClaimable === false
                          ? '（上限超過のため請求対象外）'
                          : ''}
                      </Alert>
                    )}
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
      </>
    )}
  </Container>
  );
};

export default AttendanceRecordPage;
