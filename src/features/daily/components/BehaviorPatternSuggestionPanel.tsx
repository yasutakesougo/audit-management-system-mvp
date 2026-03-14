/**
 * @fileoverview ルールベース行動パターン提案パネル
 * @description
 * Issue #7 のクロス集計結果から Issue #8 のルールエンジンで生成した示唆を表示する。
 * - Suggestion が1件以上あれば表示（デフォルト展開済み）
 * - 最大3件
 * - severity に応じたアイコン色
 */

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import {
  Alert,
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import React, { useMemo } from 'react';
import { getTagLabel, BEHAVIOR_TAG_KEYS, type BehaviorTagKey } from '../domain/behaviorTag';
import type { BehaviorTagCrossInsights } from '../domain/behaviorTagCrossInsights';
import {
  generatePatternSuggestions,
  type PatternSuggestion,
  type SuggestionSeverity,
} from '../domain/behaviorPatternSuggestions';

// ─── severity 設定 ───────────────────────────────────────

const SEVERITY_CONFIG: Record<SuggestionSeverity, {
  muiSeverity: 'info' | 'warning' | 'success';
  icon: React.ReactElement;
}> = {
  info: {
    muiSeverity: 'info',
    icon: <InfoOutlinedIcon fontSize="small" />,
  },
  notice: {
    muiSeverity: 'warning',
    icon: <LightbulbOutlinedIcon fontSize="small" />,
  },
  highlight: {
    muiSeverity: 'success',
    icon: <StarOutlineIcon fontSize="small" />,
  },
};

// ─── Props ──────────────────────────────────────────────

type BehaviorPatternSuggestionPanelProps = {
  insights: BehaviorTagCrossInsights | null;
};

// ─── Component ──────────────────────────────────────────

export const BehaviorPatternSuggestionPanel: React.FC<BehaviorPatternSuggestionPanelProps> = ({
  insights,
}) => {
  const theme = useTheme();
  const suggestions = useMemo(() => generatePatternSuggestions(insights), [insights]);

  if (suggestions.length === 0) return null;

  return (
    <Paper
      variant="outlined"
      role="region"
      aria-label="行動パターン提案"
      sx={{
        bgcolor: alpha(theme.palette.background.paper, 0.6),
        borderColor: alpha(theme.palette.divider, 0.3),
      }}
    >
      <Box sx={{ px: 1.5, pt: 0.75, pb: 0.25 }}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.65rem' }}
        >
          💡 気づき
        </Typography>
      </Box>

      <Stack spacing={0.5} sx={{ px: 1, pb: 1 }}>
        {suggestions.map(suggestion => (
          <SuggestionItem key={suggestion.ruleId} suggestion={suggestion} />
        ))}
      </Stack>
    </Paper>
  );
};

// ─── SuggestionItem ─────────────────────────────────────

const SuggestionItem: React.FC<{ suggestion: PatternSuggestion }> = ({ suggestion }) => {
  const config = SEVERITY_CONFIG[suggestion.severity];

  const tagKeys = BEHAVIOR_TAG_KEYS as string[];

  return (
    <Alert
      severity={config.muiSeverity}
      icon={config.icon}
      sx={{
        py: 0.25,
        px: 1,
        '& .MuiAlert-message': { py: 0.25 },
        '& .MuiAlert-icon': { py: 0.5, mr: 0.5 },
        fontSize: '0.7rem',
        lineHeight: 1.4,
      }}
    >
      <Typography variant="caption" sx={{ fontSize: '0.7rem', lineHeight: 1.4 }}>
        {suggestion.message}
      </Typography>

      {suggestion.relatedTags.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mt: 0.5 }}>
          {suggestion.relatedTags.map(tagKey => (
            <Chip
              key={tagKey}
              label={tagKeys.includes(tagKey) ? getTagLabel(tagKey as BehaviorTagKey) : tagKey}
              size="small"
              variant="outlined"
              sx={{
                height: 20,
                fontSize: '0.6rem',
                '& .MuiChip-label': { px: 0.5 },
              }}
            />
          ))}
        </Box>
      )}

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: '0.55rem', display: 'block', mt: 0.25, opacity: 0.7 }}
      >
        {suggestion.evidence}
      </Typography>
    </Alert>
  );
};
