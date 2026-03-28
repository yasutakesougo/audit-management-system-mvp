/**
 * @fileoverview 行動タグインサイトバー
 * @description
 * TableDailyRecordTable の上部に配置し、visibleRows のタグ使用状況を可視化する。
 * 全行タグなしの場合は何もレンダリングしない（導入初期のノイズ防止）。
 */

import InsightsIcon from '@mui/icons-material/Insights';
import { Box, Chip, Paper, Typography, alpha, useTheme } from '@mui/material';
import React, { useMemo } from 'react';
import {
  computeBehaviorTagInsights,
  type BehaviorTagInsightInput,
} from '../domain/behaviorTagInsights';

type BehaviorTagInsightBarProps = {
  rows: BehaviorTagInsightInput[];
};

export const BehaviorTagInsightBar: React.FC<BehaviorTagInsightBarProps> = ({ rows }) => {
  const theme = useTheme();

  const insights = useMemo(() => computeBehaviorTagInsights(rows), [rows]);

  if (!insights) return null;

  const srText = `上位タグ: ${insights.topTags.map(t => `${t.label}${t.count}件`).join('、')}。平均${insights.avgTagsPerRow}タグ、付与率${insights.tagUsageRate}%`;

  return (
    <Paper
      variant="outlined"
      role="status"
      aria-label={srText}
      sx={{
        px: 1.5,
        py: 0.75,
        mb: 0.5,
        bgcolor: alpha(theme.palette.info.main, 0.04),
        borderColor: alpha(theme.palette.info.main, 0.15),
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
        <InsightsIcon sx={{ fontSize: 14, color: 'info.main' }} />
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'info.main' }}>
          行動タグインサイト
        </Typography>
      </Box>

      {/* Top tags */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.25 }}>
          Top:
        </Typography>
        {insights.topTags.map(tag => (
          <Chip
            key={tag.key}
            label={`${tag.label}(${tag.count})`}
            size="small"
            variant="outlined"
            color="info"
            sx={{ height: 20, fontSize: '0.65rem' }}
          />
        ))}
      </Box>

      {/* Metrics */}
      <Typography variant="caption" color="text.secondary">
        平均 {insights.avgTagsPerRow} タグ/記録{'  ·  '}
        付与率 {insights.tagUsageRate}%（{insights.taggedRows}/{insights.totalRows}名）
      </Typography>
    </Paper>
  );
};
