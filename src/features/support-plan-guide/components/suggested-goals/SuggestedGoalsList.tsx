/**
 * SuggestedGoalsList — 目標候補リスト + 統計サマリー
 *
 * P3-B: SmartTab にインラインで配置される提案セクション。
 *
 * 表示:
 *  - 統計バー（候補数 / 採用数 / 見送り数）
 *  - pending 候補リスト
 *  - 決定済み候補（collapsed）
 */
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { SuggestedGoalWithDecision, SuggestedGoalsMetrics } from '../../hooks/useSuggestedGoals';
import SuggestedGoalCard from './SuggestedGoalCard';

// ────────────────────────────────────────────
// 型
// ────────────────────────────────────────────

export type SuggestedGoalsListProps = {
  suggestions: SuggestedGoalWithDecision[];
  pendingSuggestions: SuggestedGoalWithDecision[];
  metrics: SuggestedGoalsMetrics;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onUndo: (id: string) => void;
};

// ────────────────────────────────────────────
// コンポーネント
// ────────────────────────────────────────────

const SuggestedGoalsList: React.FC<SuggestedGoalsListProps> = ({
  suggestions,
  pendingSuggestions,
  metrics,
  onAccept,
  onDismiss,
  onUndo,
}) => {
  const decidedSuggestions = React.useMemo(
    () => suggestions.filter((s) => s.decision !== 'pending'),
    [suggestions],
  );

  if (suggestions.length === 0) return null;

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'primary.light',
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      {/* ── ヘッダー ── */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: 'primary.50',
          borderBottom: '1px solid',
          borderColor: 'primary.light',
        }}
      >
        <Badge badgeContent={metrics.pending} color="primary" max={99}>
          <AutoAwesomeIcon sx={{ color: 'primary.main' }} />
        </Badge>
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          AIアシスト — 目標候補の提案
        </Typography>
        <Stack direction="row" spacing={0.5}>
          {metrics.accepted > 0 && (
            <Chip
              label={`${metrics.accepted}件 採用`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          )}
          {metrics.dismissed > 0 && (
            <Chip
              label={`${metrics.dismissed}件 見送り`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          )}
        </Stack>
      </Stack>

      {/* ── 説明 ── */}
      <Alert severity="info" variant="outlined" sx={{ m: 1.5, borderRadius: 1.5 }}>
        <AlertTitle sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
          既存データを分析して目標候補を提案しています
        </AlertTitle>
        <Typography variant="caption" color="text.secondary">
          アセスメント・Iceberg分析・モニタリング・ストレングスの記録内容をもとに、
          ルールベースで自動生成しています。「採用」すると目標リストに追加されます。
        </Typography>
      </Alert>

      {/* ── pending 候補 ── */}
      {pendingSuggestions.length > 0 && (
        <Stack spacing={1} sx={{ px: 1.5, pb: 1.5 }}>
          {pendingSuggestions.map((s) => (
            <SuggestedGoalCard
              key={s.id}
              suggestion={s}
              onAccept={onAccept}
              onDismiss={onDismiss}
              onUndo={onUndo}
            />
          ))}
        </Stack>
      )}

      {pendingSuggestions.length === 0 && metrics.total > 0 && (
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            ✅ すべての候補に対応済みです。
          </Typography>
        </Box>
      )}

      {/* ── 決定済み（collapsed） ── */}
      {decidedSuggestions.length > 0 && (
        <Accordion
          disableGutters
          elevation={0}
          sx={{
            bgcolor: 'transparent',
            '&:before': { display: 'none' },
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{ px: 2, minHeight: 40 }}
          >
            <Typography variant="caption" color="text.secondary">
              対応済み候補（{decidedSuggestions.length}件）
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 1.5, pt: 0 }}>
            <Stack spacing={1}>
              {decidedSuggestions.map((s) => (
                <SuggestedGoalCard
                  key={s.id}
                  suggestion={s}
                  onAccept={onAccept}
                  onDismiss={onDismiss}
                  onUndo={onUndo}
                />
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

export default React.memo(SuggestedGoalsList);
