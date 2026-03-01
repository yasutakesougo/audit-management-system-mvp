import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import { Button, Card, CardContent, Stack, TextField } from '@mui/material';

import type { AttendanceFilter } from '../types';

type AttendanceFilterBarProps = {
  filters: AttendanceFilter;
  onChange: (next: Partial<AttendanceFilter>) => void;
  onRefresh: () => void;
  disabled?: boolean;
};

export function AttendanceFilterBar({
  filters,
  onChange,
  onRefresh,
  disabled,
}: AttendanceFilterBarProps): JSX.Element {
  return (
    <Card>
      <CardContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField
            label="日付"
            type="date"
            size="small"
            value={filters.date}
            onChange={(event) => onChange({ date: event.target.value })}
            disabled={disabled}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="利用者検索"
            size="small"
            placeholder="利用者名・ID"
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            disabled={disabled}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ flexGrow: 1 }}
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={disabled}
            sx={{ minHeight: 44 }}
          >
            再読込
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
