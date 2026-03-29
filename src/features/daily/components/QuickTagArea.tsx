/**
 * @fileoverview QuickRecord 用タグ入力エリア
 * @description
 * 1名記録時にテーブル上部に表示し、1タップでタグ付与できる導線を提供する。
 * Top5 候補を即表示 + 展開で全12タグをカテゴリ別に表示。
 *
 * ステートレス設計: selectedTags と onToggleTag を外部から受け取る。
 * Top5 の決定には Issue #5 の computeBehaviorTagInsights を再利用。
 */

import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import {
  Box,
  Chip,
  Collapse,
  Paper,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import {
  BEHAVIOR_TAGS,
  BEHAVIOR_TAG_CATEGORIES,
  BEHAVIOR_TAG_CATEGORY_ORDER,
  type BehaviorTagCategory,
  type BehaviorTagKey,
  getTagsByCategory,
} from '../domain/behaviorTag';
import { computeBehaviorTagInsights } from '../domain/behaviorTagInsights';

// ─── カテゴリ色（BehaviorTagChips と統一） ───────────────

const CATEGORY_COLOR: Record<BehaviorTagCategory, 'warning' | 'info' | 'default' | 'success'> = {
  behavior: 'warning',
  communication: 'info',
  dailyLiving: 'default',
  positive: 'success',
};

// ─── Top5 決定ロジック ──────────────────────────────────

const DEFAULT_TOP_COUNT = 5;

function getQuickTags(rows: { behaviorTags: string[] }[]): BehaviorTagKey[] {
  const insights = computeBehaviorTagInsights(rows);
  if (insights && insights.topTags.length > 0) {
    return insights.topTags.map(t => t.key as BehaviorTagKey);
  }
  // 履歴なし → カテゴリ順で先頭5個
  return BEHAVIOR_TAG_CATEGORY_ORDER
    .flatMap(cat => getTagsByCategory(cat))
    .slice(0, DEFAULT_TOP_COUNT);
}

// ─── Props ──────────────────────────────────────────────

export type QuickTagAreaProps = {
  /** 現在表示中の行（Top5 計算に使用） */
  rows: { behaviorTags: string[] }[];
  /** 対象ユーザーの選択済みタグ */
  selectedTags: string[];
  /** タグ toggle ハンドラ */
  onToggleTag: (tagKey: string) => void;
};

// ─── Component ──────────────────────────────────────────

export const QuickTagArea: React.FC<QuickTagAreaProps> = ({
  rows,
  selectedTags,
  onToggleTag,
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const quickTags = useMemo(() => getQuickTags(rows), [rows]);

  return (
    <Paper
      variant="outlined"
      role="group"
      aria-label="行動タグ選択"
      sx={{
        px: 1.5,
        py: 0.75,
        mb: 0.5,
        bgcolor: alpha(theme.palette.primary.main, 0.03),
        borderColor: alpha(theme.palette.primary.main, 0.15),
      }}
    >
      {/* ── Header + Top5 チップ ── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
        <LocalOfferIcon sx={{ fontSize: 14, color: 'primary.main' }} />
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main', mr: 0.25 }}>
          タグ:
        </Typography>

        {quickTags.map(tagKey => {
          const tag = BEHAVIOR_TAGS[tagKey];
          const isSelected = selectedTags.includes(tagKey);
          return (
            <Chip
              key={tagKey}
              label={tag.label}
              size="small"
              variant={isSelected ? 'filled' : 'outlined'}
              clickable
              onClick={() => onToggleTag(tagKey)}
              color={CATEGORY_COLOR[tag.category]}
              aria-pressed={isSelected}
              sx={{
                height: 28,
                fontSize: '0.7rem',
                '& .MuiChip-label': { px: 1 },
              }}
            />
          );
        })}

        {/* 展開トグル */}
        <Chip
          label={expanded ? '閉じる' : 'すべて'}
          size="small"
          variant="outlined"
          clickable
          onClick={() => setExpanded(prev => !prev)}
          icon={expanded ? <ExpandLess sx={{ fontSize: 14 }} /> : <ExpandMore sx={{ fontSize: 14 }} />}
          sx={{
            height: 24,
            fontSize: '0.65rem',
            '& .MuiChip-label': { px: 0.5 },
          }}
        />
      </Box>

      {/* ── 展開時: カテゴリ別全タグ ── */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 0.75 }}>
          {BEHAVIOR_TAG_CATEGORY_ORDER.map(category => {
            const tags = getTagsByCategory(category);
            return (
              <Box key={category} sx={{ mb: 0.5 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.65rem', fontWeight: 600, display: 'block', mb: 0.25 }}
                >
                  {BEHAVIOR_TAG_CATEGORIES[category]}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                  {tags.map(tagKey => {
                    const tag = BEHAVIOR_TAGS[tagKey];
                    const isSelected = selectedTags.includes(tagKey);
                    return (
                      <Chip
                        key={tagKey}
                        label={tag.label}
                        size="small"
                        variant={isSelected ? 'filled' : 'outlined'}
                        clickable
                        onClick={() => onToggleTag(tagKey)}
                        color={CATEGORY_COLOR[category]}
                        aria-pressed={isSelected}
                        sx={{
                          height: 28,
                          fontSize: '0.7rem',
                          '& .MuiChip-label': { px: 1 },
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Paper>
  );
};
