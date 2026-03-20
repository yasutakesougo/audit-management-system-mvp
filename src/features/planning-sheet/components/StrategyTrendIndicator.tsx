/**
 * StrategyTrendIndicator — 前期間との比較トレンド表示
 *
 * 各戦略の横に `↑ +2` `↓ -1` `→ 0` を表示する。
 * カテゴリ見出し横にサマリーを出す。
 * 期間セレクタも含む。
 *
 * Phase C-3b Step 3
 *
 * @module features/planning-sheet/components/StrategyTrendIndicator
 */

import type { StrategyCategory } from '@/domain/behavior';
import type {
  StrategyTrend,
  StrategyUsageTrendItem,
  StrategyUsageTrendResult,
} from '@/domain/isp/aggregateStrategyUsage';
import {
  TREND_DAYS_LABELS,
  TREND_DAYS_OPTIONS,
  type TrendDays,
} from '@/features/planning-sheet/hooks/useStrategyUsageTrend';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type React from 'react';

// ─────────────────────────────────────────────
// トレンドの色・アイコン
// ─────────────────────────────────────────────

const TREND_CONFIG: Record<StrategyTrend, { icon: string; color: string; label: string }> = {
  up: { icon: '↑', color: '#2e7d32', label: '増加' },
  down: { icon: '↓', color: '#c62828', label: '減少' },
  flat: { icon: '→', color: '#757575', label: '横ばい' },
};

// ─────────────────────────────────────────────
// 個別トレンドバッジ（戦略チップ横）
// ─────────────────────────────────────────────

interface StrategyTrendBadgeProps {
  /** 戦略テキスト */
  text: string;
  /** カテゴリ */
  category: StrategyCategory;
  /** トレンド結果 */
  trendResult: StrategyUsageTrendResult | null;
}

/**
 * 戦略テキストに対応するトレンドバッジ。
 * currentCount + 前期間比を表示。
 * 該当なしなら非表示。
 */
export const StrategyTrendBadge: React.FC<StrategyTrendBadgeProps> = ({
  text,
  category,
  trendResult,
}) => {
  if (!trendResult) return null;

  const item = trendResult.items.find(
    (i: StrategyUsageTrendItem) => i.strategyKey === category && i.strategyText === text,
  );
  if (!item || (item.currentCount === 0 && item.previousCount === 0)) return null;

  const config = TREND_CONFIG[item.trend];
  const deltaText = item.delta > 0 ? `+${item.delta}` : `${item.delta}`;

  return (
    <Tooltip
      title={`今期: ${item.currentCount}回 / 前期: ${item.previousCount}回（${config.label}${deltaText}）`}
      arrow
      placement="top"
    >
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.25,
          ml: 0.5,
          px: 0.5,
          py: 0.125,
          borderRadius: '8px',
          bgcolor: item.trend === 'flat' ? 'transparent' : `${config.color}10`,
          fontSize: '0.65rem',
          fontWeight: 700,
          lineHeight: 1,
          color: config.color,
          cursor: 'default',
        }}
      >
        <span>{config.icon}</span>
        <span>{deltaText}</span>
      </Box>
    </Tooltip>
  );
};

// ─────────────────────────────────────────────
// カテゴリトレンドサマリー（見出し横）
// ─────────────────────────────────────────────

const CATEGORY_LABELS: Record<StrategyCategory, string> = {
  antecedent: '先行事象戦略',
  teaching: '教授戦略',
  consequence: '後続事象戦略',
};

interface CategoryTrendSummaryProps {
  /** カテゴリ */
  category: StrategyCategory;
  /** トレンド結果 */
  trendResult: StrategyUsageTrendResult | null;
  /** 集計日数 */
  days?: TrendDays;
}

/**
 * カテゴリ見出し横に前期間比サマリーを表示。
 */
export const CategoryTrendSummary: React.FC<CategoryTrendSummaryProps> = ({
  category,
  trendResult,
  days = 30,
}) => {
  if (!trendResult) return null;

  // カテゴリ内の items を集計
  const categoryItems = trendResult.items.filter(
    (i: StrategyUsageTrendItem) => i.strategyKey === category,
  );
  if (categoryItems.length === 0) return null;

  const currentTotal = categoryItems.reduce((sum, i) => sum + i.currentCount, 0);
  const previousTotal = categoryItems.reduce((sum, i) => sum + i.previousCount, 0);
  const delta = currentTotal - previousTotal;
  const trend: StrategyTrend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const config = TREND_CONFIG[trend];
  const deltaText = delta > 0 ? `+${delta}` : `${delta}`;
  const label = CATEGORY_LABELS[category];

  return (
    <Tooltip
      title={`${label} 直近${days}日: ${currentTotal}回 / 前${days}日: ${previousTotal}回`}
      arrow
      placement="right"
    >
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.25,
          ml: 1,
          px: 0.75,
          py: 0.25,
          borderRadius: '10px',
          bgcolor: trend === 'flat' ? 'rgba(0,0,0,0.04)' : `${config.color}08`,
          border: `1px solid ${trend === 'flat' ? 'rgba(0,0,0,0.08)' : `${config.color}20`}`,
          fontSize: '0.7rem',
          fontWeight: 600,
          color: config.color,
          cursor: 'default',
        }}
      >
        <span>{config.icon}</span>
        <span>前期比 {deltaText}</span>
      </Box>
    </Tooltip>
  );
};

// ─────────────────────────────────────────────
// 全体トレンドサマリー + 期間セレクタ
// ─────────────────────────────────────────────

interface TrendOverviewBarProps {
  /** トレンド結果 */
  trendResult: StrategyUsageTrendResult | null;
  /** 現在の集計日数 */
  days: TrendDays;
  /** 日数変更 */
  onDaysChange: (days: TrendDays) => void;
  /** ロード中 */
  loading?: boolean;
}

/**
 * 全体トレンドサマリーと期間セレクタのバー。
 * StrategyUsageOverview の下に配置する想定。
 */
export const TrendOverviewBar: React.FC<TrendOverviewBarProps> = ({
  trendResult,
  days,
  onDaysChange,
  loading = false,
}) => {
  if (loading) {
    return (
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
        📈 トレンドデータ読み込み中…
      </Typography>
    );
  }

  const handleDaysChange = (_: React.MouseEvent<HTMLElement>, value: TrendDays | null) => {
    if (value !== null) {
      onDaysChange(value);
    }
  };

  const totals = trendResult?.totals;
  const config = totals ? TREND_CONFIG[totals.trend] : TREND_CONFIG.flat;
  const deltaText = totals
    ? totals.delta > 0
      ? `+${totals.delta}`
      : `${totals.delta}`
    : '0';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 0.5,
        px: 1.5,
        mb: 1,
        borderRadius: 2,
        bgcolor: 'rgba(0,0,0,0.02)',
        border: '1px solid rgba(0,0,0,0.04)',
      }}
    >
      {/* 期間セレクタ */}
      <ToggleButtonGroup
        value={days}
        exclusive
        onChange={handleDaysChange}
        size="small"
        sx={{
          '& .MuiToggleButton-root': {
            py: 0.25,
            px: 1,
            fontSize: '0.7rem',
            fontWeight: 600,
            textTransform: 'none',
            borderColor: 'rgba(0,0,0,0.12)',
          },
          '& .Mui-selected': {
            bgcolor: 'primary.main',
            color: 'white',
            '&:hover': { bgcolor: 'primary.dark' },
          },
        }}
      >
        {TREND_DAYS_OPTIONS.map((d) => (
          <ToggleButton key={d} value={d}>
            {TREND_DAYS_LABELS[d]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* 全体トレンド */}
      {totals && (
        <>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            📈 前期間比
          </Typography>
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.25,
              px: 0.75,
              py: 0.25,
              borderRadius: '10px',
              bgcolor: totals.trend === 'flat' ? 'rgba(0,0,0,0.04)' : `${config.color}10`,
              fontSize: '0.75rem',
              fontWeight: 700,
              color: config.color,
            }}
          >
            {config.icon} {deltaText}
          </Box>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
            今期 {totals.currentCount}回 / 前期 {totals.previousCount}回
          </Typography>
        </>
      )}
    </Box>
  );
};
