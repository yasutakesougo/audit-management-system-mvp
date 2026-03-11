import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  minHeight?: number | string;
};

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'エラーが発生しました',
  message = 'データの読み込みに失敗しました。時間をおいて再度お試しください。',
  onRetry,
  minHeight = '10vh',
}) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight, p: 4 }}>
      <Stack spacing={2} alignItems="center" textAlign="center">
        <ErrorOutlineIcon color="error" sx={{ fontSize: 40 }} />
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
          {message}
        </Typography>
        {onRetry && (
          <Button variant="outlined" onClick={onRetry} sx={{ mt: 2 }}>
            再試行
          </Button>
        )}
      </Stack>
    </Box>
  );
};
