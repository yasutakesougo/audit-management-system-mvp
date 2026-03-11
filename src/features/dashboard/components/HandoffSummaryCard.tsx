/**
 * HandoffSummaryCard — 申し送りサマリー（導線特化）
 *
 * /dashboard の ACTION RAIL に配置する軽量カード。
 * 入力や時系列は見せず、「状況の要点 + 飛び先」だけを提供する。
 *
 * 責務:
 * - 件数・ステータスの俯瞰サマリー
 * - カテゴリ上位チップ
 * - /handoff-timeline への導線（日/週）
 *
 * 設計判断:
 * - CompactNewHandoffInput + HandoffLiveFeed を置換するために導入
 * - 「書かせず、流し読みさせず、飛ばす」カード
 */

import { buildHandoffTimelineUrl } from '@/app/links/navigationLinks';
import type { HandoffCategory, HandoffDayScope, HandoffStatus } from '@/features/handoff/handoffTypes';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CalendarViewWeekIcon from '@mui/icons-material/CalendarViewWeek';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import TimelineIcon from '@mui/icons-material/Timeline';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { Link } from 'react-router-dom';

// ── Types ──

export interface HandoffSummaryCardProps {
  /** 申し送り総件数 */
  total: number;
  /** ステータス別件数 */
  byStatus: Record<HandoffStatus, number>;
  /** 重要 × 未完了件数 */
  criticalCount: number;
  /** カテゴリ別件数 */
  byCategory: Record<HandoffCategory, number>;
  /** タイムラインへ遷移するコールバック（state 経由の互換用） */
  onOpenTimeline?: (scope: HandoffDayScope) => void;
}

// ── Helpers ──

/** カテゴリ別件数から上位 N カテゴリを抽出 */
function topCategories(
  byCategory: Record<string, number>,
  maxCount: number,
): Array<{ category: string; count: number }> {
  return Object.entries(byCategory)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([category, count]) => ({ category, count }));
}

/** 事故・ヒヤリの有無チェック */
const INCIDENT_KEY = '事故・ヒヤリ';
function hasIncidentCategory(byCategory: Record<string, number>): boolean {
  const count = byCategory[INCIDENT_KEY];
  return (count || 0) > 0;
}

// ── Component ──

export const HandoffSummaryCard: React.FC<HandoffSummaryCardProps> = ({
  total,
  byStatus,
  criticalCount,
  byCategory,
  onOpenTimeline,
}) => {
  const theme = useTheme();

  const pending = byStatus['未対応'] ?? 0;
  const inProgress = byStatus['対応中'] ?? 0;
  const hasIncident = hasIncidentCategory(byCategory);
  const tops = topCategories(byCategory, 3);

  const timelineUrl = buildHandoffTimelineUrl();
  const weekUrl = buildHandoffTimelineUrl({ range: 'week' });

  return (
    <Box
      data-testid="handoff-summary-card"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {/* ── Header ── */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={0.75} alignItems="center">
          <TimelineIcon
            fontSize="small"
            sx={{ color: 'text.secondary', opacity: 0.7 }}
          />
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, lineHeight: 1.3 }}
          >
            申し送り
          </Typography>
        </Stack>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', opacity: 0.7 }}
        >
          今日
        </Typography>
      </Stack>

      {/* ── KPI Row ── */}
      {total > 0 ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={`計 ${total}件`}
            variant="outlined"
            sx={{ height: 24, fontSize: '0.72rem' }}
          />
          <Chip
            size="small"
            label={`未対応 ${pending}`}
            color={pending > 0 ? 'warning' : 'default'}
            variant={pending > 0 ? 'filled' : 'outlined'}
            sx={{ height: 24, fontSize: '0.72rem' }}
          />
          {inProgress > 0 && (
            <Chip
              size="small"
              label={`対応中 ${inProgress}`}
              color="info"
              variant="filled"
              sx={{ height: 24, fontSize: '0.72rem' }}
            />
          )}
          {criticalCount > 0 && (
            <Chip
              size="small"
              label={`重要 ${criticalCount}`}
              color="error"
              variant="filled"
              sx={{ height: 24, fontSize: '0.72rem' }}
            />
          )}
        </Stack>
      ) : (
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', opacity: 0.8, py: 0.5 }}
        >
          今日の申し送りはまだありません
        </Typography>
      )}

      {/* ── 事故・ヒヤリ警告 ── */}
      {hasIncident && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.75,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.error.main, 0.08),
            border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
          }}
        >
          <ErrorOutlineIcon
            sx={{ fontSize: 16, color: theme.palette.error.main }}
          />
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.error.main,
              fontWeight: 600,
              lineHeight: 1.3,
            }}
          >
            事故・ヒヤリ {byCategory[INCIDENT_KEY]}件
          </Typography>
        </Box>
      )}

      {/* ── カテゴリチップ ── */}
      {tops.length > 0 && (
        <Stack spacing={0.5}>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', opacity: 0.7, fontWeight: 600 }}
          >
            多いカテゴリ
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {tops.map(({ category, count }) => (
              <Chip
                key={category}
                size="small"
                label={`${category} ${count}`}
                variant="outlined"
                sx={{
                  height: 22,
                  fontSize: '0.68rem',
                  borderColor: alpha(theme.palette.text.primary, 0.15),
                }}
              />
            ))}
          </Stack>
        </Stack>
      )}

      {/* ── 導線ボタン ── */}
      <Stack spacing={0.75}>
        <Button
          variant="contained"
          size="small"
          component={Link}
          to={timelineUrl}
          endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
          onClick={() => onOpenTimeline?.('today')}
          sx={{
            fontSize: '0.75rem',
            py: 0.5,
            textTransform: 'none',
          }}
        >
          タイムラインを開く
        </Button>
        <Button
          variant="text"
          size="small"
          component={Link}
          to={weekUrl}
          startIcon={<CalendarViewWeekIcon sx={{ fontSize: 14 }} />}
          sx={{
            fontSize: '0.7rem',
            py: 0.25,
            textTransform: 'none',
            color: 'text.secondary',
          }}
        >
          週で俯瞰する
        </Button>
      </Stack>
    </Box>
  );
};
