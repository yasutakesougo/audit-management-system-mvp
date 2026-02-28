/**
 * StaffAttendanceInput — Write UI
 *
 * P2-2: 同期ストア + ポーリングを削除し、
 * useStaffAttendanceWrite (async port-backed) に全面移行。
 *
 * - 表示: hook の items
 * - 更新: hook の upsertOne
 * - 編集: StaffAttendanceEditDialog
 * - 一括: StaffAttendanceBulkInputDrawer + useStaffAttendanceBulk
 */
import { useMemo, useState } from 'react';

import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';

import { useStaff } from '@/stores/useStaff';
import { StaffAttendanceBulkInputDrawer } from './components/StaffAttendanceBulkInputDrawer';
import { StaffAttendanceEditDialog } from './components/StaffAttendanceEditDialog';
import { useStaffAttendanceBulk } from './hooks/useStaffAttendanceBulk';
import { useStaffAttendanceWrite } from './hooks/useStaffAttendanceWrite';
import type { StaffAttendance, StaffAttendanceStatus } from './types';

const STATUS_OPTIONS: StaffAttendanceStatus[] = ['出勤', '欠勤', '外出中'];

/**
 * ISO datetime → "HH:MM" (JST)
 */
function formatTimeLike(v?: string | null): string {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    });
  } catch {
    return String(v);
  }
}

export const StaffAttendanceInput: React.FC = () => {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { staff } = useStaff();

  const {
    items,
    isLoading,
    error,
    reload,
    saving,
    upsertOne,
    writeEnabled,
    readOnlyReason,
    port,
  } = useStaffAttendanceWrite(today);

  // ── Merged rows: staff master × attendance items ──
  // 全職員を表示し、attendance がある場合は status を埋める
  const rows = useMemo(() => {
    const attendanceMap = new Map(items.map((a) => [a.staffId, a]));

    return staff.map((s): StaffAttendance & { staffName: string } => {
      const att = attendanceMap.get(s.staffId);
      return {
        staffId: s.staffId,
        recordDate: today,
        status: att?.status ?? '出勤',
        checkInAt: att?.checkInAt,
        checkOutAt: att?.checkOutAt,
        lateMinutes: att?.lateMinutes,
        note: att?.note,
        isFinalized: att?.isFinalized,
        finalizedAt: att?.finalizedAt,
        finalizedBy: att?.finalizedBy,
        staffName: s.name,
      };
    });
  }, [items, staff, today]);

  // ── Edit dialog ──
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<StaffAttendance | null>(null);

  const openEdit = (row: StaffAttendance) => {
    setEditItem(row);
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditItem(null);
  };

  const handleEditSave = async (next: StaffAttendance) => {
    await upsertOne(next);
    closeEdit();
  };

  // ── Bulk input ──
  const refetch = async () => {
    await reload();
  };
  const bulk = useStaffAttendanceBulk({
    port,
    recordDate: today,
    items,
    refetch,
    writeEnabled,
    readOnlyReason,
  });

  // ── Status toggle ──
  const handleChangeStatus = async (row: StaffAttendance, nextStatus: string | null) => {
    if (!nextStatus) return;
    await upsertOne({ ...row, status: nextStatus as StaffAttendanceStatus });
  };

  return (
    <Stack spacing={2} data-testid="staff-attendance-input-write">
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
        <Stack spacing={0.5}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            職員勤怠入力（{today}）
          </Typography>
          <Typography variant="body2" color="text.secondary">
            件数: {rows.length}
          </Typography>
        </Stack>

        <Box display="flex" gap={1}>
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => void reload()}
            disabled={isLoading || saving}
            data-testid="staff-attendance-write-reload"
          >
            再読み込み
          </Button>

          <Button
            variant={bulk.bulkMode ? 'contained' : 'outlined'}
            onClick={bulk.toggleBulkMode}
            disabled={!writeEnabled || isLoading}
            data-testid="staff-attendance-write-bulk-toggle"
          >
            {bulk.bulkMode ? '選択解除' : '一括入力'}
          </Button>

          {bulk.bulkMode && bulk.selectedCount > 0 && (
            <Button
              variant="contained"
              onClick={bulk.openDrawer}
              disabled={!writeEnabled}
              data-testid="staff-attendance-write-bulk-open"
            >
              適用（{bulk.selectedCount}件）
            </Button>
          )}
        </Box>
      </Box>

      {/* Alerts */}
      {!writeEnabled && (
        <Alert severity="info" data-testid="staff-attendance-write-readonly">
          {readOnlyReason ?? '読み取り専用モードです。'}
        </Alert>
      )}

      {error && (
        <Alert severity="error" data-testid="staff-attendance-write-error">
          {error}
        </Alert>
      )}

      {/* Loading */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4} data-testid="staff-attendance-write-loading">
          <CircularProgress size={32} />
        </Box>
      ) : (
        /* Table */
        <TableContainer data-testid="staff-attendance-write-table">
          <Table size="small">
            <TableHead>
              <TableRow>
                {bulk.bulkMode && <TableCell padding="checkbox" />}
                <TableCell sx={{ fontWeight: 700 }}>職員名</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ステータス</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>出勤時刻</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>メモ</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">操作</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.staffId} data-testid={`staff-attendance-write-row-${row.staffId}`}>
                  {bulk.bulkMode && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={bulk.selectedIds.has(row.staffId)}
                        onChange={() => bulk.toggleSelect(row.staffId)}
                        data-testid={`staff-attendance-write-check-${row.staffId}`}
                      />
                    </TableCell>
                  )}

                  <TableCell>
                    <Stack>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {row.staffName || row.staffId}
                      </Typography>
                      {row.staffName && (
                        <Typography variant="caption" color="text.secondary">
                          {row.staffId}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={row.status}
                      onChange={(_, next) => void handleChangeStatus(row, next)}
                      disabled={!writeEnabled || saving}
                      aria-label={`${row.staffName ?? row.staffId}の勤怠状態`}
                      data-testid={`staff-attendance-toggle-${row.staffId}`}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <ToggleButton key={opt} value={opt} aria-label={opt}>
                          {opt}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatTimeLike(row.checkInAt)}
                    </Typography>
                  </TableCell>

                  <TableCell
                    sx={{
                      maxWidth: 200,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={row.note ?? ''}
                  >
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {row.note || '—'}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => openEdit(row)}
                      disabled={!writeEnabled || saving}
                      data-testid={`staff-attendance-edit-${row.staffId}`}
                    >
                      編集
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Edit Dialog */}
      <StaffAttendanceEditDialog
        open={editOpen}
        recordDate={today}
        initial={editItem}
        onClose={closeEdit}
        onSave={handleEditSave}
        saving={saving}
        writeEnabled={writeEnabled}
      />

      {/* Bulk Input Drawer */}
      <StaffAttendanceBulkInputDrawer
        open={bulk.drawerOpen}
        selectedCount={bulk.selectedCount}
        saving={bulk.saving}
        error={bulk.error}
        onClose={bulk.closeDrawer}
        writeEnabled={writeEnabled}
        value={bulk.value}
        onChange={bulk.setValue}
        onSave={bulk.bulkSave}
      />
    </Stack>
  );
};
