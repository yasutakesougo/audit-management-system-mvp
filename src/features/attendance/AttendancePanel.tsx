import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleOutlineIcon from '@mui/icons-material/TaskAlt';
import { Alert, Box, Button, Chip, Snackbar, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

import { AttendanceFilterBar } from './components/AttendanceFilterBar';
import { AttendanceList } from './components/AttendanceList';
import { useAttendance } from './useAttendance';

const AttendancePanel = (): JSX.Element => {
  const { status, rows, filters, inputMode, savingUsers, notification, dismissNotification, actions } = useAttendance();

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

      <AttendanceList rows={rows} savingUsers={savingUsers} inputMode={inputMode} onUpdateStatus={actions.updateStatus} />

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
