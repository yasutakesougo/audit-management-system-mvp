/**
 * OpsFilterBar — 絞り込み領域
 *
 * Phase 1 対応: serviceType, searchQuery, includeCancelled,
 *   hasAttention, hasPickup, hasBath, hasMedication, staffId
 */

import ClearIcon from '@mui/icons-material/Clear';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';

import type { OpsFilterState, OpsServiceType } from '../../domain/scheduleOps';

// ─── Service Type Toggle ─────────────────────────────────────────────────────

const SERVICE_TYPE_OPTIONS: { value: OpsServiceType | 'all'; label: string }[] = [
  { value: 'all', label: '全て' },
  { value: 'normal', label: '生活介護' },
  { value: 'respite', label: '一時ケア' },
  { value: 'shortStay', label: 'SS' },
];

// ─── Toggle Filter Chips ─────────────────────────────────────────────────────

type ToggleFilterDef = {
  key: keyof Pick<OpsFilterState, 'hasAttention' | 'hasPickup' | 'hasBath' | 'hasMedication'>;
  label: string;
  color: 'error' | 'info' | 'warning' | 'default';
};

const TOGGLE_FILTERS: readonly ToggleFilterDef[] = [
  { key: 'hasAttention', label: '注意あり', color: 'error' },
  { key: 'hasPickup', label: '送迎', color: 'info' },
  { key: 'hasBath', label: '入浴', color: 'info' },
  { key: 'hasMedication', label: '服薬', color: 'warning' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export type OpsFilterBarProps = {
  filter: OpsFilterState;
  onFilterChange: (patch: Partial<OpsFilterState>) => void;
  onClear: () => void;
  staffOptions: readonly { id: string; name: string }[];
  activeFilterCount: number;
};

export const OpsFilterBar: FC<OpsFilterBarProps> = ({
  filter,
  onFilterChange,
  onClear,
  staffOptions,
  activeFilterCount,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.5,
        px: { xs: 2, sm: 3 },
        py: 1,
      }}
    >
      {/* Service Type Toggle */}
      <ToggleButtonGroup
        value={filter.serviceType}
        exclusive
        onChange={(_, value) => {
          if (value) onFilterChange({ serviceType: value as OpsServiceType | 'all' });
        }}
        size="small"
        aria-label="サービス種別フィルター"
      >
        {SERVICE_TYPE_OPTIONS.map((opt) => (
          <ToggleButton key={opt.value} value={opt.value} sx={{ px: 1.5, py: 0.5 }}>
            {opt.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* Staff Select */}
      {staffOptions.length > 0 && (
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="ops-staff-filter-label">担当職員</InputLabel>
          <Select
            labelId="ops-staff-filter-label"
            value={filter.staffId ?? ''}
            label="担当職員"
            onChange={(e) =>
              onFilterChange({ staffId: e.target.value || null })
            }
          >
            <MenuItem value="">全員</MenuItem>
            {staffOptions.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Toggle Filter Chips */}
      {TOGGLE_FILTERS.map((tf) => (
        <Chip
          key={tf.key}
          label={tf.label}
          color={filter[tf.key] ? tf.color : 'default'}
          variant={filter[tf.key] ? 'filled' : 'outlined'}
          size="small"
          onClick={() => onFilterChange({ [tf.key]: !filter[tf.key] })}
          sx={{ fontWeight: 600, cursor: 'pointer' }}
        />
      ))}

      {/* Include Cancelled */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Switch
          size="small"
          checked={filter.includeCancelled}
          onChange={(_, checked) =>
            onFilterChange({ includeCancelled: checked })
          }
          inputProps={{ 'aria-label': 'キャンセル含む' }}
        />
        <Typography variant="caption" color="text.secondary">
          キャンセル含む
        </Typography>
      </Box>

      {/* Clear Button */}
      {activeFilterCount > 0 && (
        <Tooltip title="フィルターをクリア" arrow disableInteractive>
          <IconButton size="small" onClick={onClear} aria-label="フィルタークリア">
            <ClearIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};
