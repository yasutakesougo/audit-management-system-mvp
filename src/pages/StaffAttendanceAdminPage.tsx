import { canAccess } from '@/auth/roles';
import { useUserAuthz } from '@/auth/useUserAuthz';
import { StaffAttendanceBulkInputDrawer } from '@/features/staff/attendance/components/StaffAttendanceBulkInputDrawer';
import { StaffAttendanceEditDialog } from '@/features/staff/attendance/components/StaffAttendanceEditDialog';
import { StaffAttendanceListSection } from '@/features/staff/attendance/components/StaffAttendanceListSection';
import { useStaffAttendanceAdmin } from '@/features/staff/attendance/hooks/useStaffAttendanceAdmin';
import { useStaffAttendanceBulk } from '@/features/staff/attendance/hooks/useStaffAttendanceBulk';
import type { StaffAttendance } from '@/features/staff/attendance/types';
import {
    firstOfMonthISO,
    todayISO,
} from '@/features/staff/attendance/utils/staffAttendanceDateUtils';
import { useStaffStore } from '@/features/staff/store';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Divider,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    ToggleButton,
    Typography,
} from '@mui/material';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const STAFF_ATTENDANCE_FINALIZE_STORAGE_KEY = 'staff-attendance.finalized.v1';

const loadLegacyFinalizedDayMap = (): Record<string, unknown> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STAFF_ATTENDANCE_FINALIZE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export default function StaffAttendanceAdminPage(): JSX.Element {
  const { role, ready } = useUserAuthz();
  const canWriteByRole = ready && canAccess(role, 'reception');
  const [date, setDate] = useState<string>(() => todayISO());
  const legacyFinalizedDayMap = useMemo(() => loadLegacyFinalizedDayMap(), []);

  const [searchParams] = useSearchParams();
  const { data: staffData } = useStaffStore();

  const admin = useStaffAttendanceAdmin(date);
  const {
    items,
    loading,
    error,
    saving,
    save,
    finalizeDay,
    unfinalizeDay,
    port,
    recordDate,
    refetch,
    writeEnabled,
    readOnlyReason,
    connectionStatus,
    connectionLabel,
    fetchListByDateRange,
    listItems = [],
    listLoading = false,
    listError,
  } = admin;
  const effectiveWriteEnabled = writeEnabled && canWriteByRole;
  const effectiveReadOnlyReason = !canWriteByRole
    ? '更新操作は受付（reception）以上のみ利用できます。'
    : readOnlyReason;
  const isFinalized = useMemo(
    () => items.some((item) => item.isFinalized === true) || Boolean(legacyFinalizedDayMap[date]),
    [date, items, legacyFinalizedDayMap],
  );
  const finalizedInfoText = useMemo(() => {
    const finalizedRecord = items.find((item) => item.isFinalized);
    if (!finalizedRecord) return null;
    const finalizedAt = finalizedRecord.finalizedAt;
    const finalizedBy = finalizedRecord.finalizedBy;
    if (!finalizedAt && !finalizedBy) return null;

    const datetime = finalizedAt
      ? new Date(finalizedAt).toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;
    if (datetime && finalizedBy) return `${datetime} / ${finalizedBy}`;
    return datetime ?? finalizedBy ?? null;
  }, [items]);

  const staffNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (staffData ?? []).forEach((staff) => {
      const key = (staff.staffId ?? '').trim() || (staff.id != null ? String(staff.id) : '');
      if (!key) return;
      const name = (staff.name ?? '').trim();
      map.set(key, name || key);
    });
    return map;
  }, [staffData]);

  const formatStaffLabel = useCallback(
    (staffId: string | null | undefined) => {
      const key = (staffId ?? '').trim();
      if (!key) return '—';
      const name = staffNameMap.get(key);
      if (name && name !== key) return `${name}（${key}）`;
      return key;
    },
    [staffNameMap],
  );

  const bulk = useStaffAttendanceBulk({
    port,
    recordDate,
    items,
    refetch,
    writeEnabled: effectiveWriteEnabled,
    readOnlyReason: effectiveReadOnlyReason,
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
    if (!effectiveWriteEnabled) return;
    await save(next);
    setDialogOpen(false);
    setSelected(null);
  };

  const handleFinalize = async () => {
    if (!effectiveWriteEnabled) return;
    if (isFinalized) return;
    await finalizeDay();
  };

  const handleUnfinalize = async () => {
    if (!effectiveWriteEnabled) return;
    if (!isFinalized) return;
    await unfinalizeDay();
  };

  return (
    <Box data-testid="staff-attendance-admin-root" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            職員勤怠（管理）
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            {isFinalized && (
              <Chip
                size="small"
                color="success"
                label={finalizedInfoText ? `確定済み（${finalizedInfoText}）` : '確定済み'}
                data-testid="staff-attendance-finalized-badge"
              />
            )}
            <Button
              variant="outlined" size="small"
              onClick={handleFinalize}
              disabled={!effectiveWriteEnabled || isFinalized || items.length === 0 || saving}
              data-testid="staff-attendance-finalize-btn"
            >
              確定
            </Button>
            <Button
              variant="outlined" size="small"
              onClick={handleUnfinalize}
              disabled={!effectiveWriteEnabled || !isFinalized || saving}
              data-testid="staff-attendance-unfinalize-btn"
            >
              取消
            </Button>
            <Chip
              size="small"
              label={connectionLabel}
              color={
                connectionStatus === 'connected' ? 'success'
                  : connectionStatus === 'checking' ? 'default'
                    : connectionStatus === 'local' ? 'info' : 'warning'
              }
              variant={connectionStatus === 'local' ? 'outlined' : 'filled'}
              data-testid="staff-attendance-connection"
            />
            <ToggleButton
              value="bulk" selected={bulk.bulkMode}
              onChange={bulk.toggleBulkMode} size="small"
              data-testid="staff-attendance-bulk-toggle"
            >
              一括入力モード
            </ToggleButton>

            {bulk.bulkMode && (
              <Button
                variant="contained" onClick={bulk.openDrawer} size="small"
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
              <input
                data-testid="staff-attendance-date"
                type="date" value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
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
          {effectiveReadOnlyReason && (
            <Alert severity="warning" data-testid="staff-attendance-readonly">{effectiveReadOnlyReason}</Alert>
          )}
          {error && (
            <Alert severity="error" data-testid="staff-attendance-error">{error}</Alert>
          )}
          {!loading && !error && items.length === 0 && (
            <Alert severity="info" data-testid="staff-attendance-empty">この日の勤怠データはありません。</Alert>
          )}
          {!loading && items.length > 0 && (
            <Table size="small" data-testid="staff-attendance-table">
              <TableHead>
                <TableRow>
                  {bulk.bulkMode && <TableCell sx={{ width: 48 }} />}
                  <TableCell sx={{ fontWeight: 800 }}>職員</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>ステータス</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>備考</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>チェックイン</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((it) => (
                  <TableRow
                    key={`${it.recordDate}#${it.staffId}`}
                    hover onClick={() => handleRowClick(it)}
                    data-testid={`staff-attendance-row-${it.staffId}`}
                    sx={{
                      cursor: effectiveWriteEnabled ? 'pointer' : 'default',
                      ...(bulk.bulkMode && bulk.selectedIds.has(it.staffId) && { backgroundColor: 'action.selected' }),
                    }}
                  >
                    {bulk.bulkMode && (
                      <TableCell>
                        <Checkbox checked={bulk.selectedIds.has(it.staffId)} data-testid={`staff-attendance-select-${it.staffId}`} />
                      </TableCell>
                    )}
                    <TableCell>{formatStaffLabel(it.staffId)}</TableCell>
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
        writeEnabled={effectiveWriteEnabled}
        onClose={handleDialogClose}
        onSave={handleSave}
      />

      <StaffAttendanceBulkInputDrawer
        open={bulk.drawerOpen}
        selectedCount={bulk.selectedCount}
        saving={bulk.saving}
        error={bulk.error}
        writeEnabled={effectiveWriteEnabled}
        onClose={bulk.closeDrawer}
        value={bulk.value}
        onChange={bulk.setValue}
        onSave={bulk.bulkSave}
      />

      <Divider sx={{ my: 4 }} />

      <StaffAttendanceListSection
        listItems={listItems}
        listLoading={listLoading}
        listError={listError}
        formatStaffLabel={formatStaffLabel}
        fetchListByDateRange={fetchListByDateRange}
        initialDateFrom={firstOfMonthISO()}
        initialDateTo={todayISO()}
      />
    </Box>
  );
}
