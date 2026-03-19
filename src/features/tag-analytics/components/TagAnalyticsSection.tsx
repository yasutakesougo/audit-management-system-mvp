/**
 * @fileoverview Phase F1.5: TagAnalyticsSection — 行動タグ分析 UI コンポーネント
 * @description
 * - Top Tags（Chip 表示）
 * - Trend（↑↓バッジ）
 * - Period Preset 切替（7d / 30d / 90d）
 * - Empty（データなしメッセージ）
 * - Error（Alert）
 *
 * Period Preset は内部 state で管理し、onPeriodChange で
 * 親に通知する。これにより UserDetailPage / PlanningSheetPage
 * の両方で同じ UI を再利用できる。
 */
import React from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingFlatRoundedIcon from '@mui/icons-material/TrendingFlatRounded';

import { EmptyStateAction } from '@/components/ui/EmptyStateAction';
import type { TagAnalytics } from '../hooks/useTagAnalytics';
import {
  type TagTrendItem,
  type PeriodPreset,
  PERIOD_PRESETS,
  PERIOD_PRESET_ORDER,
} from '../domain/tagAnalytics';
import { TrendAlertsBanner } from './TrendAlertsBanner';
import { PlanningSuggestionsCard } from './PlanningSuggestionsCard';
import { buildPlanningSuggestions } from '../domain/planningSuggestions';

// ─── Props ───────────────────────────────────────────────

type TagAnalyticsSectionProps = {
  analytics: TagAnalytics;
  /** 現在選択中のプリセット */
  periodPreset?: PeriodPreset;
  /** プリセット変更時のコールバック */
  onPeriodChange?: (preset: PeriodPreset) => void;
  /** プリセット切替UIを非表示にする（Accordion 内など） */
  hidePeriodSelector?: boolean;
  /** F3: Planning 示唆を表示するか（PlanningSheetPage 用） */
  showSuggestions?: boolean;
};

// ─── Main Component ──────────────────────────────────────

export const TagAnalyticsSection: React.FC<TagAnalyticsSectionProps> = ({
  analytics,
  periodPreset = '30d',
  onPeriodChange,
  hidePeriodSelector = false,
  showSuggestions = false,
}) => {
  // ── Loading ──
  if (analytics.status === 'loading') {
    return (
      <Box data-testid="tag-analytics-loading" sx={{ textAlign: 'center', py: 3 }}>
        <CircularProgress size={24} />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          タグ分析を読み込み中...
        </Typography>
      </Box>
    );
  }

  // ── Error ──
  if (analytics.status === 'error') {
    return (
      <Alert severity="error" data-testid="tag-analytics-error" sx={{ borderRadius: 2 }}>
        タグ分析の取得に失敗しました: {analytics.error ?? '不明なエラー'}
      </Alert>
    );
  }

  // ── Empty ──
  if (analytics.status === 'empty') {
    return (
      <Stack spacing={1.5}>
        {!hidePeriodSelector && onPeriodChange && (
          <PeriodSelector current={periodPreset} onChange={onPeriodChange} />
        )}
        <EmptyStateAction
          icon="🏷️"
          title="タグデータがありません"
          description="記録に行動タグを付けると、ここに傾向分析が表示されます。"
          variant="info"
          minHeight="6vh"
          testId="tag-analytics-empty"
        />
      </Stack>
    );
  }

  // ── Ready ──
  return (
    <Stack spacing={2} data-testid="tag-analytics-ready">
      {/* Period Selector */}
      {!hidePeriodSelector && onPeriodChange && (
        <PeriodSelector current={periodPreset} onChange={onPeriodChange} />
      )}

      {/* F2: Trend Alerts */}
      {analytics.trendAlerts.hasAlerts && (
        <TrendAlertsBanner alerts={analytics.trendAlerts} />
      )}

      {/* F3: Planning Suggestions */}
      {showSuggestions && analytics.trendAlerts.hasAlerts && (
        <PlanningSuggestionsCard
          suggestions={buildPlanningSuggestions(analytics.trendAlerts.all)}
        />
      )}

      {/* Top Tags */}
      <TopTagsCard topTags={analytics.topTags} trend={analytics.trend} />

      {/* Time Slot Distribution */}
      {(Object.keys(analytics.timeSlots.am).length > 0 ||
        Object.keys(analytics.timeSlots.pm).length > 0) && (
        <TimeSlotCard
          am={analytics.timeSlots.am}
          pm={analytics.timeSlots.pm}
        />
      )}
    </Stack>
  );
};

// ─── Period Selector ─────────────────────────────────────

type PeriodSelectorProps = {
  current: PeriodPreset;
  onChange: (preset: PeriodPreset) => void;
};

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ current, onChange }) => (
  <Box data-testid="tag-analytics-period-selector">
    <ToggleButtonGroup
      value={current}
      exclusive
      onChange={(_e, val) => {
        if (val !== null) onChange(val as PeriodPreset);
      }}
      size="small"
      sx={{
        '& .MuiToggleButton-root': {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.75rem',
          px: 1.5,
          py: 0.5,
          borderRadius: 1,
          '&.Mui-selected': {
            bgcolor: 'primary.main',
            color: '#fff',
            '&:hover': { bgcolor: 'primary.dark' },
          },
        },
      }}
    >
      {PERIOD_PRESET_ORDER.map((key) => (
        <ToggleButton key={key} value={key} data-testid={`period-preset-${key}`}>
          {PERIOD_PRESETS[key].label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  </Box>
);

// ─── Sub Components ──────────────────────────────────────

type TopTagsCardProps = {
  topTags: TagAnalytics['topTags'];
  trend: TagAnalytics['trend'];
};

const TREND_ICON: Record<TagTrendItem['direction'], React.ReactNode> = {
  up: <TrendingUpRoundedIcon sx={{ fontSize: 14, color: '#d32f2f' }} />,
  down: <TrendingDownRoundedIcon sx={{ fontSize: 14, color: '#388e3c' }} />,
  flat: <TrendingFlatRoundedIcon sx={{ fontSize: 14, color: '#757575' }} />,
};

const TREND_COLORS: Record<TagTrendItem['direction'], string> = {
  up: '#d32f2f',
  down: '#388e3c',
  flat: '#757575',
};

const TopTagsCard: React.FC<TopTagsCardProps> = ({ topTags, trend }) => (
  <Paper
    variant="outlined"
    sx={{ p: 2, borderRadius: 2 }}
    data-testid="tag-analytics-top-tags"
  >
    <Typography
      variant="subtitle2"
      sx={{ fontWeight: 700, mb: 1.5 }}
    >
      📊 よく記録されるタグ
    </Typography>
    <Stack spacing={1}>
      {topTags.map((tag) => {
        const trendItem = trend[tag.key];
        return (
          <Stack
            key={tag.key}
            direction="row"
            alignItems="center"
            spacing={1}
            data-testid={`tag-rank-${tag.key}`}
          >
            <Chip
              label={tag.label}
              size="small"
              sx={{
                bgcolor: getCategoryColor(tag.category),
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.72rem',
                height: 24,
              }}
            />
            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 30 }}>
              {tag.count}回
            </Typography>
            {/* Trend badge */}
            {trendItem && trendItem.direction !== 'flat' && (
              <Stack
                direction="row"
                alignItems="center"
                spacing={0.25}
                data-testid={`tag-trend-${tag.key}`}
              >
                {TREND_ICON[trendItem.direction]}
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: TREND_COLORS[trendItem.direction],
                    fontSize: '0.68rem',
                  }}
                >
                  {trendItem.diff > 0 ? '+' : ''}{trendItem.diff}
                </Typography>
              </Stack>
            )}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.65rem' }}
            >
              {tag.categoryLabel}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  </Paper>
);

type TimeSlotCardProps = {
  am: Record<string, number>;
  pm: Record<string, number>;
};

const TimeSlotCard: React.FC<TimeSlotCardProps> = ({ am, pm }) => {
  const amTags = Object.entries(am)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const pmTags = Object.entries(pm)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (amTags.length === 0 && pmTags.length === 0) return null;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, borderRadius: 2 }}
      data-testid="tag-analytics-time-slots"
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        🕐 時間帯別タグ
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 2,
        }}
      >
        {/* AM */}
        <Box>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: '#ed6c02', mb: 0.5, display: 'block' }}
          >
            🌅 午前
          </Typography>
          {amTags.length > 0 ? (
            <Stack spacing={0.5}>
              {amTags.map(([key, count]) => (
                <Stack key={key} direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
                    {getTagLabel(key)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {count}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">—</Typography>
          )}
        </Box>

        {/* PM */}
        <Box>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: '#1976d2', mb: 0.5, display: 'block' }}
          >
            🌇 午後
          </Typography>
          {pmTags.length > 0 ? (
            <Stack spacing={0.5}>
              {pmTags.map(([key, count]) => (
                <Stack key={key} direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
                    {getTagLabel(key)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {count}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">—</Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

// ─── ヘルパー ────────────────────────────────────────────

import { BEHAVIOR_TAGS, type BehaviorTagKey } from '@/features/daily/domain/behaviorTag';

function getTagLabel(key: string): string {
  const def = BEHAVIOR_TAGS[key as BehaviorTagKey];
  return def?.label ?? key;
}

const CATEGORY_COLORS: Record<string, string> = {
  behavior: '#d32f2f',
  communication: '#1976d2',
  dailyLiving: '#ed6c02',
  positive: '#388e3c',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? '#757575';
}
