/**
 * BulkDailyRecordList — Thin Orchestrator
 *
 * Composes:
 *   - useBulkDailyRecordState (hook): state, callbacks, effects
 *   - BulkDailyRecordToolbar: header, bulk-save, shortcuts
 *   - BulkDailyRecordRow: individual table rows (React.memo)
 *   - bulkDailyRecordConstants: types, validation, mock data
 *
 * This file should remain ≤200 lines as a composition-only orchestrator.
 */

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import { type BulkDailyRow } from './bulkDailyRecordConstants';
import { BulkDailyRecordRow } from './BulkDailyRecordRow';
import { BulkDailyRecordToolbar } from './BulkDailyRecordToolbar';
import { useBulkDailyRecordState } from './useBulkDailyRecordState';

// Re-export types for backward compatibility
export type { BulkDailyRow, BulkRowStatus } from './bulkDailyRecordConstants';

// ─── Props ──────────────────────────────────────────────────────────────────

interface BulkDailyRecordListProps {
  selectedDate?: string;
  onSave?: (records: BulkDailyRow[]) => Promise<void>;
  onSaveRow?: (row: BulkDailyRow) => Promise<void>;
  /** @see UseBulkDailyRecordStateOptions.mockSaveDelay */
  mockSaveDelay?: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function BulkDailyRecordList({ selectedDate, onSave, onSaveRow, mockSaveDelay }: BulkDailyRecordListProps) {
  const state = useBulkDailyRecordState({ onSave, onSaveRow, mockSaveDelay });

  const saveButtonRef = (index: number, element: HTMLButtonElement | null) => {
    state.rowRefs.current[index] = element;
  };

  return (
    <Paper variant="outlined" role="region" aria-label="日々の記録一覧入力">
      <BulkDailyRecordToolbar
        selectedDate={selectedDate}
        isSubmitting={state.isSubmitting}
        onBulkSave={state.handleBulkSave}
      />

      {/* Accessibility announcement (screen reader only) */}
      <Box
        role="status"
        aria-live="polite"
        aria-atomic="true"
        sx={{
          position: 'absolute',
          left: -10000,
          width: 1,
          height: 1,
          overflow: 'hidden'
        }}
      >
        {state.announceMessage}
      </Box>

      {/* Table */}
      <Box sx={{ px: 2, pb: 2, overflow: 'auto' }}>
        <Table
          size="small"
          role="grid"
          aria-label="日々の記録 一覧入力"
          data-testid="daily-bulk-table"
          stickyHeader
        >
          <TableHead>
            <TableRow>
              <TableCell role="columnheader">利用者</TableCell>
              <TableCell role="columnheader">食事量</TableCell>
              <TableCell role="columnheader">午前記録</TableCell>
              <TableCell role="columnheader">午後記録</TableCell>
              <TableCell role="columnheader">特記事項</TableCell>
              <TableCell role="columnheader" align="center">問題行動</TableCell>
              <TableCell role="columnheader" align="center">発作</TableCell>
              <TableCell role="columnheader" align="right">保存</TableCell>
              <TableCell role="columnheader">状態</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {state.rows.map((row, index) => (
              <BulkDailyRecordRow
                key={row.userId}
                row={row}
                index={index}
                onUpdateRow={state.updateRow}
                onSaveRow={state.saveRow}
                onKeyDown={state.handleKeyDown}
                onFocusNext={state.focusRow}
                totalRows={state.rows.length}
                saveButtonRef={saveButtonRef}
                onAnnounce={state.setAnnounceMessage}
              />
            ))}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
}
