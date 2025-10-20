import {
    CancelScheduleSend as AbsenceIcon,
    AssignmentInd as AttendanceIcon,
    DirectionsBus as BusIcon,
    CheckCircle as CheckIcon,
    WbTwilight as EveningIcon,
    School as MorningIcon,
    Replay as ResetIcon,
    AirportShuttle as TransportIcon
} from '@mui/icons-material';
import {
    Alert,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import React, { useMemo, useState } from 'react';

type AttendanceStatus = '未' | '通所中' | '退所済' | '当日欠席';

type AbsentMethod = '電話' | 'SMS' | '家族' | 'その他' | '';

interface AttendanceUser {
  userCode: string;
  userName: string;
  isTransportTarget: boolean;
  absenceClaimedThisMonth: number;
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
}

interface AbsenceDialogState {
  user: AttendanceUser;
  visit: AttendanceVisit;
  morningContacted: boolean;
  morningMethod: AbsentMethod;
  eveningChecked: boolean;
  eveningNote: string;
}

const FACILITY_CLOSE_TIME = '16:00';

const initialUsers: AttendanceUser[] = [
  { userCode: 'I001', userName: '田中太郎', isTransportTarget: true, absenceClaimedThisMonth: 2 },
  { userCode: 'I002', userName: '佐藤花子', isTransportTarget: false, absenceClaimedThisMonth: 4 },
  { userCode: 'I003', userName: '鈴木一郎', isTransportTarget: true, absenceClaimedThisMonth: 1 }
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
      isAbsenceAddonClaimable: false
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

const AttendanceRecordPage: React.FC = () => {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [users, setUsers] = useState<AttendanceUser[]>(initialUsers);
  const [visits, setVisits] = useState<Record<string, AttendanceVisit>>(() =>
    buildInitialVisits(initialUsers, today)
  );
  const [absenceDialog, setAbsenceDialog] = useState<AbsenceDialogState | null>(null);

  const summary = useMemo(() => {
    const values = Object.values(visits);
    const attendIn = values.filter((visit) => visit.cntAttendIn === 1).length;
    const attendOut = values.filter((visit) => visit.cntAttendOut === 1).length;
    const transportTo = values.filter((visit) => visit.transportTo).length;
    const transportFrom = values.filter((visit) => visit.transportFrom).length;
    const absenceAddon = values.filter((visit) => visit.isAbsenceAddonClaimable).length;
    return { attendIn, attendOut, transportTo, transportFrom, absenceAddon };
  }, [visits]);

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
      if (!current || current.status !== '通所中' || current.cntAttendOut === 1) {
        return prev;
      }
      const now = new Date();
      return {
        ...prev,
        [user.userCode]: {
          ...current,
          status: '退所済',
          checkOutAt: now.toISOString(),
          cntAttendOut: 1,
          isEarlyLeave: isBeforeCloseTime(now)
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
    const eligible =
      morningContacted &&
      eveningChecked &&
      user.absenceClaimedThisMonth < 4;

    setVisits((prev) => ({
      ...prev,
      [user.userCode]: {
        ...visit,
        status: '当日欠席',
        cntAttendIn: 0,
        cntAttendOut: 0,
        checkInAt: undefined,
        checkOutAt: undefined,
        transportTo: false,
        transportFrom: false,
        absentMorningContacted: morningContacted,
        absentMorningMethod: morningMethod,
        eveningChecked,
        eveningNote,
        isAbsenceAddonClaimable: eligible
      }
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

    closeAbsenceDialog();
  };

  const handleReset = (user: AttendanceUser) => {
    setVisits((prev) => ({
      ...prev,
      [user.userCode]: buildInitialVisits([user], today)[user.userCode]
    }));
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h3" component="h1">
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
              <Chip
                icon={<AbsenceIcon />}
                color="warning"
                label={`欠席加算 ${summary.absenceAddon}`}
              />
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={2}>
          {users.map((user) => {
            const visit = visits[user.userCode];
            const disableCheckIn = visit.status === '当日欠席' || visit.cntAttendIn === 1;
            const disableCheckOut = visit.status !== '通所中';
            const disableAbsence = visit.status !== '未' && visit.status !== '当日欠席';
            const absenceLimitReached = user.absenceClaimedThisMonth >= 4;

            return (
              <Card key={user.userCode} sx={{ border: '1px solid', borderColor: 'divider' }}>
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
                          {visit.isEarlyLeave && (
                            <Chip label="早退" color="warning" variant="outlined" />
                          )}
                          {visit.isAbsenceAddonClaimable && (
                            <Chip label="欠席加算対象" color="warning" />
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
                            >
                              欠席
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title="初期状態へ戻します">
                          <span>
                            <Button
                              variant="text"
                              color="inherit"
                              onClick={() => handleReset(user)}
                              startIcon={<ResetIcon />}
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
                当月欠席加算確定 {absenceDialog.user.absenceClaimedThisMonth} 件 / 4 件
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
