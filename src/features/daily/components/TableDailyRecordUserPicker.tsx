import { TESTIDS } from '@/testids';
import type { User } from '@/types';
import {
    ClearAll as ClearAllIcon,
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon,
    Group as GroupIcon,
    PersonAdd as PersonAddIcon,
    Search as SearchIcon,
} from '@mui/icons-material';
import {
    Box,
    Button,
    Checkbox,
    Chip,
    Collapse,
    IconButton,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import React, { useState } from 'react';

type TableDailyRecordUserPickerProps = {
  formDate: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  showTodayOnly: boolean;
  onToggleShowToday: () => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  filteredUsers: User[];
  selectedUserIds: string[];
  onUserToggle: (userId: string) => void;
};

export const TableDailyRecordUserPicker: React.FC<TableDailyRecordUserPickerProps> = ({
  formDate,
  searchQuery,
  onSearchQueryChange,
  showTodayOnly,
  onToggleShowToday,
  onSelectAll,
  onClearAll,
  filteredUsers,
  selectedUserIds,
  onUserToggle,
}) => {
  const [expanded, setExpanded] = useState(false);

  const dateLabel = new Date(formDate).toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <Box>
      {/* Compact summary bar — always visible */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        data-testid="user-picker-summary"
        sx={{
          px: 1.5,
          py: 0.75,
          bgcolor: 'action.hover',
          borderRadius: 1,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.selected' },
        }}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <GroupIcon fontSize="small" color="action" />
        <Typography variant="body2" sx={{ fontWeight: 500, flexShrink: 0 }}>
          利用者
        </Typography>

        <Chip
          label={`${selectedUserIds.length}人選択中`}
          size="small"
          color={selectedUserIds.length > 0 ? 'primary' : 'default'}
          variant="outlined"
          data-testid="selection-count"
        />

        {showTodayOnly && (
          <Chip
            label={`${dateLabel} 通所者`}
            size="small"
            color="success"
            variant="outlined"
          />
        )}

        <Box sx={{ flex: 1 }} />

        {/* Quick action buttons — stop propagation to avoid toggling expansion */}
        <Tooltip title="表示中の利用者を全選択">
          <IconButton
            aria-label="表示中の利用者を全選択"
            size="small"
            onClick={(e) => { e.stopPropagation(); onSelectAll(); }}
          >
            <PersonAddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="選択をクリア">
          <IconButton
            aria-label="選択をクリア"
            size="small"
            onClick={(e) => { e.stopPropagation(); onClearAll(); }}
          >
            <ClearAllIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Stack>

      {/* Expandable detail panel */}
      <Collapse in={expanded}>
        <Box sx={{ pt: 1 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <TextField
              size="small"
              placeholder="名前またはIDで検索"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 0.5, color: 'text.secondary', fontSize: 18 }} />,
              }}
              sx={{ flexGrow: 1 }}
            />
            <Tooltip title="今日の通所者のみ表示">
              <Button
                variant={showTodayOnly ? 'contained' : 'outlined'}
                size="small"
                onClick={onToggleShowToday}
                sx={{ minWidth: 90, fontSize: '0.75rem' }}
              >
                {showTodayOnly ? '通所日のみ' : '全利用者'}
              </Button>
            </Tooltip>
          </Stack>

          <Box
            data-testid={TESTIDS['daily-table-record-form-user-list']}
            sx={{
              maxHeight: 160,
              overflow: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            {filteredUsers.map((user) => (
              <Box
                key={user.userId}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 1,
                  py: 0.25,
                  '&:hover': { backgroundColor: 'action.hover' },
                }}
              >
                <Checkbox
                  checked={selectedUserIds.includes(user.userId || '')}
                  onChange={() => onUserToggle(user.userId || '')}
                  size="small"
                  sx={{ p: 0.5 }}
                  inputProps={{ 'aria-label': `${user.name} (${user.userId || 'ID未設定'})` }}
                />
                <Typography variant="body2" sx={{ ml: 0.5, fontSize: '0.8rem' }}>
                  {user.name} ({user.userId})
                </Typography>
              </Box>
            ))}
            {filteredUsers.length === 0 && (
              <Typography variant="body2" color="textSecondary" sx={{ p: 1.5, textAlign: 'center' }}>
                該当する利用者が見つかりません
              </Typography>
            )}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};
