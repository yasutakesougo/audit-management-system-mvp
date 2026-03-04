/**
 * DailyRecordStatsPanel — Statistics cards for daily records
 *
 * Shows today's record count, completed, in-progress, not-started, and absent.
 * Extracted from DailyRecordPage.tsx for single-responsibility.
 */

import type { PersonDaily } from '@/domain/daily/types';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';

// ─── Props ──────────────────────────────────────────────────────────────────

interface DailyRecordStatsPanelProps {
  records: PersonDaily[];
  expectedCount: number;
  attendanceRate: number;
  absentUserIds?: string[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DailyRecordStatsPanel({
  records,
  expectedCount,
  attendanceRate,
  absentUserIds,
}: DailyRecordStatsPanelProps) {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayRecords = useMemo(
    () => records.filter((r) => r.date === todayStr),
    [records, todayStr],
  );

  const completedCount = useMemo(
    () => todayRecords.filter((r) => r.status === '完了').length,
    [todayRecords],
  );

  const inProgressCount = useMemo(
    () => todayRecords.filter((r) => r.status === '作成中').length,
    [todayRecords],
  );

  const notStartedCount = useMemo(
    () => todayRecords.filter((r) => r.status === '未作成').length,
    [todayRecords],
  );

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} data-testid="daily-stats-panel">
      <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }} data-testid="total-records-stat">
        <Typography variant="h6" color="primary">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <span data-testid="total-records-count">
              {todayRecords.length} / {expectedCount}
            </span>
            <Chip
              size="small"
              label={`${attendanceRate}%`}
              color={
                attendanceRate >= 90
                  ? 'success'
                  : attendanceRate >= 70
                    ? 'warning'
                    : 'error'
              }
              sx={{ fontSize: '0.7rem' }}
              data-testid="attendance-rate-chip"
            />
          </Box>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          本日記録数（予定通所者）
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }} data-testid="completed-records-stat">
        <Typography variant="h6" color="success.main" data-testid="completed-count">
          {completedCount}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          完了
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }} data-testid="in-progress-records-stat">
        <Typography variant="h6" color="warning.main" data-testid="in-progress-count">
          {inProgressCount}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          作成中
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }} data-testid="not-started-records-stat">
        <Typography variant="h6" color="text.secondary" data-testid="not-started-count">
          {notStartedCount}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          未作成
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }} data-testid="absent-records-stat">
        <Typography variant="h6" color="info.main" data-testid="absent-count">
          {absentUserIds?.length || 0}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          欠席予定者
        </Typography>
      </Paper>
    </Stack>
  );
}
