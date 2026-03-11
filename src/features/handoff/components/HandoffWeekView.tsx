/**
 * HandoffWeekView — 週ビューの7日カード表示
 *
 * 各日をカードで表示し、件数・未対応件数を一覧できる。
 * 日カードクリックで range=day&date=… の日ビューへ遷移する。
 */

import {
  Alert,
  Box,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { WeekDaySummary, WeekSummary } from '../hooks/useHandoffWeekViewModel';

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

export interface HandoffWeekViewProps {
  /** 週サマリーデータ */
  summary: WeekSummary;
  /** ローディング中 */
  loading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** 日カードクリック時の遷移コールバック */
  onDayClick: (date: string) => void;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function HandoffWeekView({
  summary,
  loading,
  error,
  onDayClick,
}: HandoffWeekViewProps) {
  const theme = useTheme();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box data-testid="handoff-week-view">
      {/* ── 週サマリーバー ── */}
      <Box
        sx={{
          mb: 2.5,
          px: 2,
          py: 1,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.06),
          border: '1px solid',
          borderColor: alpha(theme.palette.primary.main, 0.15),
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          📅 週の概況
        </Typography>
        <Chip
          size="small"
          label={`全 ${summary.totalCount} 件`}
          variant="outlined"
        />
        {summary.criticalCount > 0 && (
          <Chip
            size="small"
            label={`重要 ${summary.criticalCount}`}
            color="error"
          />
        )}
        {summary.unhandledCount > 0 && (
          <Chip
            size="small"
            label={`未対応 ${summary.unhandledCount}`}
            color="warning"
          />
        )}
        {!summary.hasAnyItems && (
          <Typography variant="body2" color="text.secondary">
            この週の申し送りはありません
          </Typography>
        )}
      </Box>

      {/* ── 7日グリッド ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(4, 1fr)',
            md: 'repeat(7, 1fr)',
          },
          gap: 1.5,
        }}
      >
        {summary.days.map((day) => (
          <DayCard key={day.date} day={day} onDayClick={onDayClick} />
        ))}
      </Box>
    </Box>
  );
}

// ────────────────────────────────────────────────────────────
// DayCard (internal)
// ────────────────────────────────────────────────────────────

function DayCard({
  day,
  onDayClick,
}: {
  day: WeekDaySummary;
  onDayClick: (date: string) => void;
}) {
  const theme = useTheme();
  const disabled = day.isFuture;

  // 背景色の決定
  const getBgColor = () => {
    if (day.isFuture) return alpha(theme.palette.action.disabledBackground, 0.3);
    if (day.isToday) return alpha(theme.palette.primary.main, 0.08);
    if (day.count === 0) return theme.palette.background.paper;
    return theme.palette.background.paper;
  };

  // ボーダー色の決定
  const getBorderColor = () => {
    if (day.isToday) return theme.palette.primary.main;
    if (day.criticalCount > 0) return theme.palette.error.light;
    if (day.unhandledCount > 0) return theme.palette.warning.light;
    return theme.palette.divider;
  };

  return (
    <Card
      variant="outlined"
      data-testid={`handoff-week-day-${day.date}`}
      sx={{
        bgcolor: getBgColor(),
        borderColor: getBorderColor(),
        borderWidth: day.isToday ? 2 : 1,
        opacity: disabled ? 0.5 : 1,
        transition: 'box-shadow 0.15s, border-color 0.15s',
        '&:hover': disabled
          ? {}
          : {
              boxShadow: theme.shadows[3],
              borderColor: theme.palette.primary.main,
            },
      }}
    >
      <CardActionArea
        disabled={disabled}
        onClick={() => onDayClick(day.date)}
        sx={{ p: 1.5, textAlign: 'center' }}
        data-testid={`handoff-week-day-btn-${day.date}`}
      >
        {/* 日付ラベル */}
        <Typography
          variant="body2"
          sx={{
            fontWeight: day.isToday ? 700 : 500,
            color: day.isToday ? 'primary.main' : 'text.primary',
            mb: 0.5,
            fontSize: '0.85rem',
          }}
        >
          {day.label}
        </Typography>

        {/* 件数 */}
        <Typography
          variant="h5"
          component="div"
          sx={{
            fontWeight: 700,
            lineHeight: 1.2,
            color: day.count === 0
              ? 'text.disabled'
              : day.criticalCount > 0
                ? 'error.main'
                : 'text.primary',
          }}
        >
          {day.isFuture ? '—' : day.count}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: '0.7rem' }}
        >
          {day.isFuture ? '' : '件'}
        </Typography>

        {/* 未対応 / 重要バッジ */}
        {!day.isFuture && (day.unhandledCount > 0 || day.criticalCount > 0) && (
          <Stack
            direction="row"
            spacing={0.5}
            justifyContent="center"
            sx={{ mt: 0.75 }}
          >
            {day.criticalCount > 0 && (
              <Chip
                size="small"
                label={`重要${day.criticalCount}`}
                color="error"
                sx={{ height: 20, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
              />
            )}
            {day.unhandledCount > 0 && (
              <Chip
                size="small"
                label={`未対応${day.unhandledCount}`}
                color="warning"
                sx={{ height: 20, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
              />
            )}
          </Stack>
        )}

        {/* 今日マーカー */}
        {day.isToday && (
          <Chip
            size="small"
            label="今日"
            color="primary"
            sx={{
              mt: 0.5,
              height: 18,
              fontSize: '0.6rem',
              '& .MuiChip-label': { px: 0.5 },
            }}
          />
        )}
      </CardActionArea>
    </Card>
  );
}
