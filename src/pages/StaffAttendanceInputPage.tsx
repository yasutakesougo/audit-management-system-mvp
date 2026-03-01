import { useFeatureFlag } from '@/config/featureFlags';
import { StaffAttendanceInput } from '@/features/staff/attendance/StaffAttendanceInput';
import { buildStaffAttendanceRows, type AttendanceRowStatus } from '@/features/staff/attendance/buildStaffAttendanceRows';
import { useStaffAttendanceDay } from '@/features/staff/attendance/hooks/useStaffAttendanceDay';
import { useStaff } from '@/stores/useStaff';
import EmptyState from '@/ui/components/EmptyState';
import LockIcon from '@mui/icons-material/Lock';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Alert, Box, Chip, CircularProgress, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { useMemo } from 'react';

export type StaffAttendanceInputPageProps = {
  className?: string;
};

/**
 * StaffAttendanceInputPage
 *
 * Feature flag `staffAttendance` controls **write UI only**.
 * - flag ON  → Full input UI (StaffAttendanceInput component)
 * - flag OFF → Read-only list view (always available to reception role)
 *
 * Read-only view is the safe default for gradual rollout.
 * The route guard (RequireAudience requiredRole="reception") handles access control.
 */
export const StaffAttendanceInputPage = ({ className }: StaffAttendanceInputPageProps) => {
  /**
   * staffAttendance flag = "write (入力) UI 有効化フラグ"
   * read-only 一覧は flag に関係なく常に利用可能
   */
  const writeEnabled = useFeatureFlag("staffAttendance");

  // Write UI: gated behind feature flag
  if (writeEnabled) {
    return (
      <Box className={className} data-testid="staff-attendance-input-root">
        <StaffAttendanceInput />
      </Box>
    );
  }

  // Read-only list (default view)
  return <StaffAttendanceReadOnlyView className={className} />;
};

// ──── Read-Only View ────

const STATUS_COLORS: Record<AttendanceRowStatus, 'success' | 'error' | 'warning' | 'default'> = {
  '出勤': 'success',
  '欠勤': 'error',
  '未入力': 'default',
};

const STATUS_VARIANT: Record<AttendanceRowStatus, 'filled' | 'outlined'> = {
  '出勤': 'filled',
  '欠勤': 'filled',
  '未入力': 'outlined',
};

const StaffAttendanceReadOnlyView: React.FC<{ className?: string }> = ({ className }) => {
  const today = new Date().toISOString().slice(0, 10);
  const { items, isLoading, error, reload, storageKind } = useStaffAttendanceDay(today);
  const { staff, isLoading: staffLoading } = useStaff();

  const rows = useMemo(
    () => buildStaffAttendanceRows(staff, items),
    [staff, items],
  );

  const combinedLoading = isLoading || staffLoading;

  return (
    <Box className={className} data-testid="staff-attendance-readonly-root">
      <Paper sx={{ p: 3 }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack spacing={0.5}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              職員出勤（閲覧）
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {today}
              </Typography>
              <Chip
                label={storageKind === 'sharepoint' ? 'SharePoint' : 'Local'}
                size="small"
                variant="outlined"
                color={storageKind === 'sharepoint' ? 'primary' : 'default'}
              />
            </Stack>
          </Stack>
          <Tooltip title="再読み込み">
            <IconButton onClick={reload} disabled={isLoading} aria-label="再読み込み" data-testid="staff-attendance-reload">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="staff-attendance-error">
            {error}
          </Alert>
        )}

        {/* Loading */}
        {combinedLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }} data-testid="staff-attendance-loading">
            <CircularProgress size={32} />
          </Box>
        )}

        {/* Empty: staff master が 0件のときのみ */}
        {!combinedLoading && !error && rows.length === 0 && (
          <EmptyState
            title="職員データがありません"
            description="職員マスターにスタッフが登録されると、ここに表示されます。"
          />
        )}

        {/* Table */}
        {!combinedLoading && rows.length > 0 && (
          <TableContainer data-testid="staff-attendance-table">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>職員名</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>ステータス</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>備考</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">確定</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.staffId} data-testid={`staff-attendance-row-${row.staffId}`}>
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
                      <Chip
                        label={row.status}
                        size="small"
                        color={STATUS_COLORS[row.status]}
                        variant={STATUS_VARIANT[row.status]}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                        {row.note || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {row.isFinalized && (
                        <Tooltip title="確定済み">
                          <LockIcon fontSize="small" color="action" />
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};
