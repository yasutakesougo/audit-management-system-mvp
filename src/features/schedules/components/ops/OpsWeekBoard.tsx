/**
 * OpsWeekBoard — 1週間の運営負荷俯瞰ボード
 *
 * 責務:
 * - weekSummary (DaySummaryEntry[]) を map して OpsWeekDayCell を並べる
 * - 曜日ヘッダを表示
 * - onDayClick で daily への drilldown をトリガーする
 * - empty state 対応
 *
 * 「負荷把握」に特化: 週単位で偏りを発見できる俯瞰View
 */

import CalendarViewWeekIcon from '@mui/icons-material/CalendarViewWeek';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { type FC, useMemo } from 'react';

import type { DaySummaryEntry } from '../../domain/scheduleOps';
import type { DayLoadScore } from '../../domain/scheduleOpsLoadScore';
import { OpsWeekDayCell } from './OpsWeekDayCell';

// ─── Component ───────────────────────────────────────────────────────────────

export type OpsWeekBoardProps = {
  weekSummary: readonly DaySummaryEntry[];
  loadScores?: readonly DayLoadScore[];
  isLoading?: boolean;
  onDayClick?: (dateIso: string) => void;
};

export const OpsWeekBoard: FC<OpsWeekBoardProps> = ({
  weekSummary,
  loadScores,
  isLoading,
  onDayClick,
}) => {
  // Build lookup map for load scores
  const scoreMap = useMemo(() => {
    if (!loadScores) return new Map<string, DayLoadScore>();
    return new Map(loadScores.map((s) => [s.dateIso, s]));
  }, [loadScores]);
  // ─── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 1,
          }}
        >
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              height={180}
              sx={{ borderRadius: 1 }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  // ─── Empty State ──────────────────────────────────────────────────────────────
  if (weekSummary.length === 0) {
    return (
      <Box
        sx={{
          py: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        <CalendarViewWeekIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
        <Typography variant="body1" color="text.secondary">
          週間データがありません
        </Typography>
      </Box>
    );
  }

  // ─── Main Board ─────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',     // モバイル: 2列
            sm: 'repeat(4, 1fr)',     // タブレット: 4列
            md: 'repeat(7, 1fr)',     // デスクトップ: 7列
          },
          gap: { xs: 1, sm: 1.5 },
        }}
      >
        {weekSummary.map((day) => (
          <OpsWeekDayCell
            key={day.dateIso}
            day={day}
            loadScore={scoreMap.get(day.dateIso)}
            onClick={onDayClick}
          />
        ))}
      </Box>
    </Box>
  );
};
