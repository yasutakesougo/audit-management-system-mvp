import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Stack,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  ToggleButton,
  Checkbox,
  Divider,
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

function firstOfMonthISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

export default function StaffAttendanceAdminPage(): JSX.Element {
  const [date, setDate] = useState<string>(() => todayISO());
  const [listDateFrom, setListDateFrom] = useState<string>(() => firstOfMonthISO());
  const [listDateTo, setListDateTo] = useState<string>(() => todayISO());
  
  const [searchParams, setSearchParams] = useSearchParams();

  const readCsvParam = (key: string): Set<string> => {
    const raw = searchParams.get(key);
    if (!raw) return new Set();
    return new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  };

  // フィルタ state（新規）
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(() => readCsvParam('staff'));
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(() => readCsvParam('status'));
  
  const admin = useStaffAttendanceAdmin(date);
  const {
    items,
    loading,
    error,
    saving,
    save,
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

  // URL 更新ヘルパー
  const updateSearchParams = useCallback(
    (staff: Set<string>, status: Set<string>) => {
      const next = new URLSearchParams(searchParams);

      if (staff.size > 0) next.set('staff', Array.from(staff).join(','));
      else next.delete('staff');

      if (status.size > 0) next.set('status', Array.from(status).join(','));
      else next.delete('status');

      // replace で履歴を増やさない（bookmarkableは維持）
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // 候補生成
  const { uniqueStaffIds, uniqueStatuses } = useMemo(() => {
    const staffs = Array.from(new Set(listItems.map((it) => it.staffId).filter(Boolean)));
    const statuses = Array.from(new Set(listItems.map((it) => it.status).filter(Boolean)));
    staffs.sort();
    statuses.sort();
    return { uniqueStaffIds: staffs, uniqueStatuses: statuses };
  }, [listItems]);

  // フィルタ適用
  const filteredListItems = useMemo(() => {
    if (selectedStaffIds.size === 0 && selectedStatuses.size === 0) return listItems;

    return listItems.filter((it) => {
      const staffId = it.staffId ?? '';
      const status = it.status ?? '';
      const staffMatch = selectedStaffIds.size === 0 || selectedStaffIds.has(staffId);
      const statusMatch = selectedStatuses.size === 0 || selectedStatuses.has(status);
      return staffMatch && statusMatch;
    });
  }, [listItems, selectedStaffIds, selectedStatuses]);

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
            <Chip
              size="small"
              label={connectionLabel}
              color={
                connectionStatus === 'connected'
                  ? 'success'
                  : connectionStatus === 'checking'
                    ? 'default'
                    : connectionStatus === 'local'
                      ? 'info'
                      : 'warning'
              }
              variant={connectionStatus === 'local' ? 'outlined' : 'filled'}
              data-testid="staff-attendance-connection"
            />
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

      <Divider sx={{ my: 4 }} />

      <Stack spacing={2}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          勤怠一覧（読み取り）
        </Typography>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Typography sx={{ minWidth: 80, fontWeight: 700 }}>期間</Typography>
            <Box>
              <input
                data-testid="staff-attendance-list-date-from"
                type="date"
                value={listDateFrom}
                onChange={(e) => setListDateFrom(e.target.value)}
                style={{
                  padding: '8px',
                  fontSize: '14px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  marginRight: '8px',
                }}
              />
              <span style={{ marginRight: '8px' }}>〜</span>
              <input
                data-testid="staff-attendance-list-date-to"
                type="date"
                value={listDateTo}
                onChange={(e) => setListDateTo(e.target.value)}
                style={{
                  padding: '8px',
                  fontSize: '14px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
            </Box>
            <Button
              variant="contained"
              size="small"
              onClick={() => fetchListByDateRange(listDateFrom, listDateTo)}
              data-testid="staff-attendance-list-fetch"
            >
              検索
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            {(selectedStaffIds.size > 0 || selectedStatuses.size > 0) && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  フィルタ中:
                </Typography>

                {Array.from(selectedStaffIds).map((id) => (
                  <Chip
                    key={`staff-${id}`}
                    label={`職員: ${id}`}
                    onDelete={() => {
                      const next = new Set(selectedStaffIds);
                      next.delete(id);
                      setSelectedStaffIds(next);
                      updateSearchParams(next, selectedStatuses);
                    }}
                    size="small"
                  />
                ))}

                {Array.from(selectedStatuses).map((st) => (
                  <Chip
                    key={`status-${st}`}
                    label={`ステータス: ${st}`}
                    onDelete={() => {
                      const next = new Set(selectedStatuses);
                      next.delete(st);
                      setSelectedStatuses(next);
                      updateSearchParams(selectedStaffIds, next);
                    }}
                    size="small"
                  />
                ))}

                <Button
                  size="small"
                  variant="text"
                  onClick={() => {
                    const empty = new Set<string>();
                    setSelectedStaffIds(empty);
                    setSelectedStatuses(empty);
                    updateSearchParams(empty, empty);
                  }}
                >
                  クリア
                </Button>
              </Box>
            )}

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>職員:</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {uniqueStaffIds.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      データなし
                    </Typography>
                  ) : (
                    uniqueStaffIds.map((id) => (
                      <Chip
                        key={`filter-staff-${id}`}
                        label={id}
                        onClick={() => {
                          const next = new Set(selectedStaffIds);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          setSelectedStaffIds(next);
                          updateSearchParams(next, selectedStatuses);
                        }}
                        variant={selectedStaffIds.has(id) ? 'filled' : 'outlined'}
                        size="small"
                        clickable
                      />
                    ))
                  )}
                </Box>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>ステータス:</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {uniqueStatuses.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      データなし
                    </Typography>
                  ) : (
                    uniqueStatuses.map((st) => (
                      <Chip
                        key={`filter-status-${st}`}
                        label={st}
                        onClick={() => {
                          const next = new Set(selectedStatuses);
                          if (next.has(st)) next.delete(st);
                          else next.add(st);
                          setSelectedStatuses(next);
                          updateSearchParams(selectedStaffIds, next);
                        }}
                        variant={selectedStatuses.has(st) ? 'filled' : 'outlined'}
                        size="small"
                        clickable
                      />
                    ))
                  )}
                </Box>
              </Stack>
            </Stack>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          {listLoading && (
            <Stack direction="row" spacing={2} alignItems="center">
              <CircularProgress size={20} />
              <Typography>読み込み中…</Typography>
            </Stack>
          )}

          {listError && (
            <Alert severity="error" data-testid="staff-attendance-list-error">
              {listError}
            </Alert>
          )}

          {!listLoading && filteredListItems.length === 0 && !listError && (
            <Alert severity="info" data-testid="staff-attendance-list-empty">
              {listItems.length > 0 ? 'フィルタ条件に該当するデータがありません。' : '期間内に勤怠データがありません。'}
            </Alert>
          )}

          {!listLoading && filteredListItems.length > 0 && (
            <Table size="small" data-testid="staff-attendance-list-table">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>日付</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>職員ID</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>ステータス</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>備考</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>チェックイン</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>チェックアウト</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredListItems.map((it) => (
                  <TableRow
                    key={`${it.recordDate}#${it.staffId}`}
                    data-testid={`staff-attendance-list-row-${it.recordDate}-${it.staffId}`}
                  >
                    <TableCell>{it.recordDate}</TableCell>
                    <TableCell>{it.staffId}</TableCell>
                    <TableCell>{it.status}</TableCell>
                    <TableCell>{it.note ?? '—'}</TableCell>
                    <TableCell>
                      {it.checkInAt ? new Date(it.checkInAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </TableCell>
                    <TableCell>
                      {it.checkOutAt ? new Date(it.checkOutAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </TableCell>
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
