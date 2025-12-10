/**
 * カテゴリ別サマリーカード
 *
 * 今日の申し送りをカテゴリ別に集計し、
 * 現場の傾向を一目で把握できるようにする
 */

import {
    Psychology as BehaviorIcon,
    People as FamilyIcon,
    Star as GoodIcon,
    Favorite as HealthIcon,
    Warning as IncidentIcon,
    MoreHoriz as OtherIcon,
    Lightbulb as SupportIcon,
} from '@mui/icons-material';
import {
    Box,
    Card,
    CardContent,
    Chip,
    LinearProgress,
    Stack,
    Typography,
} from '@mui/material';
import React from 'react';
import type { HandoffCategory, HandoffDayScope } from './handoffTypes';
import { HANDOFF_DAY_SCOPE_LABELS } from './handoffTypes';
import { useHandoffSummary } from './useHandoffSummary';

/**
 * カテゴリごとのアイコンとカラー設定
 */
const CATEGORY_CONFIG: Record<HandoffCategory, {
  icon: React.ReactElement;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  bgColor: string;
}> = {
  '体調': {
    icon: <HealthIcon />,
    color: 'error',
    bgColor: '#ffebee',
  },
  '行動面': {
    icon: <BehaviorIcon />,
    color: 'warning',
    bgColor: '#fff3e0',
  },
  '家族連絡': {
    icon: <FamilyIcon />,
    color: 'info',
    bgColor: '#e3f2fd',
  },
  '支援の工夫': {
    icon: <SupportIcon />,
    color: 'secondary',
    bgColor: '#f3e5f5',
  },
  '良かったこと': {
    icon: <GoodIcon />,
    color: 'success',
    bgColor: '#e8f5e8',
  },
  '事故・ヒヤリ': {
    icon: <IncidentIcon />,
    color: 'error',
    bgColor: '#ffebee',
  },
  'その他': {
    icon: <OtherIcon />,
    color: 'default',
    bgColor: '#fafafa',
  },
};

/**
 * カテゴリ別統計を表示するカード
 *
 * 機能:
 * - 各カテゴリの件数表示
 * - 視覚的な比率表示（プログレスバー）
 * - アイコンと色分けによる直感的な理解
 */
type HandoffCategorySummaryCardProps = {
  dayScope?: HandoffDayScope;
};

export default function HandoffCategorySummaryCard({ dayScope = 'today' }: HandoffCategorySummaryCardProps) {
  const { total, byCategory } = useHandoffSummary({ dayScope });
  const scopeLabel = HANDOFF_DAY_SCOPE_LABELS[dayScope];

  // 件数でソート（多い順）
  const sortedCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => ({
      category: category as HandoffCategory,
      count,
      ratio: total > 0 ? (count / total) * 100 : 0,
    }));

  const topCategories = sortedCategories.filter(item => item.count > 0);
  const hasData = topCategories.length > 0;

  return (
    <Card sx={{ mb: 2, bgcolor: 'background.default' }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="subtitle2" color="text.primary" sx={{ fontWeight: 600 }}>
              📊 {scopeLabel}のカテゴリ別申し送り
            </Typography>
            {total > 0 && (
              <Typography variant="caption" color="text.secondary">
                全 {total} 件
              </Typography>
            )}
          </Stack>

          {hasData ? (
            <Stack spacing={1.5}>
              {topCategories.map(({ category, count, ratio }) => {
                const config = CATEGORY_CONFIG[category];

                return (
                  <Stack key={category} spacing={1}>
                    {/* カテゴリ情報 */}
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24,
                            height: 24,
                            borderRadius: 1,
                            bgcolor: config.bgColor,
                            color: `${config.color}.main`,
                            '& .MuiSvgIcon-root': { fontSize: 16 },
                          }}
                        >
                          {config.icon}
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {category}
                        </Typography>
                      </Stack>
                      <Chip
                        size="small"
                        label={`${count}件`}
                        color={config.color}
                        variant={ratio > 20 ? 'filled' : 'outlined'}
                      />
                    </Stack>

                    {/* 比率表示 */}
                    {ratio > 5 && (
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(ratio, 100)}
                        color={config.color === 'default' ? 'primary' : config.color}
                        sx={{
                          height: 4,
                          borderRadius: 2,
                          bgcolor: config.bgColor,
                        }}
                      />
                    )}
                  </Stack>
                );
              })}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 1 }}>
              まだ{scopeLabel}の申し送りはありません
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}