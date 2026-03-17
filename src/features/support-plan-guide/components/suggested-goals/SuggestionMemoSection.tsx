/**
 * SuggestionMemoSection — 改善メモ向け提案候補セクション
 *
 * P3-C: ExcellenceTab に配置するコンテナ。
 *
 * 構成:
 *  - ヘッダー（候補数サマリー）
 *  - 説明 Alert（改善メモと SmartTab の役割分担を説明）
 *  - pending 候補カードリスト
 *  - deferred（あとで検討）候補リスト（Accordion）
 *  - 対応済み候補リスト（Accordion）
 *
 * 設計原則:
 *  - SuggestedGoalsList と構造を揃えつつ、改善メモ用の3アクションを提供
 *  - ISPCandidateImportSection と異なりカード形式でリッチに表示
 */
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
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

import type {
  SuggestionWithMemoAction,
  SuggestionMemoMetrics,
} from '../../hooks/useSuggestionMemo';
import SuggestionMemoCard from './SuggestionMemoCard';

// ────────────────────────────────────────────
// 型
// ────────────────────────────────────────────

export type SuggestionMemoSectionProps = {
  suggestions: SuggestionWithMemoAction[];
  pendingSuggestions: SuggestionWithMemoAction[];
  deferredSuggestions: SuggestionWithMemoAction[];
  metrics: SuggestionMemoMetrics;
  onNoteToMemo: (id: string) => void;
  onDefer: (id: string) => void;
  onPromote: (id: string) => void;
  onUndo: (id: string) => void;
};

// ────────────────────────────────────────────
// コンポーネント
// ────────────────────────────────────────────

const SuggestionMemoSection: React.FC<SuggestionMemoSectionProps> = ({
  suggestions,
  pendingSuggestions,
  deferredSuggestions,
  metrics,
  onNoteToMemo,
  onDefer,
  onPromote,
  onUndo,
}) => {
  // noted + promoted = 対応済み（deferred は別枠）
  const completedSuggestions = React.useMemo(
    () => suggestions.filter((s) => s.memoAction === 'noted' || s.memoAction === 'promoted'),
    [suggestions],
  );

  if (suggestions.length === 0) return null;

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'secondary.light',
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
      data-testid="suggestion-memo-section"
    >
      {/* ── ヘッダー ── */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: 'secondary.50',
          borderBottom: '1px solid',
          borderColor: 'secondary.light',
        }}
      >
        <Badge badgeContent={metrics.pending} color="secondary" max={99}>
          <BookmarkAddedIcon sx={{ color: 'secondary.main' }} />
        </Badge>
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          提案候補の検討ワークスペース
        </Typography>
        <Stack direction="row" spacing={0.5}>
          {metrics.noted > 0 && (
            <Chip
              label={`${metrics.noted}件 追記済`}
              size="small"
              color="info"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          )}
          {metrics.deferred > 0 && (
            <Chip
              label={`${metrics.deferred}件 保留`}
              size="small"
              color="warning"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          )}
          {metrics.promoted > 0 && (
            <Chip
              label={`${metrics.promoted}件 昇格`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          )}
        </Stack>
      </Stack>

      {/* ── 説明 ── */}
      <Alert severity="info" variant="outlined" sx={{ m: 1.5, borderRadius: 1.5 }}>
        <AlertTitle sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
          提案候補を改善メモの視点で検討できます
        </AlertTitle>
        <Typography variant="caption" color="text.secondary">
          Smartタブの「目標候補」と同じデータをもとに生成しています。
          ここでは「メモに追記」「あとで検討」「目標に昇格」の3つの選択肢で、
          改善メモの作業台として活用できます。
        </Typography>
      </Alert>

      {/* ── pending 候補 ── */}
      {pendingSuggestions.length > 0 && (
        <Stack spacing={1} sx={{ px: 1.5, pb: 1.5 }}>
          {pendingSuggestions.map((s) => (
            <SuggestionMemoCard
              key={s.id}
              suggestion={s}
              onNoteToMemo={onNoteToMemo}
              onDefer={onDefer}
              onPromote={onPromote}
              onUndo={onUndo}
            />
          ))}
        </Stack>
      )}

      {pendingSuggestions.length === 0 && metrics.total > 0 && (
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            ✅ すべての候補を検討済みです。
          </Typography>
        </Box>
      )}

      {/* ── あとで検討（deferred） ── */}
      {deferredSuggestions.length > 0 && (
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
            <Typography variant="caption" color="warning.main" fontWeight={600}>
              📋 あとで検討（{deferredSuggestions.length}件）
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 1.5, pt: 0 }}>
            <Stack spacing={1}>
              {deferredSuggestions.map((s) => (
                <SuggestionMemoCard
                  key={s.id}
                  suggestion={s}
                  onNoteToMemo={onNoteToMemo}
                  onDefer={onDefer}
                  onPromote={onPromote}
                  onUndo={onUndo}
                />
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}

      {/* ── 対応済み（noted / promoted） ── */}
      {completedSuggestions.length > 0 && (
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
              対応済み（{completedSuggestions.length}件）
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 1.5, pt: 0 }}>
            <Stack spacing={1}>
              {completedSuggestions.map((s) => (
                <SuggestionMemoCard
                  key={s.id}
                  suggestion={s}
                  onNoteToMemo={onNoteToMemo}
                  onDefer={onDefer}
                  onPromote={onPromote}
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

export default React.memo(SuggestionMemoSection);
