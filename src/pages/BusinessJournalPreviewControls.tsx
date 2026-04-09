/**
 * Business Journal Preview — Controls (Header, Month Selector, Legend)
 *
 * Extracted from BusinessJournalPreviewPage.tsx for single-responsibility.
 * Renders the title, month picker, and colour legend above the grid.
 *
 * @module pages/BusinessJournalPreviewControls
 */

import { TESTIDS } from '@/testids';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PrintIcon from '@mui/icons-material/Print';

import {
    ATTENDANCE_COLORS,
    type AttendanceStatus,
} from './businessJournalPreviewHelpers';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MonthOption {
  value: string;  // "YYYY-MM"
  label: string;  // "YYYY年M月"
  year: number;
  month: number;
}

interface BusinessJournalPreviewControlsProps {
  selectedYear: number;
  selectedMonth: number;
  monthOptions: MonthOption[];
  onMonthChange: (value: string) => void;
  /** 印刷 / PDF保存ボタンのクリックハンドラー */
  onPrint?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BusinessJournalPreviewControls({
  selectedYear,
  selectedMonth,
  monthOptions,
  onMonthChange,
  onPrint,
}: BusinessJournalPreviewControlsProps) {
  const currentValue = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  return (
    <>
      {/* Page title + Print button */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" component="h1" gutterBottom>
            業務日誌プレビュー
          </Typography>
          <Typography variant="body2" color="text.secondary">
            紙の業務日誌と同等のレイアウトで月間の日々の記録を一覧表示します
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<PrintIcon />}
          onClick={onPrint}
          data-testid="journal-print-button"
          sx={{
            minWidth: 140,
            fontWeight: 600,
            borderColor: 'primary.main',
            '@media print': { display: 'none' },
          }}
        >
          印刷 / PDF保存
        </Button>
      </Box>

      {/* Month selector */}
      <Box sx={{ mb: 2 }}>
        <TextField
          select
          size="small"
          label="対象月"
          value={currentValue}
          onChange={(e) => onMonthChange(e.target.value)}
          data-testid={TESTIDS['journal-preview-month-select']}
          sx={{ minWidth: 180 }}
        >
          {monthOptions.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Colour legend */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">凡例:</Typography>
        {(Object.entries(ATTENDANCE_COLORS) as [AttendanceStatus, string][]).map(([label, color]) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color }} />
            <Typography variant="caption">{label}</Typography>
          </Box>
        ))}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption">食事: ◎完食 ○多め △半分 ▽少なめ ×なし</Typography>
        </Box>
      </Box>
    </>
  );
}
