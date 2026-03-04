/**
 * CompactNewHandoffInput — ダッシュボード Action Rail 用 コンパクト申し送り入力
 *
 * 340px 幅のサイドレールに配置する省スペース版。
 * 最低限のフィールド（対象・カテゴリ・重要度・本文）のみ表示し、
 * 1タップ/Enter で即送信できる UX を提供。
 *
 * 特長:
 * - TimeBand は自動判定（手動不要）
 * - カテゴリ / 重要度は Chip Toggle で省スペース
 * - Enter 送信、Shift+Enter 改行
 * - 送信成功 → ✅ スナックバー風インラインフィードバック
 * - 送信失敗 → ⚠️ エラー表示
 * - 連続入力に最適化（カテゴリ・重要度はリセットしない）
 */

import { motionTokens } from '@/app/theme';
import type { IUserMaster } from '@/sharepoint/fields';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SendIcon from '@mui/icons-material/Send';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUsersDemo } from '../../users/usersStoreDemo';
import type { HandoffCategory, HandoffSeverity } from '../handoffTypes';
import { getTimeBandPlaceholder, useCurrentTimeBand } from '../useCurrentTimeBand';
import { useHandoffTimeline } from '../useHandoffTimeline';

// ── Constants ──

const CATEGORY_OPTIONS: { label: string; value: HandoffCategory; emoji: string }[] = [
  { label: '体調', value: '体調', emoji: '🩺' },
  { label: '行動面', value: '行動面', emoji: '🏃' },
  { label: '家族連絡', value: '家族連絡', emoji: '📞' },
  { label: '支援の工夫', value: '支援の工夫', emoji: '💡' },
  { label: '良かった', value: '良かったこと', emoji: '✨' },
  { label: 'ヒヤリ', value: '事故・ヒヤリ', emoji: '⚠️' },
  { label: 'その他', value: 'その他', emoji: '📝' },
];

const SEVERITY_OPTIONS: { label: string; value: HandoffSeverity; color: 'default' | 'warning' | 'error' }[] = [
  { label: '通常', value: '通常', color: 'default' },
  { label: '要注意', value: '要注意', color: 'warning' },
  { label: '重要', value: '重要', color: 'error' },
];

/** 送信成功フィードバック表示時間 (ms) */
const SUCCESS_DISPLAY_MS = 2500;

type TargetOption = 'ALL' | IUserMaster;

// ── Props ──

export interface CompactNewHandoffInputProps {
  /** 送信成功時のコールバック（タイムラインリフレッシュ等） */
  onSuccess?: () => void;
}

// ── Component ──

export const CompactNewHandoffInput: React.FC<CompactNewHandoffInputProps> = ({
  onSuccess,
}) => {
  const theme = useTheme();
  const timeBand = useCurrentTimeBand();
  const { createHandoff } = useHandoffTimeline();
  const { data: users } = useUsersDemo();

  // ── Form state ──
  const [target, setTarget] = useState<TargetOption>('ALL');
  const [category, setCategory] = useState<HandoffCategory>('体調');
  const [severity, setSeverity] = useState<HandoffSeverity>('通常');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // ── Feedback state ──
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showFeedback = useCallback((type: 'success' | 'error') => {
    setFeedback(type);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFeedback(null), SUCCESS_DISPLAY_MS);
  }, []);

  const placeholder = useMemo(() => getTimeBandPlaceholder(timeBand), [timeBand]);

  // ── Handlers ──

  const handleSubmit = useCallback(async () => {
    const text = message.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      const userCode = target === 'ALL' ? 'ALL' : target.UserID.toString();
      const userDisplayName = target === 'ALL' ? '全体' : target.FullName;

      await createHandoff({
        userCode,
        userDisplayName,
        category,
        severity,
        timeBand,
        message: text,
        title: `${userDisplayName} / ${category}`,
      });

      setMessage('');
      showFeedback('success');
      onSuccess?.();
    } catch (error) {
      console.error('[CompactNewHandoffInput] Submit failed:', error);
      showFeedback('error');
    } finally {
      setSubmitting(false);
    }
  }, [message, submitting, target, category, severity, timeBand, createHandoff, showFeedback, onSuccess]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const canSend = message.trim().length > 0 && !submitting;

  // ── Auto-expand when user focuses on textarea ──
  const handleFocus = useCallback(() => {
    if (!expanded) setExpanded(true);
  }, [expanded]);

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
        bgcolor: alpha(theme.palette.background.paper, 0.85),
        overflow: 'hidden',
        transition: motionTokens.transition.expandCollapse,
        '&:focus-within': {
          borderColor: alpha(theme.palette.primary.main, 0.4),
          boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.08)}`,
        },
      }}
      data-testid="compact-new-handoff-input"
    >
      {/* ── Header ── */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          },
        }}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              color: theme.palette.primary.main,
              fontSize: '0.8125rem',
            }}
          >
            ✍️ 今すぐ申し送り
          </Typography>
          <Chip
            label={`⏰ ${timeBand}`}
            size="small"
            variant="outlined"
            color="primary"
            sx={{ height: 20, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
          />
        </Stack>
        <ExpandMoreIcon
          sx={{
            fontSize: 18,
            color: 'text.secondary',
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: `transform ${motionTokens.duration.normal} ${motionTokens.easing.standard}`,
          }}
        />
      </Box>

      {/* ── Expandable Body ── */}
      <Collapse in={expanded} timeout={250}>
        <Divider />
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack spacing={1.5}>

            {/* ── 送信フィードバック ── */}
            <Collapse in={feedback !== null}>
              {feedback === 'success' && (
                <Alert
                  severity="success"
                  icon={<CheckCircleOutlineIcon fontSize="inherit" />}
                  onClose={() => setFeedback(null)}
                  sx={{
                    py: 0.25,
                    fontSize: '0.75rem',
                    '& .MuiAlert-message': { fontSize: '0.75rem', py: 0 },
                    '& .MuiAlert-icon': { py: 0.5 },
                  }}
                >
                  ✅ 送信しました！
                </Alert>
              )}
              {feedback === 'error' && (
                <Alert
                  severity="error"
                  onClose={() => setFeedback(null)}
                  sx={{
                    py: 0.25,
                    fontSize: '0.75rem',
                    '& .MuiAlert-message': { fontSize: '0.75rem', py: 0 },
                    '& .MuiAlert-icon': { py: 0.5 },
                  }}
                >
                  ⚠️ 送信失敗しました
                </Alert>
              )}
            </Collapse>

            {/* ── 対象選択 ── */}
            <TextField
              select
              label="対象"
              size="small"
              value={target === 'ALL' ? 'ALL' : target.UserID.toString()}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'ALL') {
                  setTarget('ALL');
                } else {
                  const user = users.find((u) => u.UserID.toString() === value);
                  if (user) setTarget(user);
                }
              }}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' },
                '& .MuiInputLabel-root': { fontSize: '0.8125rem' },
              }}
            >
              <MenuItem value="ALL">🌟 全体向け</MenuItem>
              <Divider />
              {users.map((user) => (
                <MenuItem key={user.UserID} value={user.UserID.toString()}>
                  {user.FullName}
                </MenuItem>
              ))}
            </TextField>

            {/* ── カテゴリ（2行 Chip Toggle） ── */}
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600, mb: 0.5, display: 'block', fontSize: '0.7rem' }}
              >
                カテゴリ
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.5,
                }}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={`${opt.emoji} ${opt.label}`}
                    size="small"
                    variant={opt.value === category ? 'filled' : 'outlined'}
                    color={opt.value === category ? 'primary' : 'default'}
                    onClick={() => setCategory(opt.value)}
                    sx={{
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      height: 24,
                      '& .MuiChip-label': { px: 0.75 },
                      transition: motionTokens.transition.microAll,
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* ── 重要度 ── */}
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600, mb: 0.5, display: 'block', fontSize: '0.7rem' }}
              >
                重要度
              </Typography>
              <Stack direction="row" spacing={0.5}>
                {SEVERITY_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    size="small"
                    variant={opt.value === severity ? 'filled' : 'outlined'}
                    color={opt.value === severity ? opt.color : 'default'}
                    onClick={() => setSeverity(opt.value)}
                    sx={{
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      height: 24,
                      '& .MuiChip-label': { px: 0.75 },
                      transition: motionTokens.transition.microAll,
                    }}
                  />
                ))}
              </Stack>
            </Box>

            {/* ── 本文入力 + 送信ボタン ── */}
            <Stack direction="row" spacing={0.75} alignItems="flex-end">
              <TextField
                placeholder={placeholder}
                multiline
                minRows={2}
                maxRows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                disabled={submitting}
                fullWidth
                variant="outlined"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '0.8125rem',
                    borderRadius: 2,
                  },
                }}
                inputProps={{
                  'data-testid': 'compact-handoff-message',
                }}
              />
              <IconButton
                color="primary"
                onClick={handleSubmit}
                disabled={!canSend}
                size="small"
                sx={{
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: canSend
                    ? alpha(theme.palette.primary.main, 0.1)
                    : 'transparent',
                  transition: motionTokens.transition.hoverAll,
                  '&:not(:disabled):hover': {
                    bgcolor: theme.palette.primary.main,
                    color: 'white',
                    transform: 'scale(1.05)',
                  },
                }}
                data-testid="compact-handoff-send"
                aria-label="申し送り送信"
              >
                {submitting ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SendIcon fontSize="small" />
                )}
              </IconButton>
            </Stack>

            {/* ── ヘルパーテキスト ── */}
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ fontSize: '0.65rem', lineHeight: 1.3 }}
            >
              Enter で送信 · Shift+Enter で改行
            </Typography>
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
};
