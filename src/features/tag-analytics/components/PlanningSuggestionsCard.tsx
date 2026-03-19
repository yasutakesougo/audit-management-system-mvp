/**
 * @fileoverview Phase F3: PlanningSuggestionsCard — 計画示唆表示 UI
 * @description
 * トレンドアラートから生成された示唆を、
 * PlanningSheetPage 上で計画の見直し候補として表示する。
 * 自動入力はしない。「検討してください」のトーン。
 */
import React from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';

import type { PlanningSuggestion } from '../domain/planningSuggestions';

// ─── Props ───────────────────────────────────────────────

type PlanningSuggestionsCardProps = {
  suggestions: PlanningSuggestion[];
};

// ─── Main Component ──────────────────────────────────────

export const PlanningSuggestionsCard: React.FC<PlanningSuggestionsCardProps> = ({
  suggestions,
}) => {
  if (suggestions.length === 0) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        borderColor: 'warning.light',
        bgcolor: 'rgba(237, 108, 2, 0.03)',
      }}
      data-testid="planning-suggestions-card"
    >
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1.5 }}>
        <LightbulbRoundedIcon sx={{ fontSize: 18, color: '#ed6c02' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          💡 支援計画の見直し候補
        </Typography>
      </Stack>

      <Stack spacing={1.5}>
        {suggestions.map((s, i) => (
          <SuggestionItem key={`${s.alert.tagKey}-${i}`} suggestion={s} />
        ))}
      </Stack>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 1.5, display: 'block', fontStyle: 'italic' }}
      >
        ※ 行動タグの傾向から自動生成された候補です。支援計画への反映は担当者の判断で行ってください。
      </Typography>
    </Paper>
  );
};

// ─── Sub Component ───────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  spike: { label: '急増', color: '#d32f2f' },
  drop: { label: '消失', color: '#1976d2' },
  new: { label: '新規', color: '#ed6c02' },
};

const SuggestionItem: React.FC<{ suggestion: PlanningSuggestion }> = ({ suggestion }) => {
  const typeInfo = TYPE_LABELS[suggestion.alert.type] ?? { label: '変化', color: '#757575' };

  return (
    <Box
      sx={{
        pl: 1.5,
        borderLeft: `3px solid ${typeInfo.color}`,
      }}
      data-testid={`suggestion-${suggestion.alert.tagKey}`}
    >
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
        <Chip
          label={suggestion.alert.tagLabel}
          size="small"
          sx={{
            bgcolor: typeInfo.color,
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.7rem',
            height: 20,
          }}
        />
        <Chip
          label={typeInfo.label}
          size="small"
          variant="outlined"
          sx={{
            fontSize: '0.65rem',
            height: 18,
            borderColor: typeInfo.color,
            color: typeInfo.color,
          }}
        />
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 0.25, fontSize: '0.7rem' }}
        data-testid={`suggestion-rationale-${suggestion.alert.tagKey}`}
      >
        {suggestion.rationale}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontSize: '0.8rem', fontWeight: 500 }}
        data-testid={`suggestion-text-${suggestion.alert.tagKey}`}
      >
        → {suggestion.suggestion}
      </Typography>
    </Box>
  );
};
