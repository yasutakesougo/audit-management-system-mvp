/**
 * StrategyUsageBadge — 戦略の実施回数バッジ
 *
 * ChipInput の各戦略チップの横に表示して、
 * その戦略が直近 N 日間で何回実施されたかを示す。
 *
 * Phase C-3a
 *
 * @module features/planning-sheet/components/StrategyUsageBadge
 */

import type { StrategyCategory } from '@/domain/behavior';
import type { StrategyUsageSummary } from '@/domain/isp/aggregateStrategyUsage';
import { getUsageCount, getCategoryTotal } from '@/domain/isp/aggregateStrategyUsage';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type React from 'react';

// ─────────────────────────────────────────────
// カテゴリ別の色テーマ
// ─────────────────────────────────────────────

const CATEGORY_COLORS: Record<StrategyCategory, { bg: string; text: string; border: string }> = {
  antecedent: { bg: '#e3f2fd', text: '#1565c0', border: '#90caf9' },
  teaching: { bg: '#f3e5f5', text: '#7b1fa2', border: '#ce93d8' },
  consequence: { bg: '#fff3e0', text: '#e65100', border: '#ffb74d' },
};

const CATEGORY_LABELS: Record<StrategyCategory, string> = {
  antecedent: '先行事象戦略',
  teaching: '教授戦略',
  consequence: '後続事象戦略',
};

// ─────────────────────────────────────────────
// 個別バッジ（チップの横）
// ─────────────────────────────────────────────

interface StrategyItemBadgeProps {
  /** 戦略テキスト */
  text: string;
  /** カテゴリ */
  category: StrategyCategory;
  /** 集計結果 */
  summary: StrategyUsageSummary | null;
  /** 集計日数 */
  days?: number;
}

/**
 * 個別戦略の実施回数を小さなバッジで表示。
 * 0 回の場合は非表示。
 */
export const StrategyItemBadge: React.FC<StrategyItemBadgeProps> = ({
  text,
  category,
  summary,
  days = 30,
}) => {
  if (!summary) return null;

  const count = getUsageCount(summary, category, text);
  if (count === 0) return null;

  const colors = CATEGORY_COLORS[category];

  return (
    <Tooltip title={`直近${days}日間で${count}回実施`} arrow placement="top">
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 20,
          height: 20,
          px: 0.5,
          borderRadius: '10px',
          bgcolor: colors.bg,
          color: colors.text,
          border: `1px solid ${colors.border}`,
          fontSize: '0.7rem',
          fontWeight: 700,
          lineHeight: 1,
          ml: 0.5,
        }}
      >
        {count}
      </Box>
    </Tooltip>
  );
};

// ─────────────────────────────────────────────
// カテゴリサマリー行（セクションラベル横）
// ─────────────────────────────────────────────

interface CategoryUsageSummaryProps {
  /** カテゴリ */
  category: StrategyCategory;
  /** 集計結果 */
  summary: StrategyUsageSummary | null;
  /** 集計日数 */
  days?: number;
}

/**
 * カテゴリ全体の実施回数&ユニーク数をコンパクトに表示。
 */
export const CategoryUsageSummary: React.FC<CategoryUsageSummaryProps> = ({
  category,
  summary,
  days = 30,
}) => {
  if (!summary) return null;

  const total = getCategoryTotal(summary, category);
  if (total === 0) return null;

  const map =
    category === 'antecedent'
      ? summary.antecedent
      : category === 'teaching'
        ? summary.teaching
        : summary.consequence;
  const uniqueCount = map.size;

  const colors = CATEGORY_COLORS[category];
  const label = CATEGORY_LABELS[category];

  return (
    <Tooltip
      title={`直近${days}日間: ${label}が${total}回（${uniqueCount}種類）実施されました`}
      arrow
      placement="right"
    >
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          py: 0.25,
          px: 1,
          borderRadius: '12px',
          bgcolor: colors.bg,
          border: `1px solid ${colors.border}`,
          cursor: 'default',
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: colors.text, fontWeight: 600, fontSize: '0.7rem' }}
        >
          📊 {total}回
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: colors.text, opacity: 0.7, fontSize: '0.65rem' }}
        >
          ({uniqueCount}種)
        </Typography>
      </Box>
    </Tooltip>
  );
};

// ─────────────────────────────────────────────
// 全体サマリー行
// ─────────────────────────────────────────────

interface StrategyUsageOverviewProps {
  /** 集計結果 */
  summary: StrategyUsageSummary | null;
  /** 集計日数 */
  days?: number;
  /** ロード中 */
  loading?: boolean;
}

/**
 * 戦略全体の実施状況をひと目で表示するコンパクトバー。
 */
export const StrategyUsageOverview: React.FC<StrategyUsageOverviewProps> = ({
  summary,
  days = 30,
  loading = false,
}) => {
  if (loading) {
    return (
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1 }}>
        📊 実施データ読み込み中…
      </Typography>
    );
  }

  if (!summary || summary.totalApplications === 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 0.75,
        px: 1.5,
        mb: 1,
        borderRadius: 2,
        bgcolor: 'rgba(0,0,0,0.03)',
        border: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
        📊 直近{days}日の実施状況
      </Typography>
      <Typography variant="caption" color="text.secondary">
        計{summary.totalApplications}回 ・ {summary.recordsWithStrategies}件の記録
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', ml: 'auto' }}>
        ※日常支援記録の実施データ
      </Typography>
    </Box>
  );
};
