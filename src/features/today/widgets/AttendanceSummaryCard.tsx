/**
 * AttendanceSummaryCard — 出席状況サマリー
 *
 * 予定人数 / 通所済み / 当日欠席(記録重要) / 事前欠席 / 遅刻・早退を表示。
 * 当日欠席は欠席加算に直結するため「記録重要」ラベルで強調する。
 */
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Button, Chip, Paper, Typography } from '@mui/material';
import React from 'react';
import { EmptyStateBlock } from './EmptyStateBlock';

export type AttendanceSummaryCardProps = {
  scheduledCount: number;
  facilityAttendees: number;
  sameDayAbsenceCount: number;
  sameDayAbsenceNames: string[];
  priorAbsenceCount: number;
  priorAbsenceNames: string[];
  lateOrEarlyLeave: number;
  lateOrEarlyNames: string[];
  /** CTA: 「出欠を入力」クリック時のハンドラ（後方互換: optional） */
  onAction?: () => void;
};

export const AttendanceSummaryCard: React.FC<AttendanceSummaryCardProps> = ({
  scheduledCount,
  facilityAttendees,
  sameDayAbsenceCount,
  sameDayAbsenceNames,
  priorAbsenceCount,
  priorAbsenceNames,
  lateOrEarlyLeave,
  lateOrEarlyNames,
  onAction,
}) => {
  const totalAbsence = sameDayAbsenceCount + priorAbsenceCount;
  const hasAnyData = facilityAttendees > 0 || totalAbsence > 0 || lateOrEarlyLeave > 0;

  if (!hasAnyData) {
    return (
      <Paper data-testid="today-attendance-card" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          📊 出席状況
        </Typography>
        <EmptyStateBlock
          icon={<InfoOutlinedIcon />}
          title="出席データがありません"
          description="通所予定が登録されると表示されます。"
          testId="today-empty-attendance"
        />
      </Paper>
    );
  }

  return (
    <Paper data-testid="today-attendance-card" sx={{ p: 2, mb: 3 }}>
      {/* Header: タイトル + 予定人数 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2" fontWeight="bold">
          📊 出席状況
        </Typography>
        {scheduledCount > 0 && (
          <Chip
            label={`予定 ${scheduledCount}名`}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
          />
        )}
      </Box>

      {/* Chips Row */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Chip
          label={`通所済 ${facilityAttendees}名`}
          color="success"
          size="small"
          variant="filled"
        />
        {sameDayAbsenceCount > 0 && (
          <Chip
            label={`🔴 当日欠席 ${sameDayAbsenceCount}名`}
            color="error"
            size="small"
            variant="filled"
            data-testid="chip-same-day-absence"
          />
        )}
        {priorAbsenceCount > 0 && (
          <Chip
            label={`事前欠席 ${priorAbsenceCount}名`}
            color="default"
            size="small"
            variant="outlined"
            data-testid="chip-prior-absence"
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

      {/* 当日欠席: 記録重要 + 名前リスト */}
      {sameDayAbsenceCount > 0 && (
        <Box sx={{ mb: 0.5 }}>
          <Typography
            variant="caption"
            data-testid="same-day-absence-important"
            sx={{
              color: 'error.main',
              fontWeight: 700,
              fontSize: '0.7rem',
            }}
          >
            ⚠ 記録重要
          </Typography>
          {sameDayAbsenceNames.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              {sameDayAbsenceNames.join('、')}
            </Typography>
          )}
        </Box>
      )}

      {/* 事前欠席: 名前リスト */}
      {priorAbsenceCount > 0 && priorAbsenceNames.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          事前欠席: {priorAbsenceNames.join('、')}
        </Typography>
      )}

      {/* 遅刻・早退: 名前リスト */}
      {lateOrEarlyLeave > 0 && lateOrEarlyNames.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          遅刻・早退: {lateOrEarlyNames.join('、')}
        </Typography>
      )}

      {/* CTA: 出欠を入力 */}
      {onAction && (
        <Box sx={{ mt: 1.5, textAlign: 'right' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={onAction}
            data-testid="attendance-action-cta"
            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
          >
            出欠を入力
          </Button>
        </Box>
      )}
    </Paper>
  );
};
