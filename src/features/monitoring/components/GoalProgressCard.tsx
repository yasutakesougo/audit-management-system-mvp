/**
 * @fileoverview ISP 目標進捗カード
 * @description
 * GoalProgressSummary を受け取り、目標ごとの進捗状況を
 * level / rate / trend / 根拠件数 の4指標で表示する。
 *
 * - 文言優先: 色だけに頼らず日本語ラベルを明示
 * - 根拠件数: 判定の説明可能性を担保
 * - 条件付き表示: goalProgress がない場合は何も描画しない
 */
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { GoalProgressSummary, ProgressLevel, ProgressTrend } from '../domain/goalProgressTypes';
import { PROGRESS_LEVEL_LABELS, PROGRESS_LEVEL_COLORS } from '../domain/goalProgressTypes';

// ─── 定数 ────────────────────────────────────────────────

const TREND_CONFIG: Record<ProgressTrend, { label: string; icon: typeof TrendingUpIcon; color: string }> = {
  improving: { label: '改善', icon: TrendingUpIcon, color: '#10b981' },
  stable:    { label: '横ばい', icon: TrendingFlatIcon, color: '#6b7280' },
  declining: { label: '低下', icon: TrendingDownIcon, color: '#ef4444' },
};

const LEVEL_CHIP_COLOR: Record<ProgressLevel, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  achieved:    'success',
  progressing: 'info',
  stagnant:    'warning',
  regressing:  'error',
  noData:      'default',
};

// ─── 単一目標カード ──────────────────────────────────────

interface GoalProgressItemProps {
  progress: GoalProgressSummary;
  goalName?: string;
}

const GoalProgressItem: React.FC<GoalProgressItemProps> = ({ progress, goalName }) => {
  const trendCfg = TREND_CONFIG[progress.trend];
  const TrendIcon = trendCfg.icon;
  const displayName = goalName ?? `目標(${progress.goalId})`;
  const ratePercent = Math.round(progress.rate * 100);

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {/* 目標名 + level Chip */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            wordBreak: 'break-word',
            flex: 1,
            minWidth: 0,
          }}
        >
          {displayName}
        </Typography>
        <Chip
          label={PROGRESS_LEVEL_LABELS[progress.level]}
          size="small"
          color={LEVEL_CHIP_COLOR[progress.level]}
          sx={{
            fontWeight: 600,
            flexShrink: 0,
            minWidth: 64,
            justifyContent: 'center',
          }}
        />
      </Stack>

      {/* noData 時は根拠なしメッセージ */}
      {progress.level === 'noData' ? (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          関連データなし — 評価保留
        </Typography>
      ) : (
        <Box sx={{ mt: 1 }}>
          {/* 達成率バー */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 50 }}>
              達成率
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(ratePercent, 100)}
              sx={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                '& .MuiLinearProgress-bar': {
                  backgroundColor: PROGRESS_LEVEL_COLORS[progress.level],
                },
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 38, textAlign: 'right' }}>
              {ratePercent}%
            </Typography>
          </Stack>

          {/* 根拠件数 + 傾向 */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mt: 0.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              根拠記録 {progress.matchedRecordCount}件 / 関連タグ {progress.matchedTagCount}件
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.3}>
              <TrendIcon sx={{ fontSize: 14, color: trendCfg.color }} />
              <Typography variant="caption" sx={{ color: trendCfg.color, fontWeight: 500 }}>
                {trendCfg.label}
              </Typography>
            </Stack>
          </Stack>
        </Box>
      )}
    </Box>
  );
};

// ─── メインコンポーネント ────────────────────────────────

export interface GoalProgressCardProps {
  /** goalProgress 配列。undefined / 空配列 のとき何も描画しない */
  goalProgress?: GoalProgressSummary[];
  /**
   * goalId → 表示名のマップ。
   * 提供されない場合は goalId をそのまま使う。
   */
  goalNames?: Record<string, string>;
}

const GoalProgressCard: React.FC<GoalProgressCardProps> = ({
  goalProgress,
  goalNames,
}) => {
  if (!goalProgress || goalProgress.length === 0) return null;

  return (
    <Box>
      <Typography
        variant="subtitle2"
        color="text.secondary"
        sx={{ fontWeight: 600, mb: 0.5 }}
      >
        <EmojiEventsIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
        目標進捗
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 1, fontSize: '0.65rem' }}
      >
        ※ ISP目標と日次記録の行動タグを自動照合した進捗判定です
      </Typography>
      <Stack spacing={1}>
        {goalProgress.map((gp) => (
          <GoalProgressItem
            key={gp.goalId}
            progress={gp}
            goalName={goalNames?.[gp.goalId]}
          />
        ))}
      </Stack>
    </Box>
  );
};

export default React.memo(GoalProgressCard);
