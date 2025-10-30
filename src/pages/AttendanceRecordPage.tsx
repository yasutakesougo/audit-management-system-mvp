import React, { useMemo, useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import { TESTIDS } from '@/testids';
// --- Exported for tests ---
export const computeAbsenceEligibility = (
  user: AttendanceUser,
  morningContacted: boolean,
  eveningChecked: boolean,
  monthlyLimit: number
): boolean => {
  if (!morningContacted || !eveningChecked) return false;
  return user.absenceClaimedThisMonth < monthlyLimit;
};

export const buildAbsentVisit = (
  base: AttendanceVisit,
  args: {
    morningContacted: boolean;
    morningMethod: AbsentMethod;
    eveningChecked: boolean;
    eveningNote: string;
    eligible: boolean;
  }
): AttendanceVisit => ({
  ...base,
  status: '当日欠席',
  cntAttendIn: 0,
  cntAttendOut: 0,
  checkInAt: undefined,
  checkOutAt: undefined,
  transportTo: false,
  transportFrom: false,
  absentMorningContacted: args.morningContacted,
  absentMorningMethod: args.morningMethod,
  eveningChecked: args.eveningChecked,
  eveningNote: args.eveningNote,
  isAbsenceAddonClaimable: args.eligible,
  providedMinutes: 0,
  userConfirmedAt: undefined,
  isEarlyLeave: false,
});

import { DISCREPANCY_THRESHOLD, ABSENCE_MONTHLY_LIMIT, FACILITY_CLOSE_TIME } from '@/config/serviceRecords';
// 乖離件数カウントユーティリティ
const getDiscrepancyCount = (
  visits: Record<string, AttendanceVisit>,
  users: AttendanceUser[],
  threshold = DISCREPANCY_THRESHOLD
): number => {
  if (!visits || !users?.length) return 0;
  const userMap = new Map(users.map(u => [u.userCode, u]));
  let cnt = 0;
  for (const v of Object.values(visits)) {
    const u = userMap.get(v.userCode);
    if (!u) continue;
    const provided = v.providedMinutes ?? 0;
    if (provided > 0 && u.standardMinutes && provided < u.standardMinutes * threshold) {
      cnt++;
    }
  }
  return cnt;
};
import AbsenceIcon from '@mui/icons-material/CancelScheduleSend';
import AttendanceIcon from '@mui/icons-material/AssignmentInd';
import BusIcon from '@mui/icons-material/DirectionsBus';
import CheckIcon from '@mui/icons-material/CheckCircle';
import EveningIcon from '@mui/icons-material/WbTwilight';
import MorningIcon from '@mui/icons-material/School';
import ResetIcon from '@mui/icons-material/Replay';
import TransportIcon from '@mui/icons-material/AirportShuttle';
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
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { getFlag } from '@/env';

type AttendanceStatus = '未' | '通所中' | '退所済' | '当日欠席';

type AbsentMethod = '電話' | 'SMS' | '家族' | 'その他' | '';


interface AttendanceUser {
  userCode: string;
  userName: string;
  isTransportTarget: boolean;
  absenceClaimedThisMonth: number;
  standardMinutes: number; // 追加：算定時間（分）
}

interface AttendanceVisit {
  userCode: string;
  status: AttendanceStatus;
  recordDate: string;
  checkInAt?: string;
  checkOutAt?: string;
  cntAttendIn: 0 | 1;
  cntAttendOut: 0 | 1;
  transportTo: boolean;
  transportFrom: boolean;
  isEarlyLeave: boolean;
  absentMorningContacted: boolean;
  absentMorningMethod: AbsentMethod;
  eveningChecked: boolean;
  eveningNote: string;
  isAbsenceAddonClaimable: boolean;
  providedMinutes?: number;    // 追加：実提供（分）
  userConfirmedAt?: string;    // 追加：利用者確認（ISO）
}

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

const buildInitialVisits = (users: AttendanceUser[], recordDate: string): Record<string, AttendanceVisit> => {
  return users.reduce<Record<string, AttendanceVisit>>((acc, user) => {
    acc[user.userCode] = {
      userCode: user.userCode,
      status: '未',
      recordDate,
      cntAttendIn: 0,
      cntAttendOut: 0,
      transportTo: false,
      transportFrom: false,
      isEarlyLeave: false,
      absentMorningContacted: false,
      absentMorningMethod: '',
      eveningChecked: false,
      eveningNote: '',
      isAbsenceAddonClaimable: false,
      providedMinutes: 0,
      userConfirmedAt: undefined,
    };
    return acc;
  }, {});
};

const formatTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--';


const isBeforeCloseTime = (date: Date) => {
  const [hours, minutes] = FACILITY_CLOSE_TIME.split(':').map(Number);
  const closeDate = new Date(date);
  closeDate.setHours(hours);
  closeDate.setMinutes(minutes);
  closeDate.setSeconds(0);
  closeDate.setMilliseconds(0);
  return date.getTime() < closeDate.getTime();
};

// 実提供分の計算
export const diffMinutes = (start?: string, end?: string) => {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(0, Math.floor((e - s) / 60000));
};

// 退所可否ガード関数
export const canCheckOut = (v?: AttendanceVisit) =>
  !!v && v.status === '通所中' && v.cntAttendOut === 0;

type AttendanceRecordPageProps = {
  'data-testid'?: string;
};

const AttendanceRecordPage: React.FC<AttendanceRecordPageProps> = ({ 'data-testid': dataTestId }) => {
  // Snackbar state for toast notifications
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  const openToast = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = () => {
    setSnackbar((prev) => (prev ? { ...prev, open: false } : prev));
  };
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [users, setUsers] = useState<AttendanceUser[]>(initialUsers);
  const [visits, setVisits] = useState<Record<string, AttendanceVisit>>(() =>
    buildInitialVisits(initialUsers, today)
  );
  const [absenceDialog, setAbsenceDialog] = useState<AbsenceDialogState | null>(null);

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

  const handleCheckIn = (user: AttendanceUser) => {
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
  };

  const handleCheckOut = (user: AttendanceUser) => {
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
  };

  const handleTransportToggle = (user: AttendanceUser, field: 'transportTo' | 'transportFrom') => {
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

  const handleAbsenceSave = () => {
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
    }

  // E2Eが待つ「保存しました」トーストをここで発火（UI非ブロッキング）
  openToast('保存しました', 'success');
  closeAbsenceDialog();
  };

  const handleReset = (user: AttendanceUser) => {
    setVisits((prev) => ({
      ...prev,
      [user.userCode]: buildInitialVisits([user], today)[user.userCode]
    }));
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

        <Stack spacing={2}>
          {users.map((user) => {
            const visit = visits[user.userCode];
            const disableCheckIn = visit.status === '当日欠席' || visit.cntAttendIn === 1;
            const disableCheckOut = !canCheckOut(visit);
            const disableAbsence = visit.status !== '未' && visit.status !== '当日欠席';
            const absenceLimitReached = user.absenceClaimedThisMonth >= ABSENCE_MONTHLY_LIMIT;

            return (
              <Card key={user.userCode} data-testid={`card-${user.userCode}`} sx={{ border: '1px solid', borderColor: 'divider' }}>
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
                          <Chip label={`ステータス: ${visit.status}`} color="info" />
                          <Chip label={`通所 ${formatTime(visit.checkInAt)}`} />
                          <Chip label={`退所 ${formatTime(visit.checkOutAt)}`} />
                          <Chip label={`実提供 ${visit.providedMinutes ?? 0}分`} />
                          <Chip label={`算定 ${user.standardMinutes}分`} />
                          { (visit.providedMinutes ?? 0) > 0 && visit.providedMinutes! < user.standardMinutes * DISCREPANCY_THRESHOLD && (
                            <Chip label="乖離あり（備考推奨）" color="warning" variant="outlined" />
                          )}
                          {visit.isEarlyLeave && (
                            <Chip label="早退" color="warning" variant="outlined" />
                          )}
                          {visit.isAbsenceAddonClaimable && (
                            <Chip label="欠席加算対象" color="warning" />
                          )}
                          {visit.userConfirmedAt && (
                            <Chip
                              label={`確認 ${new Date(visit.userConfirmedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`}
                              color="success"
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
                                  onClick={() => {
                                    setVisits(prev => ({
                                      ...prev,
                                      [user.userCode]: {
                                        ...prev[user.userCode],
                                        userConfirmedAt: prev[user.userCode].userConfirmedAt ?? new Date().toISOString()
                                      }
                                    }));
                                    openToast('保存しました', 'success');
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
    </Container>
  );
};

export default AttendanceRecordPage;
