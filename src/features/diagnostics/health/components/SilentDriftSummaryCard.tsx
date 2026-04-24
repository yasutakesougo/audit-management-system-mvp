import React from 'react';
import { 
  Paper, 
  Stack, 
  Typography, 
  Box, 
  Chip, 
  CircularProgress, 
  Alert,
  Divider,
  Tooltip
} from '@mui/material';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { useSilentDriftSummary } from '../hooks/useSilentDriftSummary';

export function SilentDriftSummaryCard() {
  const { totalCount, listCount, topLists, isIncreasing, loading, error } = useSilentDriftSummary();

  if (error) {
    return (
      <Alert severity="info" variant="outlined">
        silent drift 集計は取得できませんでした
      </Alert>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.02)' }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <VisibilityOffIcon color="disabled" sx={{ fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={600}>
              抑制されたスキーマ乖離 (Silent Drift)
            </Typography>
            <Tooltip title="運用に支障がないため、警告（WARN）から除外されているスキーマ乖離の直近7日間の統計です。">
              <Chip label="管理者用" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
            </Tooltip>
          </Stack>
          {loading && <CircularProgress size={16} />}
        </Stack>

        <Divider />

        <Stack direction="row" spacing={4}>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              直近7日の発生数
            </Typography>
            <Stack direction="row" spacing={1} alignItems="baseline">
              <Typography variant="h5" fontWeight={700}>
                {totalCount}
              </Typography>
              <Typography variant="caption">件</Typography>
              {totalCount > 0 && (
                isIncreasing ? (
                  <TrendingUpIcon color="warning" sx={{ fontSize: 18, ml: 1 }} />
                ) : (
                  <TrendingFlatIcon color="success" sx={{ fontSize: 18, ml: 1 }} />
                )
              )}
            </Stack>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              影響リスト数
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="baseline">
              <Typography variant="h5" fontWeight={700}>
                {listCount}
              </Typography>
              <Typography variant="caption">箇所</Typography>
            </Stack>
          </Box>
        </Stack>

        {topLists.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              主な発生箇所:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {topLists.map((list) => (
                <Chip 
                  key={list.name}
                  label={`${list.name} (${list.count})`}
                  size="small"
                  variant="filled"
                  sx={{ bgcolor: 'action.selected', fontSize: '0.7rem', height: 22 }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {totalCount === 0 && !loading && (
          <Typography variant="body2" color="text.secondary">
            直近7日間に抑制された乖離は検出されませんでした。
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
