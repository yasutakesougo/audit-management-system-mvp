import { TESTIDS } from '@/testids';
import type { User } from '@/types';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ClearAll as ClearAllIcon, Group as GroupIcon, PersonAdd as PersonAddIcon, Search as SearchIcon } from '@mui/icons-material';
import React from 'react';

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
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <GroupIcon sx={{ mr: 1 }} />
        利用者選択
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="名前またはIDで検索"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ flexGrow: 1 }}
        />
        <Tooltip title="今日の通所者のみ表示">
          <Button
            variant={showTodayOnly ? 'contained' : 'outlined'}
            size="small"
            onClick={onToggleShowToday}
            sx={{ minWidth: 120, fontSize: '0.75rem' }}
          >
            {showTodayOnly ? '通所日のみ' : '全利用者'}
          </Button>
        </Tooltip>
        <Tooltip title="表示中の利用者を全選択">
          <IconButton aria-label="表示中の利用者を全選択" onClick={onSelectAll}>
            <PersonAddIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="選択をクリア">
          <IconButton aria-label="選択をクリア" onClick={onClearAll}>
            <ClearAllIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {showTodayOnly && (
        <Alert severity="success" sx={{ mb: 1 }}>
          {new Date(formDate).toLocaleDateString('ja-JP', {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}の通所者のみ表示中（{filteredUsers.length}人）
        </Alert>
      )}
      {selectedUserIds.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="selection-count">
          {selectedUserIds.length}人の利用者が選択されています（一覧表に表示されます）
        </Alert>
      )}

      <Box
        data-testid={TESTIDS['daily-table-record-form-user-list']}
        sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}
      >
        {filteredUsers.map((user) => (
          <Box
            key={user.userId}
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 1,
              py: 0.5,
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' },
            }}
          >
            <Checkbox
              checked={selectedUserIds.includes(user.userId || '')}
              onChange={() => onUserToggle(user.userId || '')}
              size="small"
              inputProps={{ 'aria-label': `${user.name} (${user.userId || 'ID未設定'})` }}
            />
            <Typography variant="body2" sx={{ ml: 1 }}>
              {user.name} ({user.userId})
            </Typography>
          </Box>
        ))}
        {filteredUsers.length === 0 && (
          <Typography variant="body2" color="textSecondary" sx={{ p: 2, textAlign: 'center' }}>
            該当する利用者が見つかりません
          </Typography>
        )}
      </Box>
    </Paper>
  );
};
