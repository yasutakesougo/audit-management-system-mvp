/**
 * ErrorState — 共通エラー表示
 *
 * page / panel / drawer / detail view 共通の入口。
 * severity でスタイルを切り替える。
 */
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import React from 'react';

export interface ErrorStateProps {
  /** エラーメッセージ */
  message?: string;
  /** タイトル (default: 'エラー') */
  title?: string;
  /** Alert severity (default: 'error') */
  severity?: 'error' | 'warning' | 'info';
  /** リトライ可能な場合のコールバック */
  onRetry?: () => void;
  /** リトライボタンのラベル (default: '再試行') */
  retryLabel?: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'エラーが発生しました',
  title,
  severity = 'error',
  onRetry,
  retryLabel = '再試行',
}) => (
  <Stack sx={{ py: 2, px: 1 }}>
    <Alert
      severity={severity}
      variant="outlined"
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : undefined
      }
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      {message}
    </Alert>
  </Stack>
);

export default ErrorState;
