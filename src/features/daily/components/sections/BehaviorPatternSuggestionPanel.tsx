/**
 * @fileoverview ルールベース行動パターン提案パネル
 * @description
 * Issue #7 のクロス集計結果から Issue #8 のルールエンジンで生成した示唆を表示する。
 * Issue #9 で「メモに残す」「閉じる」アクションを追加。
 * Issue #10 で accept 時に ISP 候補フィードバックを表示。
 *
 * - Suggestion が1件以上あれば表示（デフォルト展開済み）
 * - 最大3件
 * - severity に応じたアイコン色
 * - accept/dismiss 済みの提案はパネルから非表示
 */

import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Snackbar,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';
import { getTagLabel, BEHAVIOR_TAG_KEYS, type BehaviorTagKey } from '../../domain/behavior/behaviorTag';
import type { BehaviorTagCrossInsights } from '../../domain/behavior/behaviorTagCrossInsights';
import {
  generatePatternSuggestions,
  type PatternSuggestion,
  type SuggestionSeverity,
} from '../../domain/behavior/behaviorPatternSuggestions';
import { isAlreadyActioned, type SuggestionAction } from '../../domain/legacy/suggestionAction';

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
  /** 既にアクション済みの提案リスト（二重転記防止） */
  acceptedSuggestions?: SuggestionAction[];
  /** 「メモに残す」押下時 */
  onAcceptSuggestion?: (suggestion: PatternSuggestion) => void;
  /** 「閉じる」押下時 */
  onDismissSuggestion?: (suggestion: PatternSuggestion) => void;
};

// ─── Component ──────────────────────────────────────────

export const BehaviorPatternSuggestionPanel: React.FC<BehaviorPatternSuggestionPanelProps> = ({
  insights,
  acceptedSuggestions,
  onAcceptSuggestion,
  onDismissSuggestion,
}) => {
  const theme = useTheme();

  // セッション中に dismiss/accept した ruleId+message を追跡
  const [sessionDismissed, setSessionDismissed] = useState<Set<string>>(new Set());
  // Issue #10: ISP候補フィードバック
  const [snackOpen, setSnackOpen] = useState(false);

  const suggestions = useMemo(() => {
    const all = generatePatternSuggestions(insights);
    // 既にアクション済み or セッション中に操作済みの提案を除外
    return all.filter(s => {
      const key = `${s.ruleId}::${s.message}`;
      if (sessionDismissed.has(key)) return false;
      if (isAlreadyActioned(acceptedSuggestions, s.ruleId, s.message)) return false;
      return true;
    });
  }, [insights, acceptedSuggestions, sessionDismissed]);

  const handleAccept = useCallback((suggestion: PatternSuggestion) => {
    const key = `${suggestion.ruleId}::${suggestion.message}`;
    setSessionDismissed(prev => new Set(prev).add(key));
    onAcceptSuggestion?.(suggestion);
    // Issue #10: ISP候補フィードバック
    setSnackOpen(true);
  }, [onAcceptSuggestion]);

  const handleDismiss = useCallback((suggestion: PatternSuggestion) => {
    const key = `${suggestion.ruleId}::${suggestion.message}`;
    setSessionDismissed(prev => new Set(prev).add(key));
    onDismissSuggestion?.(suggestion);
  }, [onDismissSuggestion]);

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
          <SuggestionItem
            key={suggestion.ruleId}
            suggestion={suggestion}
            onAccept={onAcceptSuggestion ? handleAccept : undefined}
            onDismiss={onDismissSuggestion ? handleDismiss : undefined}
          />
        ))}
      </Stack>

      {/* Issue #10: ISP候補フィードバック */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message="✅ メモに残しました → 個別支援計画候補にも追加されます"
      />
    </Paper>
  );
};

// ─── SuggestionItem ─────────────────────────────────────

type SuggestionItemProps = {
  suggestion: PatternSuggestion;
  onAccept?: (suggestion: PatternSuggestion) => void;
  onDismiss?: (suggestion: PatternSuggestion) => void;
};

const SuggestionItem: React.FC<SuggestionItemProps> = ({ suggestion, onAccept, onDismiss }) => {
  const config = SEVERITY_CONFIG[suggestion.severity];
  const tagKeys = BEHAVIOR_TAG_KEYS as string[];

  return (
    <Alert
      severity={config.muiSeverity}
      icon={config.icon}
      sx={{
        py: 0.25,
        px: 1,
        '& .MuiAlert-message': { py: 0.25, width: '100%' },
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

      {/* Issue #9: アクションボタン */}
      {(onAccept || onDismiss) && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
          {onAccept && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<NoteAddOutlinedIcon sx={{ fontSize: '0.7rem !important' }} />}
              onClick={() => onAccept(suggestion)}
              sx={{
                fontSize: '0.6rem',
                py: 0,
                px: 0.75,
                minHeight: 24,
                textTransform: 'none',
              }}
            >
              メモに残す
            </Button>
          )}
          {onDismiss && (
            <Button
              size="small"
              color="inherit"
              startIcon={<CloseIcon sx={{ fontSize: '0.7rem !important' }} />}
              onClick={() => onDismiss(suggestion)}
              sx={{
                fontSize: '0.6rem',
                py: 0,
                px: 0.75,
                minHeight: 24,
                textTransform: 'none',
                opacity: 0.6,
              }}
            >
              閉じる
            </Button>
          )}
        </Box>
      )}
    </Alert>
  );
};
