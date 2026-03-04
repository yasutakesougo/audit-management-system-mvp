/**
 * HandoffCommentInput — コメント入力フォーム
 *
 * UX 仕様:
 * - Enter で送信、Shift+Enter で改行
 * - 送信中は入力欄とボタンを disabled
 * - 送信完了後に入力欄をクリア
 */

import { motionTokens } from '@/app/theme';
import SendIcon from '@mui/icons-material/Send';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import React, { useCallback, useState } from 'react';

export interface HandoffCommentInputProps {
  onSubmit: (body: string) => Promise<void>;
  disabled?: boolean;
}

export const HandoffCommentInput: React.FC<HandoffCommentInputProps> = ({
  onSubmit,
  disabled = false,
}) => {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isDisabled = disabled || submitting;
  const canSend = body.trim().length > 0 && !isDisabled;

  const handleSubmit = useCallback(async () => {
    const text = body.trim();
    if (!text || isDisabled) return;

    setSubmitting(true);
    try {
      await onSubmit(text);
      setBody('');
    } catch {
      // エラーは親（useHandoffComments）で処理
    } finally {
      setSubmitting(false);
    }
  }, [body, isDisabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <Stack direction="row" spacing={1} alignItems="flex-end">
      <TextField
        size="small"
        placeholder="返信を入力… (Enter で送信)"
        multiline
        maxRows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        fullWidth
        variant="outlined"
        sx={{
          '& .MuiOutlinedInput-root': {
            fontSize: '0.8125rem',
            borderRadius: 2,
            bgcolor: 'background.paper',
          },
        }}
        data-testid="handoff-comment-input"
      />
      <IconButton
        color="primary"
        onClick={handleSubmit}
        disabled={!canSend}
        size="small"
        sx={{
          flexShrink: 0,
          transition: motionTokens.transition.hoverAll,
          '&:not(:disabled):hover': {
            bgcolor: 'primary.main',
            color: 'white',
          },
        }}
        data-testid="handoff-comment-send"
        aria-label="コメント送信"
      >
        {submitting ? (
          <CircularProgress size={18} color="inherit" />
        ) : (
          <SendIcon fontSize="small" />
        )}
      </IconButton>
    </Stack>
  );
};
