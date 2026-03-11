/**
 * Business Journal Preview Page (業務日誌プレビュー)
 *
 * Displays daily records in a monthly grid format aligned with the legacy
 * Excel business journal (業務日誌01.07.19.xlsx).
 *
 * Layout: rows = users (~30), columns = dates (1-31)
 * Each cell shows a compact summary of attendance, meals, activities, and flags.
 *
 * Composition:
 *   - businessJournalPreviewHelpers.ts — Types, constants, and pure helpers
 *   - businessJournalPreview.mock.ts   — Mock data generator
 *   - BusinessJournalPreviewControls   — Header, month selector, legend
 *   - BusinessJournalPreviewGrid       — Monthly sticky-header grid table
 *   - BusinessJournalPreviewSections   — CellContent, DetailDialog
 */
import { TESTIDS } from '@/testids';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import React from 'react';

import { generateMockData } from './businessJournalPreview.mock';
import { BusinessJournalPreviewControls, type MonthOption } from './BusinessJournalPreviewControls';
import { BusinessJournalPreviewGrid } from './BusinessJournalPreviewGrid';
import {
    getDaysInMonth,
    type JournalDayEntry,
} from './businessJournalPreviewHelpers';
import { DetailDialog } from './BusinessJournalPreviewSections';

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
  const monthOptions = React.useMemo<MonthOption[]>(() => {
    const options: MonthOption[] = [];
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
        <BusinessJournalPreviewControls
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          monthOptions={monthOptions}
          onMonthChange={handleMonthChange}
        />

        <BusinessJournalPreviewGrid
          data={data}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          dayHeaders={dayHeaders}
          onCellClick={handleCellClick}
        />

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
