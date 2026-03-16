/**
 * 利用者傾向カード
 *
 * Phase 1-B computeUserTrends の結果を一覧で表示する。
 * 件数・トレンド・カテゴリ・重要度を一目で把握可能。
 */

import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import PeopleIcon from '@mui/icons-material/People';
import RemoveIcon from '@mui/icons-material/Remove';
import Avatar from '@mui/material/Avatar';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { TrendDirection, UserTrend } from '../analysisTypes';

// ── トレンド表示 ──

const TREND_CONFIG: Record<TrendDirection, {
  icon: React.ReactElement;
  label: string;
  color: 'error' | 'success' | 'default';
}> = {
  increasing: { icon: <ArrowUpwardIcon sx={{ fontSize: 14 }} />, label: '増加', color: 'error' },
  decreasing: { icon: <ArrowDownwardIcon sx={{ fontSize: 14 }} />, label: '減少', color: 'success' },
  stable:     { icon: <RemoveIcon sx={{ fontSize: 14 }} />, label: '安定', color: 'default' },
};

// ── Props ──

interface UserTrendCardProps {
  trends: UserTrend[];
  maxItems?: number;
}

export default function UserTrendCard({ trends, maxItems = 8 }: UserTrendCardProps) {
  const topTrends = trends.slice(0, maxItems);

  if (topTrends.length === 0) {
    return (
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <PeopleIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>利用者別傾向</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 3 }}>
            分析対象の申し送りがありません
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <PeopleIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>利用者別傾向</Typography>
          <Typography variant="caption" color="text.secondary">
            上位{topTrends.length}名
          </Typography>
        </Stack>

        <Stack spacing={1.5}>
          {topTrends.map((trend, index) => {
            const trendConfig = TREND_CONFIG[trend.recentTrend];
            const totalSeverity = trend.severityDistribution['通常']
              + trend.severityDistribution['要注意']
              + trend.severityDistribution['重要'];
            const importantRatio = totalSeverity > 0
              ? (trend.severityDistribution['重要'] + trend.severityDistribution['要注意']) / totalSeverity
              : 0;

            return (
              <Stack
                key={trend.userCode}
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{
                  py: 1,
                  px: 1.5,
                  borderRadius: 1,
                  bgcolor: index === 0 ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                {/* アバター（件数表示） */}
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    bgcolor: importantRatio > 0.3 ? 'error.main' : 'primary.main',
                  }}
                >
                  {trend.totalMentions}
                </Avatar>

                {/* 利用者情報 */}
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={index < 3 ? 700 : 500} noWrap>
                    {trend.userDisplayName}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                    {trend.topCategories.slice(0, 2).map((tc) => (
                      <Typography key={tc.category} variant="caption" color="text.secondary">
                        {tc.category}({tc.count})
                      </Typography>
                    ))}
                  </Stack>
                </Stack>

                {/* キーワード（上位1語） */}
                {trend.topKeywords.length > 0 && (
                  <Chip
                    label={trend.topKeywords[0].keyword}
                    size="small"
                    variant="outlined"
                    sx={{ height: 22, fontSize: '0.7rem', maxWidth: 80 }}
                  />
                )}

                {/* トレンド */}
                <Chip
                  icon={trendConfig.icon}
                  label={trendConfig.label}
                  size="small"
                  color={trendConfig.color}
                  variant={trend.recentTrend === 'increasing' ? 'filled' : 'outlined'}
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />

                {/* 重要度サマリー */}
                {trend.severityDistribution['重要'] > 0 && (
                  <Chip
                    label={`重要${trend.severityDistribution['重要']}`}
                    size="small"
                    color="error"
                    variant="filled"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
              </Stack>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
