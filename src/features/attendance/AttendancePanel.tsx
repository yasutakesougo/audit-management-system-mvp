import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleOutlineIcon from '@mui/icons-material/TaskAlt';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';

import { AttendanceFilterBar } from './components/AttendanceFilterBar';
import { AttendanceList } from './components/AttendanceList';
import { useAttendance } from './useAttendance';

const AttendancePanel = (): JSX.Element => {
  const { status, rows, filters, actions } = useAttendance();

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

      <AttendanceList rows={rows} onUpdateStatus={actions.updateStatus} />
    </Box>
  );
};

export default AttendancePanel;
