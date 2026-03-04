/**
 * StaffAttendanceListSection — 勤怠一覧セクション
 *
 * StaffAttendanceAdminPage から抽出 (#766)
 */
import type { StaffAttendance } from '@/features/staff/attendance/types';
import { exportAttendanceCsv } from '@/features/staff/attendance/utils/staffAttendanceCsvExport';
import {
    endOfMonthISO,
    endOfWeekISO,
    startOfMonthISO,
    startOfWeekISO,
} from '@/features/staff/attendance/utils/staffAttendanceDateUtils';
import DownloadIcon from '@mui/icons-material/Download';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export type StaffAttendanceListSectionProps = {
  listItems: StaffAttendance[];
  listLoading: boolean;
  listError?: string | null;
  formatStaffLabel: (staffId: string | null | undefined) => string;
  fetchListByDateRange: (from: string, to: string) => void;
  initialDateFrom: string;
  initialDateTo: string;
};

export const StaffAttendanceListSection: React.FC<StaffAttendanceListSectionProps> = ({
  listItems,
  listLoading,
  listError,
  formatStaffLabel,
  fetchListByDateRange,
  initialDateFrom,
  initialDateTo,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [listDateFrom, setListDateFrom] = useState(initialDateFrom);
  const [listDateTo, setListDateTo] = useState(initialDateTo);

  const readCsvParam = (key: string): Set<string> => {
    const raw = searchParams.get(key);
    if (!raw) return new Set();
    return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  };

  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(() => readCsvParam('staff'));
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(() => readCsvParam('status'));

  const updateSearchParams = useCallback(
    (staff: Set<string>, status: Set<string>) => {
      const next = new URLSearchParams(searchParams);
      if (staff.size > 0) next.set('staff', Array.from(staff).join(','));
      else next.delete('staff');
      if (status.size > 0) next.set('status', Array.from(status).join(','));
      else next.delete('status');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const { uniqueStaffIds, uniqueStatuses } = useMemo(() => {
    const staffs = Array.from(new Set(listItems.map((it) => it.staffId).filter(Boolean)));
    const statuses = Array.from(new Set(listItems.map((it) => it.status).filter(Boolean)));
    staffs.sort();
    statuses.sort();
    return { uniqueStaffIds: staffs, uniqueStatuses: statuses };
  }, [listItems]);

  const filteredListItems = useMemo(() => {
    if (selectedStaffIds.size === 0 && selectedStatuses.size === 0) return listItems;
    return listItems.filter((it) => {
      const staffMatch = selectedStaffIds.size === 0 || selectedStaffIds.has(it.staffId ?? '');
      const statusMatch = selectedStatuses.size === 0 || selectedStatuses.has(it.status ?? '');
      return staffMatch && statusMatch;
    });
  }, [listItems, selectedStaffIds, selectedStatuses]);

  const applyPresetRange = useCallback((from: string, to: string) => {
    setListDateFrom(from);
    setListDateTo(to);
  }, []);

  const handlePresetThisMonth = useCallback(() => {
    const now = new Date();
    applyPresetRange(startOfMonthISO(now), endOfMonthISO(now));
  }, [applyPresetRange]);

  const handlePresetLastMonth = useCallback(() => {
    const base = new Date();
    base.setMonth(base.getMonth() - 1);
    applyPresetRange(startOfMonthISO(base), endOfMonthISO(base));
  }, [applyPresetRange]);

  const handlePresetThisWeek = useCallback(() => {
    const now = new Date();
    applyPresetRange(startOfWeekISO(now), endOfWeekISO(now));
  }, [applyPresetRange]);

  const handleExportCsv = useCallback(() => {
    exportAttendanceCsv(filteredListItems, listDateFrom, listDateTo, selectedStaffIds, selectedStatuses);
  }, [filteredListItems, listDateFrom, listDateTo, selectedStaffIds, selectedStatuses]);

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          勤怠一覧（読み取り）
        </Typography>
        <Button component={Link} to="/admin/staff-attendance/summary" size="small" variant="outlined">
          月次サマリーへ
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Typography sx={{ minWidth: 80, fontWeight: 700 }}>期間</Typography>
          <Box>
            <input
              data-testid="staff-attendance-list-date-from"
              type="date"
              value={listDateFrom}
              onChange={(e) => setListDateFrom(e.target.value)}
              style={{ padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px', marginRight: '8px' }}
            />
            <span style={{ marginRight: '8px' }}>〜</span>
            <input
              data-testid="staff-attendance-list-date-to"
              type="date"
              value={listDateTo}
              onChange={(e) => setListDateTo(e.target.value)}
              style={{ padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
            <Chip label="今月" size="small" onClick={handlePresetThisMonth} variant="outlined" clickable />
            <Chip label="先月" size="small" onClick={handlePresetLastMonth} variant="outlined" clickable />
            <Chip label="今週" size="small" onClick={handlePresetThisWeek} variant="outlined" clickable />
          </Stack>
          <Button
            variant="contained" size="small"
            onClick={() => fetchListByDateRange(listDateFrom, listDateTo)}
            data-testid="staff-attendance-list-fetch"
          >
            検索
          </Button>
          <Button
            variant="outlined" size="small"
            startIcon={<DownloadIcon />}
            onClick={handleExportCsv}
            disabled={filteredListItems.length === 0 || listLoading}
            data-testid="staff-attendance-export-csv"
          >
            CSVエクスポート
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          {(selectedStaffIds.size > 0 || selectedStatuses.size > 0) && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>フィルタ中:</Typography>
              {Array.from(selectedStaffIds).map((id) => (
                <Chip
                  key={`staff-${id}`}
                  label={`職員: ${formatStaffLabel(id)}`}
                  onDelete={() => {
                    const next = new Set(selectedStaffIds); next.delete(id);
                    setSelectedStaffIds(next); updateSearchParams(next, selectedStatuses);
                  }}
                  size="small"
                />
              ))}
              {Array.from(selectedStatuses).map((st) => (
                <Chip
                  key={`status-${st}`}
                  label={`ステータス: ${st}`}
                  onDelete={() => {
                    const next = new Set(selectedStatuses); next.delete(st);
                    setSelectedStatuses(next); updateSearchParams(selectedStaffIds, next);
                  }}
                  size="small"
                />
              ))}
              <Button size="small" variant="text" onClick={() => {
                const empty = new Set<string>();
                setSelectedStaffIds(empty); setSelectedStatuses(empty); updateSearchParams(empty, empty);
              }}>
                クリア
              </Button>
            </Box>
          )}

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>職員:</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {uniqueStaffIds.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>データなし</Typography>
                ) : uniqueStaffIds.map((id) => (
                  <Chip
                    key={`filter-staff-${id}`}
                    label={formatStaffLabel(id)}
                    onClick={() => {
                      const next = new Set(selectedStaffIds);
                      if (next.has(id)) next.delete(id); else next.add(id);
                      setSelectedStaffIds(next); updateSearchParams(next, selectedStatuses);
                    }}
                    variant={selectedStaffIds.has(id) ? 'filled' : 'outlined'}
                    size="small" clickable
                  />
                ))}
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>ステータス:</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {uniqueStatuses.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>データなし</Typography>
                ) : uniqueStatuses.map((st) => (
                  <Chip
                    key={`filter-status-${st}`}
                    label={st}
                    onClick={() => {
                      const next = new Set(selectedStatuses);
                      if (next.has(st)) next.delete(st); else next.add(st);
                      setSelectedStatuses(next); updateSearchParams(selectedStaffIds, next);
                    }}
                    variant={selectedStatuses.has(st) ? 'filled' : 'outlined'}
                    size="small" clickable
                  />
                ))}
              </Box>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Typography variant="caption" color="text.secondary" data-testid="staff-attendance-list-count">
            表示 {filteredListItems.length} / 全体 {listItems.length}
          </Typography>
        </Box>
        {listLoading && (
          <Stack direction="row" spacing={2} alignItems="center">
            <CircularProgress size={20} />
            <Typography>読み込み中…</Typography>
          </Stack>
        )}
        {listError && (
          <Alert severity="error" data-testid="staff-attendance-list-error">{listError}</Alert>
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
                <TableCell sx={{ fontWeight: 800 }}>職員</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>ステータス</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>備考</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>チェックイン</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>チェックアウト</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredListItems.map((it) => (
                <TableRow key={`${it.recordDate}#${it.staffId}`} data-testid={`staff-attendance-list-row-${it.recordDate}-${it.staffId}`}>
                  <TableCell>{it.recordDate}</TableCell>
                  <TableCell>{formatStaffLabel(it.staffId)}</TableCell>
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
  );
};
