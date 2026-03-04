/**
 * HandoffCommentList — Slack風スレッド型コメント一覧
 *
 * UI 仕様:
 * - 左上にアバターアイコン（名前の頭文字）
 * - その右に名前 + 投稿時間
 * - その下にテキスト本文
 * - 自分のコメントには削除ボタン
 *
 * UX 仕様:
 * - 初回マウント時、および新規追加時に最新コメントへ自動スクロール
 * - 楽観的更新のコメント（id < 0）には送信中インジケーター
 */

import { useAuth } from '@/auth/useAuth';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useRef } from 'react';
import type { HandoffComment } from '../handoffCommentTypes';

// ── Helpers ──

/** 名前のイニシャル（全角文字対応） */
function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

/** 投稿時刻フォーマット: "3/4 14:30" */
function formatCommentTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** アバター色をアカウント名からハッシュ生成 */
function avatarColor(name: string): string {
  const colors = [
    '#2E7D32', '#1565C0', '#AD1457', '#E65100',
    '#4527A0', '#00838F', '#558B2F', '#C62828',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ── Props ──

export interface HandoffCommentListProps {
  comments: HandoffComment[];
  onDelete?: (commentId: number) => void;
}

// ── Component ──

export const HandoffCommentList: React.FC<HandoffCommentListProps> = ({
  comments,
  onDelete,
}) => {
  const theme = useTheme();
  const { account } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(comments.length);

  // 初回マウント + 新規コメント追加時に最下部へスクロール
  useEffect(() => {
    if (comments.length > 0) {
      // 初回：即座にスクロール、追加時：スムーズにスクロール
      const behavior = prevCountRef.current === 0 ? 'auto' : 'smooth';
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
    }
    prevCountRef.current = comments.length;
  }, [comments.length]);

  if (comments.length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          まだコメントはありません
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={0.5} data-testid="handoff-comment-list">
      {comments.map((comment) => {
        const isOptimistic = comment.id < 0;
        const isMe = account?.username === comment.authorAccount;
        const bgColor = isOptimistic
          ? alpha(theme.palette.primary.main, 0.04)
          : 'transparent';

        return (
          <Box
            key={comment.id}
            sx={{
              display: 'flex',
              gap: 1,
              px: 0.75,
              py: 0.75,
              borderRadius: 1.5,
              bgcolor: bgColor,
              transition: 'background-color 0.3s ease',
              '&:hover': {
                bgcolor: alpha(theme.palette.action.hover, 0.06),
              },
            }}
          >
            {/* アバター */}
            <Avatar
              sx={{
                width: 28,
                height: 28,
                fontSize: '0.75rem',
                fontWeight: 700,
                bgcolor: avatarColor(comment.authorName),
                flexShrink: 0,
                mt: 0.25,
              }}
            >
              {getInitial(comment.authorName)}
            </Avatar>

            {/* コンテンツ */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* 名前 + 時刻 + 削除 */}
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: 'text.primary',
                    fontSize: '0.75rem',
                  }}
                >
                  {comment.authorName}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.disabled',
                    fontSize: '0.65rem',
                  }}
                >
                  {formatCommentTime(comment.createdAt)}
                </Typography>

                {/* 楽観的更新中インジケーター */}
                {isOptimistic && (
                  <CircularProgress size={12} sx={{ ml: 0.5 }} />
                )}

                {/* 自分のコメントのみ削除可能 */}
                {isMe && !isOptimistic && onDelete && (
                  <Tooltip title="削除" arrow>
                    <IconButton
                      size="small"
                      onClick={() => onDelete(comment.id)}
                      sx={{
                        ml: 'auto',
                        p: 0.25,
                        opacity: 0,
                        '.MuiBox-root:hover &': { opacity: 1 },
                        transition: 'opacity 0.15s ease',
                        color: 'text.disabled',
                        '&:hover': { color: 'error.main' },
                      }}
                      aria-label={`コメント削除: ${comment.body.slice(0, 20)}`}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>

              {/* 本文 */}
              <Typography
                variant="body2"
                sx={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.5,
                  fontSize: '0.8125rem',
                  color: isOptimistic ? 'text.secondary' : 'text.primary',
                }}
              >
                {comment.body}
              </Typography>
            </Box>
          </Box>
        );
      })}

      {/* スクロールアンカー */}
      <div ref={bottomRef} />
    </Stack>
  );
};
