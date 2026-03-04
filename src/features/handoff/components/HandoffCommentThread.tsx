/**
 * 申し送りコメントスレッド表示 + 入力フォーム
 *
 * 申し送り1件に紐づくコメント一覧と新規コメント投稿UI。
 * TodayHandoffTimelineList の展開エリアに埋め込んで使用。
 */

import { useAuth } from '@/auth/useAuth';
import {
    ChatBubbleOutline as ChatIcon,
    Delete as DeleteIcon,
    Send as SendIcon,
} from '@mui/icons-material';
import {
    Avatar,
    Box,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useHandoffComments } from '../handoffCommentApi';

// ────────────────────────────────────────────────────────────
// コメントスレッド + 入力
// ────────────────────────────────────────────────────────────

type HandoffCommentThreadProps = {
  handoffId: number;
  /** 監査ログ記録用コールバック (Phase 5 で接続) */
  onCommentAdded?: () => void;
};

/**
 * 申し送りコメントスレッド
 */
export const HandoffCommentThread: React.FC<HandoffCommentThreadProps> = ({
  handoffId,
  onCommentAdded,
}) => {
  const { account } = useAuth();
  const {
    comments,
    loading,
    error,
    loadComments,
    addComment,
    deleteComment,
  } = useHandoffComments(handoffId);
  const [newBody, setNewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 初回読み込み
  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = useCallback(async () => {
    if (!newBody.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addComment({
        body: newBody.trim(),
        authorName: account?.name ?? account?.username ?? 'ユーザー',
        authorAccount: account?.username ?? 'unknown',
      });
      setNewBody('');
      onCommentAdded?.();
    } catch {
      // エラーは useHandoffComments 内で処理済み
    } finally {
      setSubmitting(false);
    }
  }, [newBody, submitting, addComment, account, onCommentAdded]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleDelete = useCallback(async (commentId: number) => {
    try {
      await deleteComment(commentId);
    } catch {
      // エラーは useHandoffComments 内で処理済み
    }
  }, [deleteComment]);

  const formatTime = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitial = (name: string): string => {
    return name.charAt(0).toUpperCase();
  };

  return (
    <Box sx={{ mt: 1 }}>
      {/* ヘッダー */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        <ChatIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          コメント
        </Typography>
        {comments.length > 0 && (
          <Chip
            size="small"
            label={`${comments.length}件`}
            sx={{ fontSize: '0.65rem', height: 18 }}
          />
        )}
      </Stack>

      {/* ローディング */}
      {loading && (
        <Stack alignItems="center" sx={{ py: 1 }}>
          <CircularProgress size={20} />
        </Stack>
      )}

      {/* エラー */}
      {error && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
          ⚠️ {error}
        </Typography>
      )}

      {/* コメント一覧 */}
      {comments.length > 0 && (
        <Stack spacing={1} sx={{ mb: 1.5 }}>
          {comments.map(comment => (
            <Box
              key={comment.id}
              sx={{
                display: 'flex',
                gap: 1,
                pl: 0.5,
              }}
            >
              <Avatar
                sx={{
                  width: 24,
                  height: 24,
                  fontSize: '0.75rem',
                  bgcolor: 'primary.main',
                  flexShrink: 0,
                  mt: 0.25,
                }}
              >
                {getInitial(comment.authorName)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {comment.authorName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(comment.createdAt)}
                  </Typography>
                  {account?.username === comment.authorAccount && (
                    <Tooltip title="削除">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(comment.id)}
                        sx={{ ml: 'auto', p: 0.25 }}
                      >
                        <DeleteIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5,
                    fontSize: '0.8125rem',
                  }}
                >
                  {comment.body}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 1 }} />

      {/* 入力フォーム */}
      <Stack direction="row" spacing={1} alignItems="flex-end">
        <TextField
          size="small"
          placeholder="返信を入力… (Ctrl+Enter で送信)"
          multiline
          maxRows={3}
          value={newBody}
          onChange={e => setNewBody(e.target.value)}
          onKeyDown={handleKeyDown}
          fullWidth
          variant="outlined"
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '0.8125rem',
            },
          }}
        />
        <IconButton
          color="primary"
          onClick={handleSubmit}
          disabled={!newBody.trim() || submitting}
          size="small"
          sx={{ flexShrink: 0 }}
        >
          {submitting ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
        </IconButton>
      </Stack>
    </Box>
  );
};
