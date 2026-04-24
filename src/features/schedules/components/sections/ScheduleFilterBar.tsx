import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { scheduleCategoryLabels } from '../../domain/mappers/categoryLabels';
import type { ScheduleCategory } from '../../domain/types';
import SchedulesFilterResponsive from './SchedulesFilterResponsive';

export type ScheduleFilterBarProps = {
  categoryFilter: 'All' | ScheduleCategory;
  onCategoryChange: (category: 'All' | ScheduleCategory) => void;
  query: string;
  onQueryChange: (query: string) => void;
  mode: 'day' | 'week' | 'month' | 'org';
  orgParam?: string;
  onOrgChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  compact?: boolean;
};

const ORG_OPTIONS = [
  { value: 'all', label: '全事業所（統合ビュー）' },
  { value: 'main', label: '生活介護（本体）' },
  { value: 'shortstay', label: '短期入所' },
  { value: 'respite', label: 'レスパイト' },
  { value: 'other', label: 'その他' },
] as const;

export function ScheduleFilterBar(props: ScheduleFilterBarProps) {
  const {
    categoryFilter,
    onCategoryChange,
    query,
    onQueryChange,
    mode,
    orgParam = 'all',
    onOrgChange,
    compact = false,
  } = props;

  return (
    <SchedulesFilterResponsive
      compact={compact && mode !== 'org'}
      inlineStackProps={{
        sx: { mt: { xs: 0.5, sm: 0 }, minWidth: 260 },
        spacing: 0.5,
        alignItems: 'flex-end',
      }}
    >
      <Typography variant="caption" fontWeight={600} color="text.secondary">
        絞り込み
      </Typography>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ width: '100%' }}
      >
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="schedule-filter-category-label">カテゴリ</InputLabel>
          <Select
            labelId="schedule-filter-category-label"
            label="カテゴリ"
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value as 'All' | ScheduleCategory)}
            data-testid="schedules-filter-category"
          >
            <MenuItem value="All">すべて</MenuItem>
            <MenuItem value="User">{scheduleCategoryLabels.User}</MenuItem>
            <MenuItem value="Staff">{scheduleCategoryLabels.Staff}</MenuItem>
            <MenuItem value="Org">{scheduleCategoryLabels.Org}</MenuItem>
          </Select>
        </FormControl>

        {mode === 'org' && onOrgChange && (
          <Stack direction="column" spacing={1} sx={{ width: '100%' }} data-testid="schedule-org-tabpanel">
            <Typography variant="subtitle2" fontWeight={600}>
              組織別スケジュール
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel id="schedule-org-select-label">事業所</InputLabel>
                <Select
                  labelId="schedule-org-select-label"
                  label="事業所"
                  value={orgParam}
                  onChange={(e) => {
                    // Bridge SelectChangeEvent to ChangeEvent<HTMLSelectElement> for backward compat
                    const syntheticEvent = {
                      target: { value: e.target.value },
                    } as React.ChangeEvent<HTMLSelectElement>;
                    onOrgChange(syntheticEvent);
                  }}
                  data-testid="schedule-org-select"
                >
                  {ORG_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography
                variant="body2"
                color="text.secondary"
                data-testid="schedule-org-summary"
              >
                {ORG_OPTIONS.find((o) => o.value === orgParam)?.label ?? ''}
              </Typography>
            </Stack>
          </Stack>
        )}

        <TextField
          size="small"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="タイトル/場所/担当/利用者で検索"
          sx={{ flex: '1 1 280px', minWidth: 240 }}
          aria-label="スケジュール検索"
          data-testid="schedules-filter-query"
        />
      </Stack>
    </SchedulesFilterResponsive>
  );
}
