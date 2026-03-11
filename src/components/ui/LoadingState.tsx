import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

type LoadingStateProps = {
  message?: string;
  minHeight?: number | string;
  inline?: boolean;
};

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = '読み込み中...',
  minHeight = '10vh',
  inline = false,
}) => {
  if (inline) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 2 }}>
        <CircularProgress size={20} />
        <Typography variant="body2">{message}</Typography>
      </Stack>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight, p: 4 }}>
      <Stack spacing={2} alignItems="center">
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </Stack>
    </Box>
  );
};
