/**
 * DailyRecordFilterPanel — Search, status, and date filters
 *
 * Extracted from DailyRecordPage.tsx for single-responsibility.
 */

import SearchIcon from '@mui/icons-material/Search';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// ─── Props ──────────────────────────────────────────────────────────────────

interface DailyRecordFilterPanelProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  dateFilter: string;
  onDateFilterChange: (value: string) => void;
  onClear: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DailyRecordFilterPanel({
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  dateFilter,
  onDateFilterChange,
  onClear,
}: DailyRecordFilterPanelProps) {
  return (
    <Card sx={{ mb: 3 }} data-testid="filter-panel">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          フィルター
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            size="small"
            placeholder="利用者名またはIDで検索"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ minWidth: 200 }}
            data-testid="search-input"
          />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>ステータス</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              label="ステータス"
              data-testid="status-filter-select"
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="完了">完了</MenuItem>
              <MenuItem value="作成中">作成中</MenuItem>
              <MenuItem value="未作成">未作成</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            type="date"
            label="日付"
            value={dateFilter}
            onChange={(e) => onDateFilterChange(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150 }}
            data-testid="date-filter-input"
          />

          <Button
            variant="outlined"
            onClick={onClear}
            data-testid="clear-filters-button"
          >
            クリア
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
