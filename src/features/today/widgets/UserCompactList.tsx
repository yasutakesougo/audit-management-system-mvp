import { motionTokens } from '@/app/theme';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditNoteIcon from '@mui/icons-material/EditNote';
import GroupOffIcon from '@mui/icons-material/GroupOff';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Box, Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import React, { useMemo, useState } from 'react';
import { EmptyStateBlock } from './EmptyStateBlock';

/** 初期表示件数 — 未記録優先で上位 n 件を表示 */
const INITIAL_DISPLAY_COUNT = 6;

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
  /** zero-users 時の弱いCTA（スケジュール確認等） */
  onEmptyAction?: () => void;
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
        p: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        minHeight: 44, // タップ領域確保 (PR3要件)
        transition: motionTokens.transition.bgColor,
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

export const UserCompactList: React.FC<UserCompactListProps> = ({ items, onOpenQuickRecord, onOpenISP, onEmptyAction }) => {
  const [expanded, setExpanded] = useState(false);

  // 未記録を先頭に並べる（元の順序を保ちつつ）
  const sorted = useMemo(() => {
    const unfilled = items.filter((u) => !u.recordFilled);
    const filled = items.filter((u) => u.recordFilled);
    return [...unfilled, ...filled];
  }, [items]);

  const needsFold = sorted.length > INITIAL_DISPLAY_COUNT;
  const visible = expanded || !needsFold ? sorted : sorted.slice(0, INITIAL_DISPLAY_COUNT);
  const hiddenCount = sorted.length - INITIAL_DISPLAY_COUNT;

  if (items.length === 0) {
    return (
      <EmptyStateBlock
        icon={<GroupOffIcon />}
        title="本日の通所予定はありません"
        description="共有事項や明日の予定を確認できます。"
        primaryAction={
          onEmptyAction
            ? { label: 'スケジュールを確認', onClick: onEmptyAction, testId: 'today-empty-users-cta' }
            : undefined
        }
        testId="today-empty-users"
      />
    );
  }

  return (
    <Stack spacing={1}>
      {visible.map((u) => (
        <UserCompactRow
          key={u.userId}
          user={u}
          onOpenQuickRecord={onOpenQuickRecord}
          onOpenISP={onOpenISP}
        />
      ))}
      {needsFold && (
        <Button
          size="small"
          variant="text"
          onClick={() => setExpanded((prev) => !prev)}
          startIcon={expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          data-testid="users-show-more"
          sx={{
            textTransform: 'none',
            fontSize: '0.8rem',
            color: 'text.secondary',
            alignSelf: 'center',
            mt: 0.5,
          }}
        >
          {expanded ? '折りたたむ' : `他 ${hiddenCount} 名を表示`}
        </Button>
      )}
    </Stack>
  );
};
