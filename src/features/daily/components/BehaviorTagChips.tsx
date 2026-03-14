/**
 * @fileoverview 行動タグチップ UI コンポーネント
 * @description
 * 問題行動チップの下に折りたたみで配置する行動タグ選択UI。
 * ステートレス設計: selectedTags と onToggleTag を外部から受け取る。
 *
 * UXデザイン判断:
 * - 折りたたみ式にしてテーブル密度を維持
 * - カテゴリごとに色分け (behavior=warning, communication=info, dailyLiving=default, positive=success)
 * - チップ高さ 28px でモバイルのタッチターゲットを確保
 * - 選択数バッジで折りたたみ時の情報量を確保
 */
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import {
  Badge,
  Box,
  Chip,
  Collapse,
  IconButton,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import {
  BEHAVIOR_TAG_CATEGORY_ORDER,
  BEHAVIOR_TAG_CATEGORIES,
  BEHAVIOR_TAGS,
  type BehaviorTagCategory,
  getTagsByCategory,
} from '../domain/behaviorTag';

// ─── カテゴリ → MUI Color マッピング ────────────────────

const CATEGORY_COLOR: Record<BehaviorTagCategory, 'warning' | 'info' | 'default' | 'success'> = {
  behavior: 'warning',
  communication: 'info',
  dailyLiving: 'default',
  positive: 'success',
};

// ─── Props ──────────────────────────────────────────────

export type BehaviorTagChipsProps = {
  /** 現在選択されているタグキーの配列 */
  selectedTags: string[];
  /** タグの on/off を切り替えるハンドラ */
  onToggleTag: (tagKey: string) => void;
};

// ─── Component ──────────────────────────────────────────

export const BehaviorTagChips: React.FC<BehaviorTagChipsProps> = ({
  selectedTags,
  onToggleTag,
}) => {
  const [expanded, setExpanded] = useState(false);
  const selectedCount = selectedTags.length;

  return (
    <Box sx={{ mt: 0.5 }}>
      {/* ── Toggle Button ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { opacity: 0.8 },
        }}
        onClick={() => setExpanded(prev => !prev)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label="行動タグを展開"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(prev => !prev);
          }
        }}
      >
        <Badge badgeContent={selectedCount} color="primary" overlap="rectangular">
          <LocalOfferOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        </Badge>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: 0.5, fontSize: '0.7rem' }}
        >
          行動タグ
        </Typography>
        <IconButton size="small" sx={{ p: 0, ml: 0.25 }} tabIndex={-1}>
          {expanded ? (
            <ExpandLess sx={{ fontSize: 14 }} />
          ) : (
            <ExpandMore sx={{ fontSize: 14 }} />
          )}
        </IconButton>
      </Box>

      {/* ── Collapsible Tag Panel ── */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 0.5 }}>
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
    </Box>
  );
};
