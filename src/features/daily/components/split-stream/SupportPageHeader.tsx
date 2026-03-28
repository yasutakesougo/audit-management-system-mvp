/**
 * SupportPageHeader — ヘッダー + フィルターバー
 *
 * TimeBasedSupportRecordPage から抽出 (#766)
 */
import type { ABCRecord } from '@/domain/behavior';
import type { DailySupportUserFilter } from '@/features/daily/hooks/legacy/useDailySupportUserFilter';
import type { IUserMaster } from '@/features/users/types';
import { DISABILITY_SUPPORT_LEVEL_OPTIONS } from '@/features/users/typesExtended';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import React from 'react';

export type SupportPageHeaderProps = {
  targetUserId: string;
  selectedUser?: IUserMaster;
  filteredUsers: IUserMaster[];
  allUsersCount: number;
  recentObservations: ABCRecord[];
  filter: DailySupportUserFilter;
  hasActiveFilter: boolean;
  onUserChange: (userId: string) => void;
  onEditorOpen: () => void;
  onRecentRecordsOpen: () => void;
  onCopyReport: () => void;
  onUpdateFilter: (patch: Partial<DailySupportUserFilter>) => void;
  onResetFilter: () => void;
};

export const SupportPageHeader: React.FC<SupportPageHeaderProps> = ({
  targetUserId,
  selectedUser,
  filteredUsers,
  allUsersCount,
  recentObservations,
  filter,
  hasActiveFilter,
  onUserChange,
  onEditorOpen,
  onRecentRecordsOpen,
  onCopyReport,
  onUpdateFilter,
  onResetFilter,
}) => {
  return (
    <Paper
      elevation={0}
      sx={{
        px: 2,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        borderRadius: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexWrap: 'wrap',
        bgcolor: hasActiveFilter ? 'action.hover' : 'background.paper',
      }}
      data-testid="daily-support-user-filter-bar"
    >
      {/* ── User Selector ── */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
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

      {/* ── Filters ── */}
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel id="filter-support-level-label">支援区分</InputLabel>
        <Select
          labelId="filter-support-level-label"
          value={filter.supportLevel}
          label="支援区分"
          onChange={(e) => onUpdateFilter({ supportLevel: e.target.value })}
          data-testid="filter-support-level"
        >
          {DISABILITY_SUPPORT_LEVEL_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 110 }}>
        <InputLabel id="filter-usage-status-label">ステータス</InputLabel>
        <Select
          labelId="filter-usage-status-label"
          value={filter.usageStatus}
          label="ステータス"
          onChange={(e) => onUpdateFilter({ usageStatus: e.target.value })}
          data-testid="filter-usage-status"
        >
          <MenuItem value="">（全て）</MenuItem>
          <MenuItem value="active">利用中</MenuItem>
          <MenuItem value="pending">開始待ち</MenuItem>
          <MenuItem value="suspended">休止中</MenuItem>
          <MenuItem value="terminated">契約終了</MenuItem>
        </Select>
      </FormControl>

      <Tooltip title="強度行動障害支援対象者のみ表示">
        <ToggleButton
          value="highIntensity"
          selected={filter.highIntensityOnly}
          onChange={() => onUpdateFilter({ highIntensityOnly: !filter.highIntensityOnly })}
          size="small"
          sx={{ textTransform: 'none', fontSize: '0.8rem', px: 1.5 }}
          data-testid="filter-high-intensity"
        >
          強度行動障害
        </ToggleButton>
      </Tooltip>

      {hasActiveFilter && (
        <>
          <Chip
            label={`${filteredUsers.length}/${allUsersCount}人`}
            size="small"
            color="primary"
            variant="outlined"
          />
          <Tooltip title="フィルターをリセット">
            <IconButton size="small" onClick={onResetFilter} aria-label="フィルターをリセット">
              <FilterListOffIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}

      {/* ── Action Buttons (visible when user selected) ── */}
      {targetUserId && selectedUser && (
        <>
          <IconButton
            onClick={onEditorOpen}
            size="small"
            color="primary"
            aria-label="手順を編集"
            data-testid="procedure-edit-button"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <Button
            variant="outlined"
            size="small"
            startIcon={
              <Badge badgeContent={recentObservations.length} color="primary" max={99}>
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
        </>
      )}
    </Paper>
  );
};
