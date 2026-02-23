/**
 * Dashboard Attendance Section Component
 *
 * 責務：「今日の通所 / 出勤状況」セクション の表示
 * - Page から集計データと state を受け取る
 * - JSX 描画のみ（計算は Page で実施）
 *
 * 現在：Page の renderSection(case 'attendance') の JSX をそのまま移動
 * Props：Page 側の実装と一致（attendanceSummary / showAttendanceNames / setShowAttendanceNames）
 */

import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

/**
 * Page 側で計算済みの集計データ構造
 * （useMemo in DashboardPage で返される attendanceSummary と完全一致）
 */
export type AttendanceSummaryData = {
  facilityAttendees: number;
  lateOrEarlyLeave: number;
  lateOrEarlyNames?: string[];
  absenceCount: number;
  absenceNames?: string[];
  onDutyStaff: number;
  lateOrShiftAdjust: number;
  outStaff: number;
  outStaffNames?: string[];
};

export type AttendanceSectionProps = {
  attendanceSummary: AttendanceSummaryData;
  showAttendanceNames: boolean;
  onToggleAttendanceNames: (next: boolean) => void;
};

/**
 * 表示コンポーネント（純粋）
 * - 入力 props のみで描画
 * - state 管理なし（Page の state を props で受け取る）
 */
export const AttendanceSection: React.FC<AttendanceSectionProps> = (props) => {
  const { attendanceSummary, showAttendanceNames, onToggleAttendanceNames } =
    props;

  const formatNames = (names?: string[]) => {
    const list = names ?? [];
    if (list.length === 0) return '該当者なし';
    const shown = list.slice(0, 6).join('、');
    const remaining = list.length - 6;
    return remaining > 0 ? `${shown}、他${remaining}名` : shown;
  };

  return (
    <Paper elevation={3} sx={{ p: { xs: 2, sm: 2.5, md: 3 } }} data-testid="dashboard-section-attendance">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography variant="h6" fontWeight={800}>
            今日の通所 / 出勤状況
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            利用者と職員の通所・出勤の状況をまとめて確認できます。
          </Typography>
        </Stack>
        <Stack
          spacing={0.75}
          alignItems={{ xs: 'flex-start', md: 'flex-end' }}
          sx={{ width: { xs: '100%', md: 'auto' }, minWidth: 180 }}
        >
          <Stack direction="row" spacing={1} flexWrap="nowrap" useFlexGap>
            <Button
              variant="contained"
              size="small"
              component={Link}
              to="/daily/attendance"
            >
              通所入力
            </Button>
            <Button
              variant="outlined"
              size="small"
              component={Link}
              to="/staff/attendance"
            >
              職員出勤
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="nowrap" useFlexGap>
            <Button variant="text" size="small" component={Link} to="/daily/activity">
              支援記録
            </Button>
            <Button variant="text" size="small" component={Link} to="/handoff-timeline">
              申し送り
            </Button>
          </Stack>
        </Stack>
      </Stack>
      <Grid container spacing={{ xs: 2, sm: 2, md: 3 }} sx={{ mt: 2 }}>
        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
          <Typography variant="h4" color="primary" sx={{ fontWeight: 800 }}>
            {attendanceSummary.facilityAttendees}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            施設通所
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
          <Typography variant="h4" color="success.main" sx={{ fontWeight: 800 }}>
            {attendanceSummary.lateOrEarlyLeave}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            遅刻・早退
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
          <Box>
            <Typography variant="h4" color="warning.main" sx={{ fontWeight: 800 }}>
              {attendanceSummary.absenceCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              欠席
            </Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
          <Typography variant="h4" color="text.primary" sx={{ fontWeight: 800 }}>
            {attendanceSummary.onDutyStaff}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            出勤職員
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
          <Typography variant="h4" color="secondary.main" sx={{ fontWeight: 800 }}>
            {attendanceSummary.lateOrShiftAdjust}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            シフト調整
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
          <Typography variant="h4" color="info.main" sx={{ fontWeight: 800 }}>
            {attendanceSummary.outStaff}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            外出スタッフ
          </Typography>
        </Grid>
      </Grid>
      {(() => {
        const hasNames =
          (attendanceSummary.absenceNames?.length ?? 0) > 0 ||
          (attendanceSummary.lateOrEarlyNames?.length ?? 0) > 0 ||
          (attendanceSummary.outStaffNames?.length ?? 0) > 0;

        if (!hasNames) return null;

        const absenceCount = attendanceSummary.absenceNames?.length ?? 0;
        const lateOrEarlyCount = attendanceSummary.lateOrEarlyNames?.length ?? 0;
        const outStaffCount = attendanceSummary.outStaffNames?.length ?? 0;

        return (
          <Stack alignItems="flex-end" sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="text"
              onClick={() =>
                onToggleAttendanceNames(!showAttendanceNames)
              }
              aria-expanded={showAttendanceNames}
            >
              {showAttendanceNames ? '閉じる' : '該当者を見る'}
            </Button>
            <Collapse in={showAttendanceNames} sx={{ width: '100%' }}>
              <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                <Stack spacing={0.25}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    欠席（{absenceCount}）
                  </Typography>
                  <Typography variant="caption">
                    {formatNames(attendanceSummary.absenceNames)}
                  </Typography>
                </Stack>
                <Stack spacing={0.25}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    遅刻・早退（{lateOrEarlyCount}）
                  </Typography>
                  <Typography variant="caption">
                    {formatNames(attendanceSummary.lateOrEarlyNames)}
                  </Typography>
                </Stack>
                <Stack spacing={0.25}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    外出スタッフ（{outStaffCount}）
                  </Typography>
                  <Typography variant="caption">
                    {formatNames(attendanceSummary.outStaffNames)}
                  </Typography>
                </Stack>
              </Stack>
            </Collapse>
          </Stack>
        );
      })()}
    </Paper>
  );
};
