/**
 * ProgressStatusBar — 今日の進捗要約バー
 *
 * CTA は持たず、件数と進捗だけを表示する。
 *
 * 責務: 「今日全体の未完了状況を俯瞰する」（進捗ダッシュボード）
 * 行動の起点は NextActionCard に一元化されている。
 *
 * @see docs/design/hero-nextaction-responsibility.md
 */
import type { TodayScene } from '../domain/todayScene';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EditNoteIcon from '@mui/icons-material/EditNote';
import GroupsIcon from '@mui/icons-material/Groups';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import {
  Box,
  Chip,
  LinearProgress,
  Typography,
} from '@mui/material';
import React from 'react';

// ─── Types ───────────────────────────────────────────────────

export type TodayProgressSummary = {
  /** 未記録件数 */
  pendingRecordCount: number;
  /** 記録対象の総件数 */
  totalRecordCount: number;
  /** 出欠未確認件数 */
  pendingAttendanceCount: number;
  /** 申し送り未処理件数 */
  pendingBriefingCount: number;
};

export type ProgressChipKey = 'record' | 'attendance' | 'briefing' | 'recordsUser';

export type ProgressStatusBarProps = {
  summary: TodayProgressSummary;
  /** チップクリック時のコールバック。未指定なら従来通り表示のみ */
  onChipClick?: (key: ProgressChipKey) => void;
  /** 現在の運営場面。day-closing + 未完了で error 色を使用 */
  scene?: TodayScene;
};

// ─── Component ───────────────────────────────────────────────

export const ProgressStatusBar: React.FC<ProgressStatusBarProps> = ({
  summary,
  onChipClick,
  scene,
}) => {
  const { pendingRecordCount, totalRecordCount, pendingAttendanceCount, pendingBriefingCount } = summary;

  const completedCount = Math.max(0, totalRecordCount - pendingRecordCount);
  const completionRate = totalRecordCount > 0
    ? Math.round((completedCount / totalRecordCount) * 100)
    : 100;
  const isAllComplete = pendingRecordCount === 0 && pendingAttendanceCount === 0 && pendingBriefingCount === 0;

  // 進捗バーの色: day-closing + 未完了なら error、それ以外は完了率に応じて変化
  const isDayClosingUrgent = scene === 'day-closing' && !isAllComplete;
  const progressColor = isAllComplete
    ? 'success'
    : isDayClosingUrgent
      ? 'error'
      : completionRate >= 70
        ? 'success'
        : completionRate >= 30
          ? 'info'
          : 'warning';

  if (isAllComplete) {
    return (
      <Box
        data-testid="today-progress-bar"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 1.5,
          bgcolor: 'success.50',
          borderLeft: 4,
          borderColor: 'success.main',
        }}
      >
        <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: 22 }} />
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: 'success.dark' }}
        >
          ✅ 本日の業務はすべて完了しています
        </Typography>
      </Box>
    );
  }

  // 未完了チップの一覧を構築
  const chips: { icon: React.ReactElement; label: string; key: string }[] = [];

  if (pendingRecordCount > 0) {
    chips.push({
      icon: <EditNoteIcon sx={{ fontSize: 16 }} />,
      label: `未記録 ${pendingRecordCount}件`,
      key: 'record',
    });
  }
  if (pendingAttendanceCount > 0) {
    chips.push({
      icon: <GroupsIcon sx={{ fontSize: 16 }} />,
      label: `出欠未確認 ${pendingAttendanceCount}名`,
      key: 'attendance',
    });
  }
  if (pendingBriefingCount > 0) {
    chips.push({
      icon: <NotificationsActiveIcon sx={{ fontSize: 16 }} />,
      label: `申し送り ${pendingBriefingCount}件`,
      key: 'briefing',
    });
  }
  chips.push({
    icon: <EditNoteIcon sx={{ fontSize: 16 }} />,
    label: `記録(利用者順)`,
    key: 'recordsUser',
  });

  return (
    <Box
      data-testid="today-progress-bar"
      sx={{
        px: 2.5,
        py: 1.5,
        bgcolor: 'background.paper',
      }}
    >
      {/* 進捗バー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <LinearProgress
          variant="determinate"
          value={completionRate}
          color={progressColor}
          sx={{
            flex: 1,
            height: 8,
            borderRadius: 4,
            bgcolor: 'action.hover',
          }}
        />
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: 'text.secondary', whiteSpace: 'nowrap' }}
        >
          {completedCount}/{totalRecordCount} 完了
        </Typography>
      </Box>

      {/* 未完了チップ群 */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {chips.map((c) => (
          <Chip
            key={c.key}
            icon={c.icon}
            label={c.label}
            size="small"
            variant="outlined"
            clickable={!!onChipClick}
            onClick={onChipClick ? () => onChipClick(c.key as ProgressChipKey) : undefined}
            sx={{
              fontWeight: 600,
              fontSize: '0.75rem',
              borderColor: 'divider',
              color: 'text.secondary',
              '& .MuiChip-icon': { color: 'text.secondary' },
              ...(onChipClick && {
                cursor: 'pointer',
                '&:hover': {
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '& .MuiChip-icon': { color: 'primary.main' },
                },
              }),
            }}
          />
        ))}
      </Box>
    </Box>
  );
};
