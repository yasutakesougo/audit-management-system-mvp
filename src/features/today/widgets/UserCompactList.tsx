import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditNoteIcon from '@mui/icons-material/EditNote';
import { Box, Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
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
  onOpenISP?: (id: string) => void;
};

// rerender-memo: memoized row to avoid full-list re-renders
const UserCompactRow = React.memo<{
  user: UserRow;
  onOpenQuickRecord: (id: string) => void;
  onOpenISP?: (id: string) => void;
}>(function UserCompactRow({ user, onOpenQuickRecord, onOpenISP }) {
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {onOpenISP ? (
          <Tooltip title="個別支援計画（ISP）">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => { e.stopPropagation(); onOpenISP(user.userId); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
              aria-label={`${user.name}のISPを確認`}
              sx={{ minHeight: 44, minWidth: 44, bgcolor: 'primary.50', '&:hover': { bgcolor: 'primary.100' } }}
            >
              <EditNoteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
        <Button
          size="small"
          variant="outlined"
          tabIndex={-1}
          sx={{ minHeight: 44, pointerEvents: 'none' }}
        >
          記録
        </Button>
      </Box>
    </Paper>
  );
});

export const UserCompactList: React.FC<UserCompactListProps> = ({ items, onOpenQuickRecord, onOpenISP }) => {
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
          onOpenISP={onOpenISP}
        />
      ))}
    </Stack>
  );
};
