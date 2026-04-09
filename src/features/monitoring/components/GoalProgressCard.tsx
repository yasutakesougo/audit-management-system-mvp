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
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { GoalProgressSummary, ProgressLevel, ProgressTrend } from '../domain/goalProgressTypes';
import { PROGRESS_LEVEL_LABELS, PROGRESS_LEVEL_COLORS } from '../domain/goalProgressTypes';
import type { BehaviorTagCategory } from '../../daily/domain/behavior/behaviorTag';
import { BEHAVIOR_TAG_CATEGORIES } from '../../daily/domain/behavior/behaviorTag';
import GoalCategoryOverridePopover from './GoalCategoryOverridePopover';

// ─── 定数 ────────────────────────────────────────────────

const TREND_CONFIG: Record<ProgressTrend, { label: string; icon: typeof TrendingUpIcon; color: string; description: string }> = {
  improving: { label: '改善', icon: TrendingUpIcon, color: '#10b981', description: '前半と比較して後半に関連タグの出現が増加' },
  stable:    { label: '横ばい', icon: TrendingFlatIcon, color: '#6b7280', description: '期間を通じて関連タグの出現頻度に大きな変動なし' },
  declining: { label: '低下', icon: TrendingDownIcon, color: '#ef4444', description: '前半と比較して後半に関連タグの出現が減少' },
};

const LEVEL_CHIP_COLOR: Record<ProgressLevel, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  achieved:    'success',
  progressing: 'info',
  stagnant:    'warning',
  regressing:  'error',
  noData:      'default',
};

/** 各レベルの補助説明（Tooltip 用） */
const LEVEL_DESCRIPTIONS: Record<ProgressLevel, string> = {
  achieved:    '関連する行動タグが十分に出現し、目標に沿った行動が定着しています',
  progressing: '関連する行動タグが一定以上出現しており、改善傾向があります',
  stagnant:    '関連する行動タグの出現が少なく、目立った進展が見られません',
  regressing:  '関連する行動タグの出現が減少しており、注意が必要です',
  noData:      '判定に必要な記録データが不足しています',
};

// ─── 単一目標カード ──────────────────────────────────────

interface GoalProgressItemProps {
  progress: GoalProgressSummary;
  goalName?: string;
  /** Phase 4-B: カテゴリ上書きコールバック（undefined なら調整UI非表示） */
  onCategoryOverride?: (goalId: string, categories: BehaviorTagCategory[] | null) => void;
}

const GoalProgressItem: React.FC<GoalProgressItemProps> = ({ progress, goalName, onCategoryOverride }) => {
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
        <Tooltip title={LEVEL_DESCRIPTIONS[progress.level]} arrow placement="top">
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
        </Tooltip>
      </Stack>

      {/* noData 時は根拠不足メッセージ */}
      {progress.level === 'noData' ? (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          現時点では判定根拠が不足しています — 記録の蓄積により判定可能になります
        </Typography>
      ) : (
        <Box sx={{ mt: 1 }}>
          {/* 達成率バー */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <Tooltip
              title="行動タグの出現率から算出（関連タグが記録された日数 ÷ 全記録日数）"
              arrow
              placement="left"
            >
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 50, cursor: 'help' }}>
                達成率
              </Typography>
            </Tooltip>
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
            <Tooltip
              title="根拠記録: 関連する行動タグが付与された記録の件数。関連タグ: 目標に紐づく行動タグの出現回数。"
              arrow
              placement="bottom-start"
            >
              <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
                根拠記録 {progress.matchedRecordCount}件 / 関連タグ {progress.matchedTagCount}件
              </Typography>
            </Tooltip>
            <Tooltip title={trendCfg.description} arrow placement="bottom-end">
              <Stack direction="row" alignItems="center" spacing={0.3} sx={{ cursor: 'help' }}>
                <TrendIcon sx={{ fontSize: 14, color: trendCfg.color }} />
                <Typography variant="caption" sx={{ color: trendCfg.color, fontWeight: 500 }}>
                  {trendCfg.label}
                </Typography>
              </Stack>
            </Tooltip>
          </Stack>
        </Box>
      )}

      {/* Phase 4-B: 関連カテゴリ + 調整リンク */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.3 }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
          関連: {progress.linkedCategories.length > 0
            ? progress.linkedCategories.map((c) => BEHAVIOR_TAG_CATEGORIES[c] ?? c).join('・')
            : 'なし'}
        </Typography>
        {onCategoryOverride && (
          <GoalCategoryOverridePopover
            goalId={progress.goalId}
            currentCategories={progress.linkedCategories}
            source={progress.source ?? 'domain-inference'}
            onSave={onCategoryOverride}
          />
        )}
      </Stack>
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
  /** Phase 4-B: カテゴリ上書きコールバック */
  onCategoryOverride?: (goalId: string, categories: BehaviorTagCategory[] | null) => void;
}

const GoalProgressCard: React.FC<GoalProgressCardProps> = ({
  goalProgress,
  goalNames,
  onCategoryOverride,
}) => {
  if (!goalProgress || goalProgress.length === 0) return null;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{ fontWeight: 600 }}
        >
          <EmojiEventsIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
          目標進捗
        </Typography>
        <Tooltip
          title="個別支援計画目標の5領域（健康・運動・認知・言語・社会性）と、日々の記録に付与された行動タグを自動照合して進捗を判定しています。判定は記録データに基づく参考情報です。"
          arrow
          placement="right"
        >
          <HelpOutlineIcon sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
        </Tooltip>
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 1, fontSize: '0.65rem' }}
      >
        ※ 個別支援計画目標と日々の記録の行動タグを自動照合した進捗判定です
      </Typography>
      <Stack spacing={1} sx={{ maxHeight: 400, overflowY: 'auto' }}>
        {goalProgress.map((gp) => (
          <GoalProgressItem
            key={gp.goalId}
            progress={gp}
            goalName={goalNames?.[gp.goalId]}
            onCategoryOverride={onCategoryOverride}
          />
        ))}
      </Stack>
    </Box>
  );
};

export default React.memo(GoalProgressCard);
