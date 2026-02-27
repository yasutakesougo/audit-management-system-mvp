import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import React from 'react';

export type UserRow = {
  userId: string;
  name: string;
  status: 'present' | 'absent' | 'unknown';
  recordFilled?: boolean;
};

export type UserCompactListProps = {
  items: UserRow[];
  onOpenQuickRecord: (id: string) => void;
};

export const UserCompactList: React.FC<UserCompactListProps> = ({ items, onOpenQuickRecord }) => {
  if (items.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        利用予定はありません
      </Typography>
    );
  }

  return (
    <Stack spacing={1.25}>
      {items.map((u) => (
        <Paper
          key={u.userId}
          role="button"
          tabIndex={0}
          onClick={() => onOpenQuickRecord(u.userId)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenQuickRecord(u.userId);
            }
          }}
          sx={{
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            minHeight: 44, // タップ領域確保 (PR3要件)
            transition: 'background-color 0.2s',
            '&:hover, &:focus-visible': { bgcolor: 'action.hover' },
            outline: 'none',
            ...(u.status === 'absent' && {
              opacity: 0.6,
            }),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {u.recordFilled && (
              <CheckCircleIcon
                sx={{ fontSize: 18, color: 'success.main' }}
                aria-label="記録済み"
              />
            )}
            <Typography
              variant="body1"
              fontWeight={500}
              sx={u.recordFilled ? { color: 'text.secondary' } : undefined}
            >
              {u.name}
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            tabIndex={-1} // 親のPaperがフォーカスを受け取るため
            sx={{ minHeight: 36, pointerEvents: 'none' }}
          >
            記録
          </Button>
        </Paper>
      ))}
    </Stack>
  );
};
