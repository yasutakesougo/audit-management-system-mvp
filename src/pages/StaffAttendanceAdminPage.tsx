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
  Button,
  ToggleButton,
  Checkbox,
} from '@mui/material';
import { useStaffAttendanceAdmin } from '@/features/staff/attendance/hooks/useStaffAttendanceAdmin';
import { useStaffAttendanceBulk } from '@/features/staff/attendance/hooks/useStaffAttendanceBulk';
import { StaffAttendanceEditDialog } from '@/features/staff/attendance/components/StaffAttendanceEditDialog';
import { StaffAttendanceBulkInputDrawer } from '@/features/staff/attendance/components/StaffAttendanceBulkInputDrawer';
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
  const admin = useStaffAttendanceAdmin(date);
  const { items, loading, error, saving, save, port, recordDate, refetch, writeEnabled, readOnlyReason } = admin;

  const bulk = useStaffAttendanceBulk({
    port,
    recordDate,
    items,
    refetch,
    writeEnabled,
    readOnlyReason,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<StaffAttendance | null>(null);

  const handleRowClick = (row: StaffAttendance) => {
    if (bulk.bulkMode) {
      bulk.toggleSelect(row.staffId);
    } else {
      setSelected(row);
      setDialogOpen(true);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelected(null);
  };

  const handleSave = async (next: StaffAttendance) => {
    if (!writeEnabled) return;
    await save(next);
    setDialogOpen(false);
    setSelected(null);
  };

  return (
    <Box data-testid="staff-attendance-admin-root" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            職員勤怠（管理）
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <ToggleButton
              value="bulk"
              selected={bulk.bulkMode}
              onChange={bulk.toggleBulkMode}
              size="small"
              data-testid="staff-attendance-bulk-toggle"
            >
              一括入力モード
            </ToggleButton>

            {bulk.bulkMode && (
              <Button
                variant="contained"
                onClick={bulk.openDrawer}
                size="small"
                data-testid="staff-attendance-bulk-open"
                disabled={bulk.selectedCount === 0}
              >
                一括編集（{bulk.selectedCount}）
              </Button>
            )}
          </Stack>
        </Stack>

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

          {readOnlyReason && (
            <Alert severity="warning" data-testid="staff-attendance-readonly">
              {readOnlyReason}
            </Alert>
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
                  {bulk.bulkMode && <TableCell sx={{ width: 48 }} />}
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
                    sx={{ 
                      cursor: writeEnabled ? 'pointer' : 'default',
                      ...(bulk.bulkMode && bulk.selectedIds.has(it.staffId) && {
                        backgroundColor: 'action.selected',
                      }),
                    }}
                  >
                    {bulk.bulkMode && (
                      <TableCell>
                        <Checkbox
                          checked={bulk.selectedIds.has(it.staffId)}
                          data-testid={`staff-attendance-select-${it.staffId}`}
                        />
                      </TableCell>
                    )}
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
        writeEnabled={writeEnabled}
        onClose={handleDialogClose}
        onSave={handleSave}
      />

      <StaffAttendanceBulkInputDrawer
        open={bulk.drawerOpen}
        selectedCount={bulk.selectedCount}
        saving={bulk.saving}
        error={bulk.error}
        writeEnabled={writeEnabled}
        onClose={bulk.closeDrawer}
        value={bulk.value}
        onChange={bulk.setValue}
        onSave={bulk.bulkSave}
      />
    </Box>
  );
}
