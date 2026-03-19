/**
 * OpsWeekDayCell — 週次ビューの1日分セル
 *
 * 責務:
 * - DaySummaryEntry を受け取り、1日の負荷サマリーを表示する
 * - 定員超過日を視覚的に警告表示する
 * - onClick でその日への drilldown をトリガーする
 *
 * 「俯瞰」に特化: 情報過多にせず、total / respite / shortStay / attention / availableSlots に絞る
 */

import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import type { FC } from 'react';

import type { DaySummaryEntry } from '../../domain/scheduleOps';

// ─── Date Formatter ──────────────────────────────────────────────────────────

const DAY_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
});

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

function formatDayCellDate(dateIso: string): { label: string; weekday: string } {
  const d = new Date(dateIso + 'T00:00:00');
  return {
    label: DAY_FORMATTER.format(d),
    weekday: WEEKDAY_LABELS[d.getDay()] ?? '',
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export type OpsWeekDayCellProps = {
  day: DaySummaryEntry;
  onClick?: (dateIso: string) => void;
};

export const OpsWeekDayCell: FC<OpsWeekDayCellProps> = ({ day, onClick }) => {
  const theme = useTheme();
  const { label, weekday } = formatDayCellDate(day.dateIso);

  const isWeekend = weekday === '土' || weekday === '日';

  return (
    <Paper
      variant="outlined"
      onClick={() => onClick?.(day.dateIso)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(day.dateIso);
        }
      }}
      aria-label={`${label}(${weekday}) 合計${day.totalCount}名`}
      sx={{
        p: 1.5,
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.75,
        minWidth: 100,
        transition: 'all 0.15s ease-in-out',
        '&:hover': onClick
          ? {
              borderColor: theme.palette.primary.main,
              boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.3)}`,
              transform: 'translateY(-1px)',
            }
          : undefined,
        ...(day.isOverCapacity && {
          borderColor: theme.palette.error.main,
          backgroundColor: alpha(theme.palette.error.main, 0.04),
        }),
      }}
    >
      {/* 日付ヘッダ */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: isWeekend
              ? weekday === '日'
                ? theme.palette.error.main
                : theme.palette.info.main
              : 'text.secondary',
          }}
        >
          {weekday}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {label}
        </Typography>
      </Box>

      {/* 合計人数 */}
      <Typography
        variant="h5"
        sx={{
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          color: day.isOverCapacity ? 'error.main' : 'text.primary',
        }}
      >
        {day.totalCount}
        <Typography component="span" variant="body2" sx={{ fontWeight: 400, ml: 0.25 }}>
          名
        </Typography>
      </Typography>

      {/* 超過警告 */}
      {day.isOverCapacity && (
        <Chip
          icon={<ReportProblemOutlinedIcon />}
          label="超過"
          color="error"
          size="small"
          variant="outlined"
          sx={{ height: 22, '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' } }}
        />
      )}

      {/* 詳細行: ショート / レスパイト / 注意 */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
          width: '100%',
          mt: 0.5,
        }}
      >
        {day.respiteCount > 0 && (
          <DetailRow label="レスパイト" value={day.respiteCount} color={theme.palette.warning.main} />
        )}
        {day.shortStayCount > 0 && (
          <DetailRow label="ショート" value={day.shortStayCount} color={theme.palette.info.main} />
        )}
        {day.attentionCount > 0 && (
          <DetailRow label="要注意" value={day.attentionCount} color={theme.palette.error.main} />
        )}
      </Box>

      {/* 空き枠 */}
      <Typography
        variant="caption"
        sx={{
          color: day.availableSlots === 0 ? 'error.main' : 'text.secondary',
          fontVariantNumeric: 'tabular-nums',
          mt: 'auto',
        }}
      >
        空き {day.availableSlots}
      </Typography>
    </Paper>
  );
};

// ─── Detail Row Subcomponent ─────────────────────────────────────────────────

type DetailRowProps = {
  label: string;
  value: number;
  color: string;
};

const DetailRow: FC<DetailRowProps> = ({ label, value, color }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 0.5 }}>
    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
      {label}
    </Typography>
    <Typography
      variant="caption"
      sx={{ fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', fontSize: '0.7rem' }}
    >
      {value}
    </Typography>
  </Box>
);
