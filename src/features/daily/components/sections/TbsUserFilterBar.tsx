/**
 * TBS — User filter bar with support level, usage status, and high-intensity toggle.
 */
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
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

import { DISABILITY_SUPPORT_LEVEL_OPTIONS } from '@/features/users/typesExtended';

export interface TbsUserFilter {
  supportLevel: string;
  usageStatus: string;
  highIntensityOnly: boolean;
}

export interface TbsUserFilterBarProps {
  filter: TbsUserFilter;
  onUpdateFilter: (patch: Partial<TbsUserFilter>) => void;
  onResetFilter: () => void;
  hasActiveFilter: boolean;
  filteredCount: number;
  totalCount: number;
}

export const TbsUserFilterBar: React.FC<TbsUserFilterBarProps> = ({
  filter,
  onUpdateFilter,
  onResetFilter,
  hasActiveFilter,
  filteredCount,
  totalCount,
}) => (
  <Paper
    elevation={0}
    sx={{
      px: 2,
      py: 1,
      borderTop: 0,
      borderBottom: 1,
      borderColor: 'divider',
      borderRadius: 0,
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      flexWrap: 'wrap',
      bgcolor: hasActiveFilter ? 'action.hover' : 'background.paper',
    }}
    data-testid="daily-support-user-filter-bar"
  >
    <FormControl size="small" sx={{ minWidth: 130 }}>
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

    <FormControl size="small" sx={{ minWidth: 120 }}>
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
          label={`${filteredCount}/${totalCount}人`}
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
  </Paper>
);

export default TbsUserFilterBar;
