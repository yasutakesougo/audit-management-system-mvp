import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import type { BehaviorTagSummary } from '../../domain/monitoringDailyAnalytics';
import { SectionTitle } from './SectionTitle';
import { TREND_LABEL, TAG_CATEGORY_COLORS } from './constants';

export const BehaviorTagSection: React.FC<{ tagSummary: BehaviorTagSummary }> = ({ tagSummary }) => {
  const TrendIcon =
    tagSummary.usageTrend === 'up'
      ? TrendingUpIcon
      : tagSummary.usageTrend === 'down'
        ? TrendingDownIcon
        : TrendingFlatIcon;

  return (
    <Box>
      <SectionTitle>
        <LocalOfferIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
        行動タグ分析
      </SectionTitle>

      {/* Top タグ */}
      <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5} sx={{ mt: 0.5 }}>
        {tagSummary.topTags.map((t) => (
          <Chip
            key={t.key}
            label={`${t.label} (${t.count}回)`}
            size="small"
            color={TAG_CATEGORY_COLORS[t.category ?? ''] ?? 'default'}
            variant="outlined"
            sx={{ maxWidth: 200 }}
          />
        ))}
      </Stack>

      {/* 付与率 */}
      <Box sx={{ mt: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>
            タグ付与率
          </Typography>
          <LinearProgress
            variant="determinate"
            value={tagSummary.tagUsageRate}
            sx={{ flex: 1 }}
          />
          <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 45 }}>
            {tagSummary.tagUsageRate}%
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, display: 'block' }}>
          {tagSummary.taggedRecords}件の記録にタグ付与あり（全{tagSummary.totalRecords}件中）、平均{tagSummary.avgTagsPerRecord}タグ/日
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
          ※ 日々の記録で行動タグがどれだけ活用されているかの指標です
        </Typography>
      </Box>

      {/* カテゴリ分布 */}
      {tagSummary.categoryDistribution.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            カテゴリ別分布
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5} sx={{ mt: 0.3 }}>
            {tagSummary.categoryDistribution.map((c) => (
              <Chip
                key={c.category}
                label={`${c.label} ${c.percentage}%`}
                size="small"
                color={TAG_CATEGORY_COLORS[c.category] ?? 'default'}
                variant="filled"
                sx={{ fontSize: '0.7rem', maxWidth: 180 }}
              />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, display: 'block', fontSize: '0.65rem' }}>
            ※ 全タグ付与数に対する各カテゴリの割合
          </Typography>
        </Box>
      )}

      {/* トレンド */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
        <TrendIcon fontSize="small" color={tagSummary.usageTrend === 'up' ? 'success' : 'inherit'} />
        <Typography variant="caption" color="text.secondary">
          {TREND_LABEL[tagSummary.usageTrend] || '横ばい'}
          {tagSummary.usageTrendRate !== 0 && ` (${tagSummary.usageTrendRate > 0 ? '+' : ''}${tagSummary.usageTrendRate}%)`}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', ml: 0.5 }}>
          ※ 前半/後半比較
        </Typography>
      </Stack>
    </Box>
  );
};
