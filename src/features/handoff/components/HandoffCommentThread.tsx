/**
 * HandoffCommentThread — 申し送りコメントスレッド
 *
 * 薄い Orchestrator: useHandoffComments フック、
 * HandoffCommentList, HandoffCommentInput を合成し、
 * ヘッダー / ローディング / エラー表示を担当。
 *
 * TodayHandoffTimelineList の展開エリアに埋め込んで使用。
 */

import { useAuth } from '@/auth/useAuth';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useCallback } from 'react';
import { useHandoffComments } from '../hooks/useHandoffComments';
import { HandoffCommentInput } from './HandoffCommentInput';
import { HandoffCommentList } from './HandoffCommentList';

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

export type HandoffCommentThreadProps = {
  handoffId: number;
  /** 監査ログ記録用コールバック (Phase 5 で接続) */
  onCommentAdded?: () => void;
};

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export const HandoffCommentThread: React.FC<HandoffCommentThreadProps> = ({
  handoffId,
  onCommentAdded,
}) => {
  const { account } = useAuth();
  const {
    comments,
    loading,
    error,
    addComment,
    deleteComment,
    commentCount,
  } = useHandoffComments(handoffId);

  // ── 送信ハンドラ（Input → hook へ橋渡し） ──
  const handleSubmit = useCallback(
    async (body: string) => {
      await addComment({
        body,
        authorName: account?.name ?? account?.username ?? 'ユーザー',
        authorAccount: account?.username ?? 'unknown',
      });
      onCommentAdded?.();
    },
    [addComment, account, onCommentAdded],
  );

  return (
    <Box sx={{ mt: 1 }}>
      {/* ── ヘッダー ── */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        <ChatBubbleOutlineIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600 }}
        >
          コメント
        </Typography>
        {commentCount > 0 && (
          <Chip
            size="small"
            label={`${commentCount}件`}
            sx={{ fontSize: '0.65rem', height: 18 }}
          />
        )}
      </Stack>

      {/* ── ローディング ── */}
      {loading && (
        <Stack alignItems="center" sx={{ py: 1 }}>
          <CircularProgress size={20} />
        </Stack>
      )}

      {/* ── エラー ── */}
      {error && (
        <Typography
          variant="caption"
          color="error"
          sx={{ display: 'block', mb: 1 }}
        >
          ⚠️ {error}
        </Typography>
      )}

      {/* ── コメント一覧（Slack 風） ── */}
      {!loading && (
        <HandoffCommentList comments={comments} onDelete={deleteComment} />
      )}

      <Divider sx={{ my: 1 }} />

      {/* ── 入力フォーム ── */}
      <HandoffCommentInput onSubmit={handleSubmit} disabled={loading} />
    </Box>
  );
};
