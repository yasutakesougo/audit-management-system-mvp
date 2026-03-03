/**
 * TBS — Header toolbar with user selector, edit button, and action buttons.
 */
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

export interface TbsUser {
  UserID: string;
  FullName: string;
}

export interface TbsHeaderToolbarProps {
  targetUserId: string;
  selectedUser: TbsUser | undefined;
  filteredUsers: TbsUser[];
  recentObservationsCount: number;
  onUserChange: (userId: string) => void;
  onEditorOpen: () => void;
  onRecentRecordsOpen: () => void;
  onCopyReport: () => void;
}

export const TbsHeaderToolbar: React.FC<TbsHeaderToolbarProps> = ({
  targetUserId,
  selectedUser,
  filteredUsers,
  recentObservationsCount,
  onUserChange,
  onEditorOpen,
  onRecentRecordsOpen,
  onCopyReport,
}) => (
  <Paper
    elevation={0}
    sx={{
      p: 2,
      borderBottom: 1,
      borderColor: 'divider',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 2,
      borderRadius: 1,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    }}
  >
    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
      <AccessTimeIcon color="primary" />
      <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
        <Typography variant="h6" fontWeight="bold">
          支援手順・行動記録（タイムライン）
        </Typography>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="iceberg-user-select-label">支援対象者</InputLabel>
          <Select
            labelId="iceberg-user-select-label"
            value={targetUserId}
            label="支援対象者"
            onChange={(event) => onUserChange(event.target.value)}
            startAdornment={<PersonIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />}
          >
            <MenuItem value="">
              <em>選択してください</em>
            </MenuItem>
            {filteredUsers.map((user) => (
              <MenuItem key={user.UserID} value={user.UserID}>
                {user.FullName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {targetUserId && selectedUser && (
          <IconButton
            onClick={onEditorOpen}
            size="small"
            color="primary"
            aria-label="手順を編集"
            data-testid="procedure-edit-button"
          >
            <EditIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Stack>
    {targetUserId && selectedUser && (
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          size="small"
          startIcon={
            <Badge badgeContent={recentObservationsCount} color="primary" max={99}>
              <HistoryIcon />
            </Badge>
          }
          onClick={onRecentRecordsOpen}
          data-testid="recent-records-button"
          sx={{ whiteSpace: 'nowrap' }}
        >
          直近記録
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ContentCopyIcon />}
          onClick={onCopyReport}
          data-testid="copy-daily-report-button"
          sx={{ whiteSpace: 'nowrap' }}
        >
          日報コピー
        </Button>
      </Stack>
    )}
  </Paper>
);

export default TbsHeaderToolbar;
