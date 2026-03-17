/**
 * SuggestionMetricsBadge — 提案判断メトリクスの小型表示パネル
 *
 * P3-E: SmartTab / ExcellenceTab のヘッダーに配置し、
 * 永続化済みの判断メトリクスを要約表示する。
 *
 * 判断履歴がない場合は何も表示しない（null返却）。
 *
 * 表示内容:
 *  - 全体の判断件数
 *  - 採用率（SmartTab 向け）
 *  - 昇格率（改善メモ向け）
 *  - source 別内訳（Tooltip でドリルダウン）
 */
import React from 'react';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AssessmentIcon from '@mui/icons-material/Assessment';

import type { SuggestionDecisionMetrics } from '../../domain/suggestionDecisionMetrics';
import { formatRate, isMetricsEmpty } from '../../domain/suggestionDecisionMetrics';

// ────────────────────────────────────────────
// Props
// ────────────────────────────────────────────

export type SuggestionMetricsBadgeProps = {
  metrics: SuggestionDecisionMetrics;
  /** 表示モード: smart → 採用率中心、memo → 昇格率中心 */
  variant?: 'smart' | 'memo' | 'combined';
};

// ────────────────────────────────────────────
// Tooltip 内訳テキスト
// ────────────────────────────────────────────

function buildTooltipContent(metrics: SuggestionDecisionMetrics): string {
  const { sourceBreakdown } = metrics;
  const lines: string[] = [];

  lines.push(`判断済み: ${metrics.totalDecided}件`);
  lines.push('');

  // SmartTab
  const { smart } = sourceBreakdown;
  if (smart.accepted + smart.dismissed > 0) {
    lines.push('【SmartTab】');
    lines.push(`  採用: ${smart.accepted}件`);
    lines.push(`  見送り: ${smart.dismissed}件`);
    lines.push(`  採用率: ${formatRate(metrics.acceptanceRate)}`);
    lines.push('');
  }

  // 改善メモ
  const { memo } = sourceBreakdown;
  if (memo.noted + memo.deferred + memo.promoted > 0) {
    lines.push('【改善メモ】');
    lines.push(`  追記: ${memo.noted}件`);
    lines.push(`  保留: ${memo.deferred}件`);
    lines.push(`  昇格: ${memo.promoted}件`);
    lines.push(`  昇格率: ${formatRate(metrics.promotionRate)}`);
  }

  return lines.join('\n');
}

// ────────────────────────────────────────────
// コンポーネント
// ────────────────────────────────────────────

const SuggestionMetricsBadge: React.FC<SuggestionMetricsBadgeProps> = ({
  metrics,
  variant = 'combined',
}) => {
  if (isMetricsEmpty(metrics)) return null;

  return (
    <Tooltip
      title={
        <Typography variant="caption" sx={{ whiteSpace: 'pre-line' }}>
          {buildTooltipContent(metrics)}
        </Typography>
      }
      arrow
      placement="bottom"
    >
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        sx={{
          px: 1,
          py: 0.25,
          bgcolor: 'action.hover',
          borderRadius: 1,
          cursor: 'default',
        }}
      >
        <AssessmentIcon sx={{ fontSize: 14, color: 'text.secondary' }} />

        {/* 判断件数 */}
        <Chip
          label={`${metrics.totalDecided}件`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.65rem', height: 20, '.MuiChip-label': { px: 0.75 } }}
        />

        {/* SmartTab 系 — 採用率 */}
        {(variant === 'smart' || variant === 'combined') &&
          metrics.counts.accepted + metrics.counts.dismissed > 0 && (
            <Chip
              label={`採用 ${formatRate(metrics.acceptanceRate)}`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontSize: '0.65rem', height: 20, '.MuiChip-label': { px: 0.75 } }}
            />
          )}

        {/* 改善メモ系 — 昇格率 */}
        {(variant === 'memo' || variant === 'combined') &&
          metrics.counts.noted + metrics.counts.deferred + metrics.counts.promoted > 0 && (
            <Chip
              label={`昇格 ${formatRate(metrics.promotionRate)}`}
              size="small"
              color="info"
              variant="outlined"
              sx={{ fontSize: '0.65rem', height: 20, '.MuiChip-label': { px: 0.75 } }}
            />
          )}
      </Stack>
    </Tooltip>
  );
};

export default SuggestionMetricsBadge;
