/**
 * LoadingState — 共通ローディング表示
 *
 * page / panel / drawer / detail view 共通の入口。
 * variant で大きさを切り替える。
 */
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

export interface LoadingStateProps {
  /** 表示サイズ (default: 'page') */
  variant?: 'page' | 'section' | 'inline';
  /** ローディングメッセージ (default: '読み込み中…') */
  message?: string;
}

const sizeMap = {
  page: { size: 40, minHeight: '60vh', spacing: 2 },
  section: { size: 28, minHeight: '20vh', spacing: 1.5 },
  inline: { size: 20, minHeight: 'auto', spacing: 1 },
} as const;

const LoadingState: React.FC<LoadingStateProps> = ({
  variant = 'page',
  message = '読み込み中…',
}) => {
  const { size, minHeight, spacing } = sizeMap[variant];

  return (
    <Stack
      direction={variant === 'inline' ? 'row' : 'column'}
      alignItems="center"
      justifyContent="center"
      spacing={spacing}
      sx={{ minHeight, py: variant === 'inline' ? 0 : 4 }}
    >
      <CircularProgress size={size} aria-label={message ?? '読み込み中'} />
      {message && (
        <Typography
          variant={variant === 'page' ? 'body1' : 'body2'}
          color="text.secondary"
        >
          {message}
        </Typography>
      )}
    </Stack>
  );
};

export default LoadingState;
