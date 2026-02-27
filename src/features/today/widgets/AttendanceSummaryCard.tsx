/**
 * AttendanceSummaryCard — 出席状況サマリー
 *
 * 通所中/欠席/早退の件数をチップ形式で表示。
 */
import { Box, Chip, Paper, Typography } from '@mui/material';
import React from 'react';

export type AttendanceSummaryCardProps = {
  facilityAttendees: number;
  absenceCount: number;
  absenceNames: string[];
  lateOrEarlyLeave: number;
  lateOrEarlyNames: string[];
};

export const AttendanceSummaryCard: React.FC<AttendanceSummaryCardProps> = ({
  facilityAttendees,
  absenceCount,
  absenceNames,
  lateOrEarlyLeave,
  lateOrEarlyNames,
}) => {
  return (
    <Paper data-testid="today-attendance-card" sx={{ p: 2, mb: 3 }}>
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        📊 出席状況
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1 }}>
        <Chip
          label={`通所中 ${facilityAttendees}名`}
          color="success"
          size="small"
          variant="filled"
        />
        {absenceCount > 0 && (
          <Chip
            label={`欠席 ${absenceCount}名`}
            color="error"
            size="small"
            variant="filled"
          />
        )}
        {lateOrEarlyLeave > 0 && (
          <Chip
            label={`遅刻・早退 ${lateOrEarlyLeave}名`}
            color="warning"
            size="small"
            variant="filled"
          />
        )}
      </Box>

      {absenceCount > 0 && absenceNames.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          欠席: {absenceNames.join('、')}
        </Typography>
      )}
      {lateOrEarlyLeave > 0 && lateOrEarlyNames.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            遅刻・早退: {lateOrEarlyNames.join('、')}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};
