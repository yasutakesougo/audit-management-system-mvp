import { useState } from 'react';
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
import { useStaffAttendanceAdmin } from '@/features/staff/attendance/hooks/useStaffAttendanceAdmin';
import { StaffAttendanceEditDialog } from '@/features/staff/attendance/components/StaffAttendanceEditDialog';
import type { StaffAttendance } from '@/features/staff/attendance/types';

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
  const { items, loading, error, saving, save } = useStaffAttendanceAdmin(date);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<StaffAttendance | null>(null);

  const handleRowClick = (row: StaffAttendance) => {
    setSelected(row);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelected(null);
  };

  const handleSave = async (next: StaffAttendance) => {
    await save(next);
    setDialogOpen(false);
    setSelected(null);
  };

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
          {loading && (
            <Stack direction="row" spacing={2} alignItems="center">
              <CircularProgress size={20} />
              <Typography>読み込み中…</Typography>
            </Stack>
          )}

          {error && (
            <Alert severity="error" data-testid="staff-attendance-error">
              {error}
            </Alert>
          )}

          {!loading && !error && items.length === 0 && (
            <Alert severity="info" data-testid="staff-attendance-empty">
              この日の勤怠データはありません。
            </Alert>
          )}

          {!loading && items.length > 0 && (
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
                {items.map((it) => (
                  <TableRow
                    key={`${it.recordDate}#${it.staffId}`}
                    hover
                    onClick={() => handleRowClick(it)}
                    data-testid={`staff-attendance-row-${it.staffId}`}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{it.staffId}</TableCell>
                    <TableCell>{it.status}</TableCell>
                    <TableCell>{it.note ?? '—'}</TableCell>
                    <TableCell>
                      {it.checkInAt ? new Date(it.checkInAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      </Stack>

      <StaffAttendanceEditDialog
        open={dialogOpen}
        recordDate={date}
        initial={selected}
        saving={saving}
        onClose={handleDialogClose}
        onSave={handleSave}
      />
    </Box>
  );
}
