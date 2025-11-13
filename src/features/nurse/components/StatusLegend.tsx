import type { RowStatus } from '@/features/nurse/observation/BulkObservationList';
import { TESTIDS } from '@/testids';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const LABELS: Record<Exclude<RowStatus, 'idle'>, { label: string; icon: JSX.Element; color: string }> = {
  queued: {
    label: '同期待機',
    icon: <HourglassBottomIcon fontSize="inherit" />,
    color: 'warning.main',
  },
  ok: {
    label: '同期済み',
    icon: <DoneAllIcon fontSize="inherit" />,
    color: 'success.main',
  },
  partial: {
    label: '一部同期',
    icon: <TaskAltIcon fontSize="inherit" />,
    color: 'info.main',
  },
  error: {
    label: '同期エラー',
    icon: <ErrorOutlineIcon fontSize="inherit" />,
    color: 'error.main',
  },
};

const ORDER: Array<Exclude<RowStatus, 'idle'>> = ['queued', 'ok', 'partial', 'error'];

export default function StatusLegend() {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      flexWrap="wrap"
      alignItems="center"
      data-testid={TESTIDS.NURSE_BULK_STATUS_LEGEND}
    >
      {ORDER.map((status) => {
        const entry = LABELS[status];
        return (
          <Stack key={status} direction="row" spacing={0.75} alignItems="center">
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                color: entry.color,
              }}
            >
              {entry.icon}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {entry.label}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}
