import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Stack,
  Typography,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { getStaffAttendancePort } from '@/features/staff/attendance/storage';
import type { StaffAttendance } from '@/features/staff/attendance/types';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: StaffAttendance[] };

function todayISO(): string {
  // YYYY-MM-DD（ブラウザのローカル日付）
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function StaffAttendanceAdminPage(): JSX.Element {
  const [date, setDate] = useState<string>(() => todayISO());
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  const port = useMemo(() => getStaffAttendancePort(), []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState({ kind: 'loading' });

      const res = await port.listByDate(date);
      if (cancelled) return;

      if (!res.isOk) {
        setState({ kind: 'error', message: res.error.message || 'データの取得に失敗しました' });
        return;
      }

      setState({ kind: 'ready', items: res.value });
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [date, port]);

  return (
    <Box data-testid="staff-attendance-admin-root" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          職員勤怠（管理）
        </Typography>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Typography sx={{ minWidth: 120, fontWeight: 700 }}>対象日</Typography>
            <Box>
              {/* 依存追加なしの最短：input type="date" */}
              <input
                data-testid="staff-attendance-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  padding: '8px',
                  fontSize: '14px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          {state.kind === 'loading' && (
            <Stack direction="row" spacing={2} alignItems="center">
              <CircularProgress size={20} />
              <Typography>読み込み中…</Typography>
            </Stack>
          )}

          {state.kind === 'error' && (
            <Alert severity="error" data-testid="staff-attendance-error">
              {state.message}
            </Alert>
          )}

          {state.kind === 'ready' && state.items.length === 0 && (
            <Alert severity="info" data-testid="staff-attendance-empty">
              この日の勤怠データはありません。
            </Alert>
          )}

          {state.kind === 'ready' && state.items.length > 0 && (
            <Table size="small" data-testid="staff-attendance-table">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>職員ID</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>ステータス</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>備考</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>チェックイン</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state.items.map((it) => (
                  <TableRow key={`${it.recordDate}#${it.staffId}`}>
                    <TableCell>{it.staffId}</TableCell>
                    <TableCell>{it.status}</TableCell>
                    <TableCell>{it.note ?? '—'}</TableCell>
                    <TableCell>{it.checkInAt ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}
