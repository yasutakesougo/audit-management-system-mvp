import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import type { IUserMaster } from '../types';

import { formatDateJapanese } from '@/lib/dateFormat';

const formatDateLabel = (value?: string | null): string => {
  if (!value) return '未設定';
  const formatted = formatDateJapanese(value, '');
  return formatted || value; // parse失敗時は元の値を返す
};

const resolveUserIdentifier = (user: IUserMaster): string => user.UserID || String(user.Id);

const renderHighlights = (items: string[]): ReactNode => (
  <Box component="ul" sx={{ m: 0, pl: 3, display: 'grid', gap: 1 }}>
    {items.map((item, index) => (
      <Typography key={index} component="li" variant="body2" color="text.secondary">
        {item}
      </Typography>
    ))}
  </Box>
);

export { formatDateLabel, renderHighlights, resolveUserIdentifier };
