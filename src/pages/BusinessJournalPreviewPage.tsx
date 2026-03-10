/**
 * Business Journal Preview Page (業務日誌プレビュー)
 *
 * Displays daily records in a monthly grid format aligned with the legacy
 * Excel business journal (業務日誌01.07.19.xlsx).
 *
 * Layout: rows = users (~30), columns = dates (1-31)
 * Each cell shows a compact summary of attendance, meals, activities, and flags.
 *
 * Types, constants, and helpers are in businessJournalPreviewHelpers.ts
 * Mock data is in businessJournalPreview.mock.ts
 * Cell and dialog components are in BusinessJournalPreviewSections.tsx
 */
import { TESTIDS } from '@/testids';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React from 'react';
import { Link } from 'react-router-dom';

import { generateMockData } from './businessJournalPreview.mock';
import {
    ATTENDANCE_COLORS,
    buildTooltipLines,
    getDayColor,
    getDayLabel,
    getDaysInMonth,
    type AttendanceStatus,
    type JournalDayEntry,
} from './businessJournalPreviewHelpers';
import { CellContent, DetailDialog } from './BusinessJournalPreviewSections';

// ── Main Page Component ─────────────────────────────────────────────────────

export default function BusinessJournalPreviewPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = React.useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState(now.getMonth() + 1);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState('');
  const [dialogUserId, setDialogUserId] = React.useState('');
  const [selectedEntry, setSelectedEntry] = React.useState<JournalDayEntry | null>(null);

  const data = React.useMemo(
    () => generateMockData(selectedYear, selectedMonth),
    [selectedYear, selectedMonth],
  );

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Generate month options (current month ± 6 months)
  const monthOptions = React.useMemo(() => {
    const options: { value: string; label: string; year: number; month: number }[] = [];
    for (let offset = -6; offset <= 0; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      options.push({
        value: `${y}-${String(m).padStart(2, '0')}`,
        label: `${y}年${m}月`,
        year: y,
        month: m,
      });
    }
    return options;
  }, []);

  const handleMonthChange = (value: string) => {
    const opt = monthOptions.find((o) => o.value === value);
    if (opt) {
      setSelectedYear(opt.year);
      setSelectedMonth(opt.month);
    }
  };

  const handleCellClick = (userId: string, displayName: string, entry: JournalDayEntry) => {
    if (entry.attendance === '休日') return;
    setSelectedUser(displayName);
    setDialogUserId(userId);
    setSelectedEntry(entry);
    setDialogOpen(true);
  };

  return (
    <Container maxWidth={false} sx={{ px: { xs: 1, md: 2 } }} data-testid={TESTIDS['journal-preview-page']}>
      <Box sx={{ py: 2 }}>
        {/* Header */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            業務日誌プレビュー
          </Typography>
          <Typography variant="body2" color="text.secondary">
            紙の業務日誌と同等のレイアウトで月間の日次記録を一覧表示します
          </Typography>
        </Box>

        {/* Month selector */}
        <Box sx={{ mb: 2 }}>
          <TextField
            select
            size="small"
            label="対象月"
            value={`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`}
            onChange={(e) => handleMonthChange(e.target.value)}
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

        {/* Legend */}
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

        {/* Monthly Grid Table */}
        <TableContainer
          sx={{
            maxHeight: 'calc(100vh - 260px)',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
          }}
          data-testid={TESTIDS['journal-preview-grid']}
        >
          <Table size="small" stickyHeader aria-label="業務日誌月間グリッド">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                    bgcolor: 'background.paper',
                    minWidth: 100,
                    fontWeight: 700,
                    borderRight: 1,
                    borderColor: 'divider',
                  }}
                >
                  利用者名
                </TableCell>
                {dayHeaders.map((day) => (
                  <TableCell
                    key={day}
                    align="center"
                    sx={{
                      minWidth: 44,
                      maxWidth: 44,
                      px: 0.5,
                      py: 0.5,
                      fontSize: 11,
                      fontWeight: 600,
                      color: getDayColor(selectedYear, selectedMonth, day),
                      borderBottom: 2,
                      borderColor: 'divider',
                    }}
                  >
                    <Box>{day}</Box>
                    <Box sx={{ fontSize: 9, opacity: 0.7 }}>{getDayLabel(selectedYear, selectedMonth, day)}</Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.userId} hover>
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      bgcolor: 'background.paper',
                      fontWeight: 600,
                      fontSize: 12,
                      borderRight: 1,
                      borderColor: 'divider',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Link
                      to={`/records/journal/personal?user=${encodeURIComponent(row.userId)}&month=${selectedYear}-${String(selectedMonth).padStart(2, '0')}`}
                      style={{ color: '#1565c0', textDecoration: 'none' }}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
                      data-testid="journal-user-link"
                    >
                      {row.displayName}
                    </Link>
                  </TableCell>
                  {row.entries.map((entry, idx) => {
                    const isWeekend = entry.attendance === '休日';
                    const tooltipLines = buildTooltipLines(entry);

                    return (
                      <TableCell
                        key={idx}
                        align="center"
                        data-testid={TESTIDS['journal-preview-cell']}
                        onClick={() => handleCellClick(row.userId, row.displayName, entry)}
                        sx={{
                          px: 0.25,
                          py: 0.5,
                          cursor: isWeekend ? 'default' : 'pointer',
                          bgcolor: isWeekend ? 'action.hover' : undefined,
                          '&:hover': isWeekend
                            ? undefined
                            : { bgcolor: 'action.selected' },
                          minWidth: 44,
                          maxWidth: 44,
                          borderRight: 1,
                          borderColor: 'divider',
                        }}
                      >
                        {tooltipLines.length > 0 ? (
                          <Tooltip
                            title={tooltipLines.map((line, i) => (
                              <Box key={i} sx={{ fontSize: 11 }}>{line}</Box>
                            ))}
                            placement="top"
                            arrow
                          >
                            <Box>
                              <CellContent entry={entry} />
                            </Box>
                          </Tooltip>
                        ) : (
                          <CellContent entry={entry} />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Summary footer */}
        <Box sx={{ mt: 2, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            利用者数: <strong>{data.length}</strong>名
          </Typography>
          <Typography variant="body2" color="text.secondary">
            表示月: <strong>{selectedYear}年{selectedMonth}月</strong>（{daysInMonth}日間）
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            ※ 現在はモックデータを表示しています
          </Typography>
        </Box>
      </Box>

      {/* Detail Dialog */}
      <DetailDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        userName={selectedUser}
        userId={dialogUserId}
        entry={selectedEntry}
        monthValue={`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`}
      />
    </Container>
  );
}
