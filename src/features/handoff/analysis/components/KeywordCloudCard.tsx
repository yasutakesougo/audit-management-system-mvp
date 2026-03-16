/**
 * 注目キーワードカード
 *
 * Phase 1-A extractKeywords の結果を上位10語のリストで表示する。
 * 各キーワードにカテゴリ色・件数・最新出現日を付与。
 */

import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { KeywordExtractionResult, KeywordCategory } from '../analysisTypes';

// ── カテゴリ色マッピング ──

const CATEGORY_COLORS: Record<KeywordCategory, {
  label: string;
  color: 'error' | 'warning' | 'info' | 'success' | 'secondary' | 'primary' | 'default';
}> = {
  health:   { label: '体調',   color: 'error' },
  behavior: { label: '行動',   color: 'warning' },
  family:   { label: '家族',   color: 'info' },
  positive: { label: '良好',   color: 'success' },
  risk:     { label: 'リスク', color: 'error' },
  daily:    { label: '日常',   color: 'primary' },
  support:  { label: '支援',   color: 'secondary' },
};

// ── Props ──

interface KeywordCloudCardProps {
  data: KeywordExtractionResult;
  maxItems?: number;
}

export default function KeywordCloudCard({ data, maxItems = 10 }: KeywordCloudCardProps) {
  const topHits = data.hits.slice(0, maxItems);
  const maxCount = topHits.length > 0 ? topHits[0].count : 1;

  if (topHits.length === 0) {
    return (
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <LocalOfferIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>注目キーワード</Typography>
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
          <LocalOfferIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>注目キーワード</Typography>
          <Typography variant="caption" color="text.secondary">
            上位{topHits.length}語
          </Typography>
        </Stack>

        <Stack spacing={1.5}>
          {topHits.map((hit, index) => {
            const catConfig = CATEGORY_COLORS[hit.category];
            const ratio = (hit.count / maxCount) * 100;
            const lastDate = hit.lastSeenAt
              ? new Date(hit.lastSeenAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
              : '';

            return (
              <Box key={hit.keyword}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: index < 3 ? 700 : 500, minWidth: 80 }}
                    >
                      {hit.keyword}
                    </Typography>
                    <Chip
                      label={catConfig.label}
                      size="small"
                      color={catConfig.color}
                      variant={index < 3 ? 'filled' : 'outlined'}
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="caption" color="text.secondary">
                      {lastDate}
                    </Typography>
                    <Chip
                      label={`${hit.count}件`}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontWeight: 600 }}
                    />
                  </Stack>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(ratio, 4)}
                  color={catConfig.color === 'default' ? 'primary' : catConfig.color}
                  sx={{ height: 4, borderRadius: 2 }}
                />
              </Box>
            );
          })}
        </Stack>

        {/* カテゴリ別集計 */}
        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 0.5 }}>
          {(Object.entries(data.byCategory) as [KeywordCategory, number][])
            .filter(([, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, count]) => (
              <Chip
                key={cat}
                icon={<TrendingUpIcon />}
                label={`${CATEGORY_COLORS[cat].label}: ${count}`}
                size="small"
                color={CATEGORY_COLORS[cat].color}
                variant="outlined"
                sx={{ height: 24 }}
              />
            ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
