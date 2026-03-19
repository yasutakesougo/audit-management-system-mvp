/**
 * OpsScheduleHeader — ヘッダー領域
 *
 * 画面タイトル + 日付ナビ + 表示モード切替 + 新規登録 + 検索
 * 検索は value + onChange ベース（内部 state を持ちすぎない）
 */

import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';

import type { OpsViewMode } from '../../domain/scheduleOps';

// ─── Date Formatter ──────────────────────────────────────────────────────────

const DATE_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

const VIEW_MODE_LABELS: Record<OpsViewMode, string> = {
  daily: '日',
  weekly: '週',
  list: '一覧',
};

// ─── Component ───────────────────────────────────────────────────────────────

export type OpsScheduleHeaderProps = {
  selectedDate: Date;
  viewMode: OpsViewMode;
  searchQuery: string;
  onDateChange: (date: Date) => void;
  onGoToday: () => void;
  onGoPrev: () => void;
  onGoNext: () => void;
  onViewModeChange: (mode: OpsViewMode) => void;
  onSearchChange: (query: string) => void;
  onCreateClick: () => void;
};

export const OpsScheduleHeader: FC<OpsScheduleHeaderProps> = ({
  selectedDate,
  viewMode,
  searchQuery,
  onGoToday,
  onGoPrev,
  onGoNext,
  onViewModeChange,
  onSearchChange,
  onCreateClick,
}) => {
  const dateLabel = DATE_FORMATTER.format(selectedDate);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        px: { xs: 2, sm: 3 },
        pt: 2,
        pb: 1,
      }}
    >
      {/* Row 1: Title + Date Nav + ViewMode + Create */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        {/* Title */}
        <Typography
          variant="h6"
          component="h1"
          sx={{ fontWeight: 700, mr: 1, whiteSpace: 'nowrap' }}
        >
          利用スケジュール
        </Typography>

        {/* Date Navigator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="前日" arrow disableInteractive>
            <IconButton size="small" onClick={onGoPrev} aria-label="前日">
              <ChevronLeftIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="今日に移動" arrow disableInteractive>
            <IconButton size="small" onClick={onGoToday} aria-label="今日">
              <TodayIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="翌日" arrow disableInteractive>
            <IconButton size="small" onClick={onGoNext} aria-label="翌日">
              <ChevronRightIcon />
            </IconButton>
          </Tooltip>

          <Typography
            variant="subtitle1"
            component="span"
            sx={{ fontWeight: 600, ml: 0.5 }}
            aria-live="polite"
          >
            {dateLabel}
          </Typography>
        </Box>

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* View Mode Toggle */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, value) => {
            if (value) onViewModeChange(value as OpsViewMode);
          }}
          size="small"
          aria-label="表示モード切替"
        >
          {(['daily', 'weekly', 'list'] as const).map((mode) => (
            <ToggleButton key={mode} value={mode} sx={{ px: 1.5, py: 0.5 }}>
              {VIEW_MODE_LABELS[mode]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* Create Button */}
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={onCreateClick}
          sx={{ ml: 1, whiteSpace: 'nowrap' }}
        >
          新規登録
        </Button>
      </Box>

      {/* Row 2: Search */}
      <TextField
        size="small"
        placeholder="利用者名で検索…"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        slotProps={{
          htmlInput: { 'aria-label': '利用者検索' },
        }}
        sx={{ maxWidth: 320 }}
      />
    </Box>
  );
};
