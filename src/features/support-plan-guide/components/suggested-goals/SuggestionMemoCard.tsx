/**
 * SuggestionMemoCard — 改善メモ向け提案候補カード
 *
 * P3-C: ExcellenceTab（改善メモ）に配置する軽量カード。
 *
 * SmartTab の SuggestedGoalCard と似た構造だが、アクションが異なる:
 *  - 「メモに追記」: improvementIdeas テキストに追加
 *  - 「あとで検討」: 保留（deferred list に移動）
 *  - 「目標に昇格」: SmartTab の目標リストに追加
 *
 * 決定済みカードには「元に戻す」ボタンを表示。
 */
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import UndoIcon from '@mui/icons-material/Undo';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';

import type { GoalPriority } from '../../domain/suggestedGoals';
import type { SuggestionMemoAction, SuggestionWithMemoAction } from '../../hooks/useSuggestionMemo';

// ────────────────────────────────────────────
// 型
// ────────────────────────────────────────────

export type SuggestionMemoCardProps = {
  suggestion: SuggestionWithMemoAction;
  onNoteToMemo: (id: string) => void;
  onDefer: (id: string) => void;
  onPromote: (id: string) => void;
  onUndo: (id: string) => void;
};

// ────────────────────────────────────────────
// 定数
// ────────────────────────────────────────────

const PRIORITY_CONFIG: Record<GoalPriority, { label: string; color: 'error' | 'warning' | 'default' }> = {
  high: { label: '高', color: 'error' },
  medium: { label: '中', color: 'warning' },
  low: { label: '低', color: 'default' },
};

const GOAL_TYPE_LABEL: Record<string, string> = {
  long: '長期目標',
  short: '短期目標',
  support: '支援内容',
};

const ACTION_STYLES: Record<SuggestionMemoAction, { opacity: number; borderColor: string }> = {
  pending: { opacity: 1, borderColor: 'divider' },
  noted: { opacity: 0.65, borderColor: 'info.main' },
  deferred: { opacity: 0.55, borderColor: 'warning.main' },
  promoted: { opacity: 0.6, borderColor: 'success.main' },
};

const ACTION_LABELS: Record<Exclude<SuggestionMemoAction, 'pending'>, { icon: React.ReactNode; text: string }> = {
  noted: { icon: <EditNoteIcon fontSize="small" />, text: 'メモに追記済み' },
  deferred: { icon: <ScheduleIcon fontSize="small" />, text: 'あとで検討' },
  promoted: { icon: <TrendingUpIcon fontSize="small" />, text: '目標に昇格済み' },
};

// ────────────────────────────────────────────
// コンポーネント
// ────────────────────────────────────────────

const SuggestionMemoCard: React.FC<SuggestionMemoCardProps> = ({
  suggestion,
  onNoteToMemo,
  onDefer,
  onPromote,
  onUndo,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const { memoAction } = suggestion;
  const style = ACTION_STYLES[memoAction];
  const priorityConfig = PRIORITY_CONFIG[suggestion.priority];

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        opacity: style.opacity,
        borderColor: style.borderColor,
        borderWidth: memoAction !== 'pending' ? 2 : 1,
        transition: 'all 0.25s ease',
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={1}>
          {/* ── ヘッダー行 ── */}
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            <BookmarkAddedIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{
                flex: 1,
                minWidth: 0,
                textDecoration: memoAction === 'promoted' ? 'none' : 'none',
              }}
            >
              {suggestion.title}
            </Typography>
            <Chip
              label={priorityConfig.label}
              color={priorityConfig.color}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.7rem', height: 22 }}
            />
            <Chip
              label={GOAL_TYPE_LABEL[suggestion.goalType] ?? suggestion.goalType}
              size="small"
              variant="filled"
              sx={{
                fontWeight: 500,
                fontSize: '0.7rem',
                height: 22,
                bgcolor: 'action.hover',
              }}
            />
          </Stack>

          {/* ── 根拠（rationale） ── */}
          <Typography variant="body2" color="text.secondary" sx={{ pl: 3, lineHeight: 1.6 }}>
            {suggestion.rationale}
          </Typography>

          {/* ── 決定済みステータス表示 ── */}
          {memoAction !== 'pending' && (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ pl: 3 }}>
              {ACTION_LABELS[memoAction].icon}
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                {ACTION_LABELS[memoAction].text}
              </Typography>
            </Stack>
          )}

          {/* ── 詳細トグル ── */}
          {(suggestion.suggestedSupports.length > 0 || suggestion.provenance.length > 0) && (
            <Box sx={{ pl: 3 }}>
              <Typography
                component="button"
                variant="caption"
                onClick={() => setShowDetails(!showDetails)}
                sx={{
                  cursor: 'pointer',
                  color: 'primary.main',
                  background: 'none',
                  border: 'none',
                  p: 0,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {showDetails ? '▲ 詳細を閉じる' : '▼ 詳細を見る'}
              </Typography>

              <Collapse in={showDetails}>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {/* 推奨支援 */}
                  {suggestion.suggestedSupports.length > 0 && (
                    <Box>
                      <Typography variant="caption" fontWeight={600} color="text.secondary">
                        推奨する支援内容:
                      </Typography>
                      <Stack component="ul" spacing={0.25} sx={{ m: 0, pl: 2 }}>
                        {suggestion.suggestedSupports.map((s, i) => (
                          <Typography key={i} component="li" variant="caption" color="text.secondary">
                            {s}
                          </Typography>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* 出典 */}
                  {suggestion.provenance.length > 0 && (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {suggestion.provenance.map((p, i) => (
                        <Tooltip key={i} title={p} arrow>
                          <Chip
                            label={p}
                            size="small"
                            variant="outlined"
                            sx={{
                              fontSize: '0.65rem',
                              height: 20,
                              maxWidth: 200,
                              '.MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Collapse>
            </Box>
          )}

          {/* ── アクション行 ── */}
          <Stack direction="row" spacing={1} sx={{ pl: 3, pt: 0.5 }} flexWrap="wrap">
            {memoAction === 'pending' ? (
              <>
                <Button
                  size="small"
                  variant="contained"
                  color="info"
                  startIcon={<EditNoteIcon />}
                  onClick={() => onNoteToMemo(suggestion.id)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                >
                  メモに追記
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<ScheduleIcon />}
                  onClick={() => onDefer(suggestion.id)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                >
                  あとで検討
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  startIcon={<TrendingUpIcon />}
                  onClick={() => onPromote(suggestion.id)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                >
                  目標に昇格
                </Button>
              </>
            ) : (
              <Button
                size="small"
                variant="text"
                startIcon={<UndoIcon />}
                onClick={() => onUndo(suggestion.id)}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
              >
                元に戻す
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default React.memo(SuggestionMemoCard);
