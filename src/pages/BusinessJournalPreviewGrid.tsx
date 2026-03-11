/**
 * Business Journal Preview — Monthly Grid Table
 *
 * Extracted from BusinessJournalPreviewPage.tsx for single-responsibility.
 * Renders the sticky-header grid of users × dates, delegating cell rendering
 * to CellContent (from BusinessJournalPreviewSections).
 *
 * @module pages/BusinessJournalPreviewGrid
 */

import { TESTIDS } from '@/testids';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import { Link } from 'react-router-dom';

import { CellContent } from './BusinessJournalPreviewSections';
import {
    buildTooltipLines,
    getDayColor,
    getDayLabel,
    type JournalDayEntry,
    type JournalUserRow,
} from './businessJournalPreviewHelpers';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BusinessJournalPreviewGridProps {
  data: JournalUserRow[];
  selectedYear: number;
  selectedMonth: number;
  dayHeaders: number[];
  onCellClick: (userId: string, displayName: string, entry: JournalDayEntry) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPersonalJournalUrl(
  userId: string,
  selectedYear: number,
  selectedMonth: number,
): string {
  const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  return `/records/journal/personal?user=${encodeURIComponent(userId)}&month=${monthStr}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BusinessJournalPreviewGrid({
  data,
  selectedYear,
  selectedMonth,
  dayHeaders,
  onCellClick,
}: BusinessJournalPreviewGridProps) {
  return (
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
                <Box sx={{ fontSize: 9, opacity: 0.7 }}>
                  {getDayLabel(selectedYear, selectedMonth, day)}
                </Box>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.userId} hover>
              {/* Sticky user name cell */}
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
                  to={buildPersonalJournalUrl(row.userId, selectedYear, selectedMonth)}
                  style={{ color: '#1565c0', textDecoration: 'none' }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
                  data-testid="journal-user-link"
                >
                  {row.displayName}
                </Link>
              </TableCell>

              {/* Day cells */}
              {row.entries.map((entry, idx) => {
                const isWeekend = entry.attendance === '休日';
                const tooltipLines = buildTooltipLines(entry);

                return (
                  <TableCell
                    key={idx}
                    align="center"
                    data-testid={TESTIDS['journal-preview-cell']}
                    onClick={() => onCellClick(row.userId, row.displayName, entry)}
                    sx={{
                      px: 0.25,
                      py: 0.5,
                      cursor: isWeekend ? 'default' : 'pointer',
                      bgcolor: isWeekend ? 'action.hover' : undefined,
                      '&:hover': isWeekend ? undefined : { bgcolor: 'action.selected' },
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
  );
}
