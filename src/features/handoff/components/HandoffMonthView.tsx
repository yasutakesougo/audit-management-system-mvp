/**
 * HandoffMonthView — 月ビュー カレンダーグリッド表示
 *
 * 月曜始まりのカレンダーグリッドで、件数 + カテゴリチップ + ヒヤリ強調を表示。
 * 日クリックで day ビューへ遷移。
 */

import {
  Box,
  Chip,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import type { HandoffCategory } from '../handoffTypes';
import type { MonthDaySummary, MonthSummary } from '../hooks/useHandoffMonthViewModel';

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

interface HandoffMonthViewProps {
  summary: MonthSummary;
  loading: boolean;
  error: string | null;
  onDayClick: (date: string) => void;
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const WEEKDAY_HEADERS = ['月', '火', '水', '木', '金', '土', '日'] as const;

/** カテゴリ色 (HandoffWeekView と同一) */
const CATEGORY_CHIP_COLOR: Record<string, string> = {
  '事故・ヒヤリ': '#c62828',
  '体調': '#1565c0',
  '行動面': '#e65100',
  '送迎': '#2e7d32',
  '家族連絡': '#00838f',
  '支援の工夫': '#6a1b9a',
  '良かったこと': '#558b2f',
  'その他': '#757575',
};

/** カテゴリ名の短縮表示 */
function shortenCategory(cat: string): string {
  const map: Record<string, string> = {
    '事故・ヒヤリ': 'ヒヤリ',
    '家族連絡': '家族',
    '支援の工夫': '工夫',
    '良かったこと': '良い点',
  };
  return map[cat] ?? cat;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function HandoffMonthView({
  summary,
  loading,
  error,
  onDayClick,
}: HandoffMonthViewProps) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="error">
          データの取得に失敗しました: {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* ── 月サマリーバー ── */}
      <Paper
        variant="outlined"
        sx={{
          px: 2,
          py: 1,
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          📅 月の概況
        </Typography>
        <Chip
          label={`全 ${summary.totalCount} 件`}
          size="small"
          variant="outlined"
        />
        {summary.unhandledCount > 0 && (
          <Chip
            label={`未対応 ${summary.unhandledCount}`}
            size="small"
            sx={{ bgcolor: '#fff3e0', fontWeight: 600 }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        {summary.topCategories.map(({ category, count }) => (
          <Chip
            key={category}
            label={`${shortenCategory(category)} ${count}`}
            size="small"
            variant="outlined"
            sx={{
              borderColor: CATEGORY_CHIP_COLOR[category] ?? '#757575',
              color: CATEGORY_CHIP_COLOR[category] ?? '#757575',
              fontSize: '0.7rem',
            }}
          />
        ))}
      </Paper>

      {/* ── カレンダーグリッド ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 0.5,
        }}
      >
        {/* ヘッダー行 */}
        {WEEKDAY_HEADERS.map((dow, idx) => (
          <Box
            key={dow}
            sx={{
              textAlign: 'center',
              py: 0.5,
              fontWeight: 600,
              fontSize: '0.8rem',
              color: idx === 5 ? '#1565c0' : idx === 6 ? '#c62828' : 'text.secondary',
            }}
          >
            {dow}
          </Box>
        ))}

        {/* 日セル */}
        {summary.weeks.map((week) =>
          week.days.map((day) => (
            <DayCell
              key={day.date}
              day={day}
              onClick={onDayClick}
            />
          )),
        )}
      </Box>
    </Box>
  );
}

// ────────────────────────────────────────────────────────────
// DayCell
// ────────────────────────────────────────────────────────────

function DayCell({
  day,
  onClick,
}: {
  day: MonthDaySummary;
  onClick: (date: string) => void;
}) {
  const isClickable = day.isCurrentMonth && !day.isFuture;
  const hasData = day.count > 0;

  return (
    <Box
      onClick={isClickable ? () => onClick(day.date) : undefined}
      sx={{
        minHeight: 64,
        p: 0.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: day.isToday
          ? 'primary.main'
          : day.hasIncident && day.isCurrentMonth
            ? 'error.light'
            : 'divider',
        bgcolor: day.isFuture || !day.isCurrentMonth
          ? 'grey.50'
          : day.isToday
            ? 'primary.50'
            : 'background.paper',
        opacity: day.isCurrentMonth ? 1 : 0.4,
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.15s',
        '&:hover': isClickable
          ? {
              bgcolor: day.isToday ? 'primary.100' : 'grey.100',
              transform: 'scale(1.02)',
            }
          : {},
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
      }}
    >
      {/* 日付ラベル */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: day.isToday ? 700 : 400,
            fontSize: '0.75rem',
            color: day.dayOfWeek === 0
              ? '#c62828'
              : day.dayOfWeek === 6
                ? '#1565c0'
                : day.isCurrentMonth
                  ? 'text.primary'
                  : 'text.disabled',
          }}
        >
          {day.day}
        </Typography>
        {day.isToday && (
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.6rem',
              bgcolor: 'primary.main',
              color: 'white',
              px: 0.5,
              borderRadius: 0.5,
              lineHeight: 1.4,
            }}
          >
            今日
          </Typography>
        )}
      </Box>

      {/* 件数 + 未対応 */}
      {day.isCurrentMonth && hasData && (
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              fontSize: '0.85rem',
              lineHeight: 1,
            }}
          >
            {day.count}
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontSize: '0.6rem', color: 'text.secondary' }}
          >
            件
          </Typography>
          {day.unhandledCount > 0 && (
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.55rem',
                bgcolor: '#fff3e0',
                color: '#e65100',
                px: 0.3,
                borderRadius: 0.3,
                fontWeight: 600,
              }}
            >
              未{day.unhandledCount}
            </Typography>
          )}
        </Box>
      )}

      {/* 件数0の月内日: 控えめ表示 */}
      {day.isCurrentMonth && !hasData && !day.isFuture && (
        <Typography
          variant="caption"
          sx={{ fontSize: '0.7rem', color: 'text.disabled' }}
        >
          0件
        </Typography>
      )}

      {/* カテゴリチップ */}
      {day.isCurrentMonth && day.topCategories.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
          {day.topCategories.map(({ category, count }) => (
            <Box
              key={category}
              sx={{
                fontSize: '0.5rem',
                lineHeight: 1.2,
                px: 0.3,
                py: 0.1,
                borderRadius: 0.3,
                border: '1px solid',
                borderColor: CATEGORY_CHIP_COLOR[category as HandoffCategory] ?? '#757575',
                color: CATEGORY_CHIP_COLOR[category as HandoffCategory] ?? '#757575',
                whiteSpace: 'nowrap',
              }}
            >
              {shortenCategory(category)}{count}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
