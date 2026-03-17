/**
 * SuggestedGoalCard — 目標候補1件の表示 + accept/dismiss
 *
 * P3-B: 候補カード UI。
 *
 * 表示:
 *  - タイトル / 優先度チップ / goalType ラベル
 *  - rationale（根拠）
 *  - suggestedSupports（推奨支援）
 *  - provenance（出典）
 *  - 採用 / 見送り ボタン
 */
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
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

import type { SuggestedGoalDecision } from '../../hooks/useSuggestedGoals';
import type { GoalPriority, GoalSuggestion } from '../../domain/suggestedGoals';

// ────────────────────────────────────────────
// 型
// ────────────────────────────────────────────

export type SuggestedGoalCardProps = {
  suggestion: GoalSuggestion & { decision: SuggestedGoalDecision };
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
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

const DECISION_STYLES: Record<SuggestedGoalDecision, { opacity: number; borderColor: string }> = {
  pending: { opacity: 1, borderColor: 'divider' },
  accepted: { opacity: 0.7, borderColor: 'success.main' },
  dismissed: { opacity: 0.5, borderColor: 'action.disabled' },
};

// ────────────────────────────────────────────
// コンポーネント
// ────────────────────────────────────────────

const SuggestedGoalCard: React.FC<SuggestedGoalCardProps> = ({
  suggestion,
  onAccept,
  onDismiss,
  onUndo,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const { decision } = suggestion;
  const style = DECISION_STYLES[decision];
  const priorityConfig = PRIORITY_CONFIG[suggestion.priority];

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        opacity: style.opacity,
        borderColor: style.borderColor,
        borderWidth: decision !== 'pending' ? 2 : 1,
        transition: 'all 0.25s ease',
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={1}>
          {/* ── ヘッダー行 ── */}
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            <AutoAwesomeIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{
                flex: 1,
                minWidth: 0,
                textDecoration: decision === 'dismissed' ? 'line-through' : 'none',
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
          <Stack direction="row" spacing={1} sx={{ pl: 3, pt: 0.5 }}>
            {decision === 'pending' ? (
              <>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleOutlineIcon />}
                  onClick={() => onAccept(suggestion.id)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                >
                  採用
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  startIcon={<HighlightOffIcon />}
                  onClick={() => onDismiss(suggestion.id)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                >
                  見送り
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
                {decision === 'accepted' ? '採用を取り消す' : '見送りを取り消す'}
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default React.memo(SuggestedGoalCard);
