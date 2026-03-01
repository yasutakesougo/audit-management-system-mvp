import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleOutlineIcon from '@mui/icons-material/TaskAlt';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getNextTargetUserCode, scrollToUserRow } from './attendance.autoNext';
import { AttendanceFilterBar } from './components/AttendanceFilterBar';
import { AttendanceList } from './components/AttendanceList';
import { useAttendance } from './useAttendance';

// ── Temperature draft (local state, no save) ──

type TempDialogState = {
  open: boolean;
  userCode: string;
  userName: string;
};

const TEMP_DIALOG_CLOSED: TempDialogState = { open: false, userCode: '', userName: '' };

const isValidTemp = (v: number): boolean => v >= 35.0 && v <= 42.0;

const AttendancePanel = (): JSX.Element => {
  const { status, rows, filters, inputMode, savingUsers, savedTempsByUser, notification, dismissNotification, actions } = useAttendance();
  const navigate = useNavigate();

  // ── Temperature draft state ──
  const [tempDraftByUser, setTempDraftByUser] = useState<Record<string, number>>({});

  // Merge: draft wins over saved
  const tempByUser = useMemo(() => {
    const out: Record<string, number> = { ...savedTempsByUser };
    for (const [userCode, v] of Object.entries(tempDraftByUser)) {
      if (v != null) out[userCode] = v;
    }
    return out;
  }, [savedTempsByUser, tempDraftByUser]);

  // Refs for stale-closure-safe auto-scroll
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  const tempByUserRef = useRef(tempByUser);
  useEffect(() => { tempByUserRef.current = tempByUser; }, [tempByUser]);

  const [tempDialog, setTempDialog] = useState<TempDialogState>(TEMP_DIALOG_CLOSED);
  const [tempInput, setTempInput] = useState('');
  const [tempError, setTempError] = useState('');

  const openTempDialog = useCallback((userCode: string, userName: string) => {
    const current = tempDraftByUser[userCode];
    setTempInput(current != null ? String(current) : '');
    setTempError('');
    setTempDialog({ open: true, userCode, userName });
  }, [tempDraftByUser]);

  const closeTempDialog = useCallback(() => {
    setTempDialog(TEMP_DIALOG_CLOSED);
  }, []);

  const commitTemp = useCallback(() => {
    const parsed = parseFloat(tempInput);
    if (Number.isNaN(parsed)) {
      setTempError('数値を入力してください');
      return;
    }
    if (!isValidTemp(parsed)) {
      setTempError('35.0〜42.0 の範囲で入力してください');
      return;
    }
    const rounded = Math.round(parsed * 10) / 10;
    const savedUserCode = tempDialog.userCode;
    setTempDraftByUser((prev) => ({ ...prev, [savedUserCode]: rounded }));
    closeTempDialog();
    // Persist to SharePoint via nurse observation upsert
    void actions.saveTemperature(savedUserCode, rounded);

    // C1.6: auto-scroll to next target in checkInRun mode
    if (inputMode === 'checkInRun') {
      setTimeout(() => {
        const next = getNextTargetUserCode(
          rowsRef.current,
          { ...tempByUserRef.current, [savedUserCode]: rounded },
        );
        if (next) scrollToUserRow(next);
      }, 0);
    }
  }, [tempInput, tempDialog.userCode, closeTempDialog, actions, inputMode]);

  const handleOpenNurse = useCallback((userCode: string) => {
    navigate(`/nurse/observation?user=${userCode}`);
  }, [navigate]);

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      <Stack spacing={0.75}>
        <Typography variant="h4" component="h1" data-testid="heading-attendance">
          通所（出欠）
        </Typography>
        <Typography color="text.secondary">利用者一覧を検索し、状態を即時更新できます。</Typography>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Chip
          icon={<SyncIcon />}
          color={status === 'loading' ? 'warning' : 'default'}
          label={`状態: ${status}`}
          variant={status === 'loading' ? 'filled' : 'outlined'}
        />
        <Chip icon={<CheckCircleOutlineIcon />} label={`件数: ${rows.length}`} variant="outlined" />
      </Stack>

      {status === 'error' ? (
        <Alert icon={<ErrorOutlineIcon />} severity="error">
          出欠データの読み込みに失敗しました。再読込を実行してください。
        </Alert>
      ) : null}

      <AttendanceFilterBar
        filters={filters}
        onChange={actions.setFilters}
        onRefresh={() => {
          void actions.refresh();
        }}
        disabled={status === 'loading'}
      />

      <ToggleButtonGroup
        value={inputMode}
        exclusive
        onChange={(_, v) => { if (v) actions.setInputMode(v); }}
        size="small"
        sx={{ alignSelf: 'flex-start' }}
      >
        <ToggleButton value="normal" sx={{ minHeight: 44, px: 2.5 }}>通常</ToggleButton>
        <ToggleButton value="checkInRun" sx={{ minHeight: 44, px: 2.5 }}>通所連続</ToggleButton>
      </ToggleButtonGroup>

      <AttendanceList
        rows={rows}
        savingUsers={savingUsers}
        inputMode={inputMode}
        tempDraftByUser={tempByUser}
        onOpenTemp={openTempDialog}
        onOpenNurse={handleOpenNurse}
        onUpdateStatus={actions.updateStatus}
      />

      {/* Temperature input dialog */}
      <Dialog open={tempDialog.open} onClose={closeTempDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ThermostatIcon color="primary" />
          検温（{tempDialog.userName}）
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            type="number"
            label="体温"
            value={tempInput}
            onChange={(e) => { setTempInput(e.target.value); setTempError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTemp(); }}
            error={Boolean(tempError)}
            helperText={tempError || '35.0〜42.0'}
            inputProps={{ min: 35, max: 42, step: 0.1 }}
            InputProps={{
              endAdornment: <InputAdornment position="end">℃</InputAdornment>,
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTempDialog}>キャンセル</Button>
          <Button variant="contained" onClick={commitTemp}>記録</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notification.open}
        autoHideDuration={
          notification.actionLabel && notification.severity === 'success'
            ? 5000  // undo window
            : notification.severity === 'success'
              ? 3000
              : 6000
        }
        onClose={dismissNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={notification.severity}
          onClose={dismissNotification}
          variant="filled"
          action={
            notification.actionLabel && notification.onAction ? (
              <Button color="inherit" size="small" onClick={notification.onAction}>
                {notification.actionLabel}
              </Button>
            ) : undefined
          }
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AttendancePanel;
