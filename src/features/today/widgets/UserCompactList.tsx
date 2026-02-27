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

// rerender-memo: memoized row to avoid full-list re-renders
const UserCompactRow = React.memo<{
  user: UserRow;
  onOpenQuickRecord: (id: string) => void;
}>(function UserCompactRow({ user, onOpenQuickRecord }) {
  return (
    <Paper
      key={user.userId}
      role="button"
      tabIndex={0}
      onClick={() => onOpenQuickRecord(user.userId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenQuickRecord(user.userId);
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
        ...(user.status === 'absent' && {
          opacity: 0.6,
        }),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* rendering-conditional-render: ternary over && */}
        {user.recordFilled ? (
          <CheckCircleIcon
            sx={{ fontSize: 18, color: 'success.main' }}
            aria-label="記録済み"
          />
        ) : null}
        <Typography
          variant="body1"
          fontWeight={500}
          sx={user.recordFilled ? { color: 'text.secondary' } : undefined}
        >
          {user.name}
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
  );
});

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
        <UserCompactRow
          key={u.userId}
          user={u}
          onOpenQuickRecord={onOpenQuickRecord}
        />
      ))}
    </Stack>
  );
};
