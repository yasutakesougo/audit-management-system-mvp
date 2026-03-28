import React from 'react';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import PersonIcon from '@mui/icons-material/Person';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import ViewListIcon from '@mui/icons-material/ViewList';
import {
  EXCEPTION_CATEGORIES,
  type ExceptionCategory,
  type ExceptionSeverity,
} from '../domain/exceptionLogic';
import { SEVERITY_CONFIG } from './ExceptionTable.logic';
import type {
  ExceptionTableDisplayMode,
  ExceptionTableSortMode,
  ExceptionTableSortOrder,
} from './ExceptionTable.types';

type ExceptionTableControlsProps = {
  showFilters: boolean;
  itemCount: number;
  categoryFilter: ExceptionCategory | 'all';
  severityFilter: ExceptionSeverity | 'all';
  sortMode: ExceptionTableSortMode;
  sortOrder: ExceptionTableSortOrder;
  displayMode: ExceptionTableDisplayMode;
  hasParentGroups: boolean;
  onCategoryChange: (value: ExceptionCategory | 'all') => void;
  onSeverityChange: (value: ExceptionSeverity | 'all') => void;
  onSortModeChange: (value: ExceptionTableSortMode) => void;
  onSortOrderChange: (value: ExceptionTableSortOrder) => void;
  onDisplayModeChange: (value: ExceptionTableDisplayMode) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
};

export const ExceptionTableControls: React.FC<ExceptionTableControlsProps> = ({
  showFilters,
  itemCount,
  categoryFilter,
  severityFilter,
  sortMode,
  sortOrder,
  displayMode,
  hasParentGroups,
  onCategoryChange,
  onSeverityChange,
  onSortModeChange,
  onSortOrderChange,
  onDisplayModeChange,
  onExpandAll,
  onCollapseAll,
}) => {
  if (!showFilters || itemCount === 0) return null;

  return (
    <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
      <ToggleButtonGroup
        value={displayMode}
        exclusive
        onChange={(_, v) => {
          if (v) onDisplayModeChange(v as ExceptionTableDisplayMode);
        }}
        size="small"
        color="primary"
        sx={{
          '& .MuiToggleButton-root': {
            color: 'text.primary',
          },
          '& .MuiToggleButton-root.Mui-selected': {
            color: 'primary.contrastText',
            bgcolor: 'primary.main',
            '&:hover': {
              bgcolor: 'primary.dark',
            },
          },
        }}
      >
        <ToggleButton value="flat" data-testid="exception-mode-flat">
          <ViewListIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
          フラット一覧
        </ToggleButton>
        <ToggleButton value="grouped" data-testid="exception-mode-grouped">
          <PersonIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
          利用者単位
        </ToggleButton>
      </ToggleButtonGroup>

      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>カテゴリ</InputLabel>
        <Select
          value={categoryFilter}
          label="カテゴリ"
          onChange={(e) =>
            onCategoryChange(e.target.value as ExceptionCategory | 'all')
          }
          data-testid="exception-filter-category"
        >
          <MenuItem value="all">すべて</MenuItem>
          {Object.entries(EXCEPTION_CATEGORIES).map(([key, meta]) => (
            <MenuItem key={key} value={key}>
              {meta.icon} {meta.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>重要度</InputLabel>
        <Select
          value={severityFilter}
          label="重要度"
          onChange={(e) =>
            onSeverityChange(e.target.value as ExceptionSeverity | 'all')
          }
          data-testid="exception-filter-severity"
        >
          <MenuItem value="all">すべて</MenuItem>
          {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
            <MenuItem key={key} value={key}>
              {config.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>ソート</InputLabel>
        <Select
          value={sortMode}
          label="ソート"
          onChange={(e) =>
            onSortModeChange(e.target.value as ExceptionTableSortMode)
          }
          data-testid="exception-sort-mode"
        >
          <MenuItem value="default">標準順</MenuItem>
          <MenuItem value="priority">優先度順</MenuItem>
        </Select>
      </FormControl>

      {sortMode === 'default' && (
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>並び順</InputLabel>
          <Select
            value={sortOrder}
            label="並び順"
            onChange={(e) =>
              onSortOrderChange(e.target.value as ExceptionTableSortOrder)
            }
            data-testid="exception-sort-order"
          >
            <MenuItem value="severity">🚨 重要度順</MenuItem>
            <MenuItem value="newest">⬇️ 新しい順</MenuItem>
            <MenuItem value="oldest">⬆️ 古い順</MenuItem>
          </Select>
        </FormControl>
      )}

      {displayMode === 'flat' && hasParentGroups && (
        <Stack direction="row" spacing={0.5} sx={{ ml: 'auto' }}>
          <Tooltip title="すべて展開">
            <IconButton
              size="small"
              onClick={onExpandAll}
              aria-label="すべて展開"
              data-testid="exception-expand-all"
            >
              <UnfoldMoreIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="すべて折りたたみ">
            <IconButton
              size="small"
              onClick={onCollapseAll}
              aria-label="すべて折りたたみ"
              data-testid="exception-collapse-all"
            >
              <UnfoldLessIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
    </Stack>
  );
};
