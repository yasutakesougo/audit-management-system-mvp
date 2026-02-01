import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import { useStaffAttendanceAdmin } from "@/features/staff/attendance/hooks/useStaffAttendanceAdmin";
import { useStaffStore } from "@/features/staff/store";
import {
  buildMonthlySummary,
  buildStaffBreakdown,
  listAllStatuses,
  type AttendanceLike,
} from "@/features/staff/attendance/summary";

const pad2 = (n: number) => String(n).padStart(2, "0");
const toISODate = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;
const lastDayOfMonth = (y: number, m: number) => new Date(y, m, 0).getDate(); // m: 1-12

const defaultMonthValue = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`; // YYYY-MM
};

const monthToRange = (ym: string): { from: string; to: string } => {
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const from = toISODate(y, m, 1);
  const to = toISODate(y, m, lastDayOfMonth(y, m));
  return { from, to };
};

export default function StaffAttendanceMonthlySummaryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get('month') ?? '';
  const recordDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const {
    listItems,
    listLoading,
    listError,
    fetchListByDateRange,
  } = useStaffAttendanceAdmin(recordDate);

  const { byId: staffById } = useStaffStore();

  const [monthValue, setMonthValue] = useState<string>(() => monthParam || defaultMonthValue());
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const { from, to } = useMemo(() => monthToRange(monthValue), [monthValue]);

  useEffect(() => {
    if (!monthParam) return;
    if (monthParam !== monthValue) setMonthValue(monthParam);
  }, [monthParam, monthValue]);

  const handleMonthChange = useCallback((value: string) => {
    setMonthValue(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set('month', value);
    else next.delete('month');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleFetch = useCallback(async () => {
    await fetchListByDateRange(from, to);
    setLastFetchedAt(new Date());
  }, [fetchListByDateRange, from, to]);

  const items = (listItems ?? []) as AttendanceLike[];

  const summary = useMemo(() => buildMonthlySummary(items), [items]);
  const breakdown = useMemo(() => buildStaffBreakdown(items), [items]);
  const statuses = useMemo(() => listAllStatuses(summary.countsByStatus), [summary.countsByStatus]);
  const lastFetchedLabel = lastFetchedAt
    ? lastFetchedAt.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

  const resolveStaffName = (staffId: string): string => {
    // Try parsing as number for staffById Map lookup
    const numId = Number(staffId);
    const s = Number.isFinite(numId) ? staffById?.get(numId) : undefined;
    return s?.name ?? staffId;
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            勤怠 月次サマリー
          </Typography>
          <Button
            component={Link}
            to="/admin/staff-attendance"
            size="small"
            variant="outlined"
          >
            一覧へ戻る
          </Button>
        </Stack>

        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
            <TextField
              label="対象月"
              type="month"
              value={monthValue}
              onChange={(e) => handleMonthChange(e.target.value)}
              inputProps={{ "data-testid": "staff-attendance-summary-month" }}
              sx={{ width: 220 }}
            />
            <Box sx={{ flex: 1 }} />
            <Button
              variant="contained"
              onClick={handleFetch}
              disabled={listLoading}
              data-testid="staff-attendance-summary-fetch"
            >
              {listLoading ? <CircularProgress size={20} /> : "読み込み"}
            </Button>
          </Stack>

          <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
            範囲: {from} 〜 {to} / 件数: {summary.totalItems} / 最終更新: {lastFetchedLabel}
          </Typography>
        </Paper>

        {listError && (
          <Alert severity="error" data-testid="staff-attendance-summary-error">
            {String(listError)}
          </Alert>
        )}

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            サマリー
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Paper variant="outlined" sx={{ p: 1.5, minWidth: 220 }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                総件数
              </Typography>
              <Typography variant="h6" data-testid="staff-attendance-summary-total">
                {summary.totalItems}
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, minWidth: 220 }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                職員数
              </Typography>
              <Typography variant="h6" data-testid="staff-attendance-summary-staffcount">
                {summary.uniqueStaffCount}
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, minWidth: 220 }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                出勤扱い
              </Typography>
              <Typography variant="h6" data-testid="staff-attendance-summary-attendance">
                {summary.attendanceCount}
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, minWidth: 220 }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                欠勤扱い
              </Typography>
              <Typography variant="h6" data-testid="staff-attendance-summary-absence">
                {summary.absenceCount}
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, minWidth: 220 }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                遅刻
              </Typography>
              <Typography variant="h6" data-testid="staff-attendance-summary-late">
                {summary.lateCount}
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, minWidth: 220 }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                早退
              </Typography>
              <Typography variant="h6" data-testid="staff-attendance-summary-early-leave">
                {summary.earlyLeaveCount}
              </Typography>
            </Paper>

            {statuses.map((st) => (
              <Paper key={st} variant="outlined" sx={{ p: 1.5, minWidth: 220 }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {st}
                </Typography>
                <Typography
                  variant="h6"
                  data-testid={`staff-attendance-summary-status-${st}`}
                >
                  {summary.countsByStatus[st] ?? 0}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            職員別
          </Typography>

          {!listLoading && breakdown.length === 0 && !listError && (
            <Alert severity="info" data-testid="staff-attendance-summary-empty">
              データがありません。対象月を選び「読み込み」を押してください。
            </Alert>
          )}

          {listLoading && (
            <Stack direction="row" spacing={2} alignItems="center">
              <CircularProgress size={20} />
              <Typography>読み込み中…</Typography>
            </Stack>
          )}

          {breakdown.length > 0 && (
            <Table size="small" data-testid="staff-attendance-summary-table">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>職員</TableCell>
                  {statuses.map((st) => (
                    <TableCell
                      key={`head-${st}`}
                      align="right"
                      sx={{ fontWeight: 800 }}
                    >
                      {st}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    合計
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {breakdown.map((r) => (
                  <TableRow key={r.staffId}>
                    <TableCell>
                      {resolveStaffName(r.staffId)}{" "}
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        ({r.staffId})
                      </Typography>
                    </TableCell>
                    {statuses.map((st) => (
                      <TableCell
                        key={`${r.staffId}-${st}`}
                        align="right"
                      >
                        {r.countsByStatus[st] ?? 0}
                      </TableCell>
                    ))}
                    <TableCell align="right">{r.total}</TableCell>
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
