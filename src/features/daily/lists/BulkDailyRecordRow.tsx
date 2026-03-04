/**
 * BulkDailyRecordRow — Single row in the bulk daily record table
 *
 * Pure presentation component with React.memo for render optimization.
 * Extracted from BulkDailyRecordList.tsx for single-responsibility.
 */

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import PendingRoundedIcon from '@mui/icons-material/PendingRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import { type MealAmount } from '../../../domain/daily/types';
import {
    type BulkDailyRow,
    mealOptions,
    statusLabels,
    VALIDATION_LIMITS,
} from './bulkDailyRecordConstants';

// ─── Props ──────────────────────────────────────────────────────────────────

interface BulkDailyRecordRowProps {
  row: BulkDailyRow;
  index: number;
  onUpdateRow: (index: number, patch: Partial<BulkDailyRow>) => void;
  onSaveRow: (index: number) => Promise<boolean>;
  onKeyDown: (index: number, event: React.KeyboardEvent<HTMLTableRowElement>) => void;
  onFocusNext: (index: number) => void;
  totalRows: number;
  saveButtonRef: (index: number, element: HTMLButtonElement | null) => void;
  onAnnounce: (message: string) => void;
}

// ─── Status icon helper ─────────────────────────────────────────────────────

function StatusIcon({ status }: { status: BulkDailyRow['status'] }) {
  if (status === 'pending') return <PendingRoundedIcon color="warning" fontSize="small" />;
  if (status === 'saved') return <CheckCircleRoundedIcon color="success" fontSize="small" />;
  if (status === 'error') return <ErrorRoundedIcon color="error" fontSize="small" />;
  return <span aria-hidden="true">—</span>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const BulkDailyRecordRow = React.memo(function BulkDailyRecordRow({
  row,
  index,
  onUpdateRow,
  onSaveRow,
  onKeyDown,
  onFocusNext,
  totalRows,
  saveButtonRef,
  onAnnounce,
}: BulkDailyRecordRowProps) {
  const statusLabel = statusLabels[row.status];

  return (
    <TableRow
      key={row.userId}
      role="row"
      data-testid={`daily-bulk-row-${row.userId}`}
      data-status={row.status}
      onKeyDown={(event) => onKeyDown(index, event)}
      aria-describedby={row.status === 'error' ? `error-message-${row.userId}` : undefined}
      sx={{
        backgroundColor: row.status === 'error' ? 'error.light' : undefined,
        '&:hover': {
          backgroundColor: row.status === 'error' ? 'error.light' : undefined,
        },
      }}
    >
      {/* User ID + Name */}
      <TableCell role="gridcell">
        <Stack spacing={0.25} sx={{ whiteSpace: 'nowrap' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {row.userId}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.userName}
          </Typography>
        </Stack>
      </TableCell>

      {/* Meal amount */}
      <TableCell role="gridcell" sx={{ minWidth: 100 }}>
        <FormControl size="small" fullWidth>
          <Select
            value={row.mealAmount}
            onChange={(e) => onUpdateRow(index, { mealAmount: e.target.value as MealAmount })}
            aria-label={`${row.userName} 食事量`}
            data-testid={`daily-bulk-meal-${row.userId}`}
          >
            {mealOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </TableCell>

      {/* AM notes */}
      <TableCell role="gridcell" sx={{ minWidth: 160 }}>
        <TextField
          size="small"
          multiline
          maxRows={2}
          value={row.amNotes}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length > VALIDATION_LIMITS.MAX_NOTES_LENGTH) {
              onAnnounce(`午前記録は${VALIDATION_LIMITS.MAX_NOTES_LENGTH}文字以内で入力してください`);
            }
            onUpdateRow(index, { amNotes: value });
          }}
          placeholder="午前の様子"
          error={row.amNotes.length > VALIDATION_LIMITS.MAX_NOTES_LENGTH}
          helperText={
            row.amNotes.length > VALIDATION_LIMITS.MAX_NOTES_LENGTH
              ? `${row.amNotes.length}/${VALIDATION_LIMITS.MAX_NOTES_LENGTH}`
              : undefined
          }
          inputProps={{
            'aria-label': `${row.userName} 午前記録`,
            'data-testid': `daily-bulk-am-${row.userId}`,
            maxLength: VALIDATION_LIMITS.MAX_NOTES_LENGTH + 50,
          }}
          fullWidth
        />
      </TableCell>

      {/* PM notes */}
      <TableCell role="gridcell" sx={{ minWidth: 160 }}>
        <TextField
          size="small"
          multiline
          maxRows={2}
          value={row.pmNotes}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length > VALIDATION_LIMITS.MAX_NOTES_LENGTH) {
              onAnnounce(`午後記録は${VALIDATION_LIMITS.MAX_NOTES_LENGTH}文字以内で入力してください`);
            }
            onUpdateRow(index, { pmNotes: value });
          }}
          placeholder="午後の様子"
          error={row.pmNotes.length > VALIDATION_LIMITS.MAX_NOTES_LENGTH}
          helperText={
            row.pmNotes.length > VALIDATION_LIMITS.MAX_NOTES_LENGTH
              ? `${row.pmNotes.length}/${VALIDATION_LIMITS.MAX_NOTES_LENGTH}`
              : undefined
          }
          inputProps={{
            'aria-label': `${row.userName} 午後記録`,
            'data-testid': `daily-bulk-pm-${row.userId}`,
            maxLength: VALIDATION_LIMITS.MAX_NOTES_LENGTH + 50,
          }}
          fullWidth
        />
      </TableCell>

      {/* Special notes */}
      <TableCell role="gridcell" sx={{ minWidth: 160 }}>
        <TextField
          size="small"
          multiline
          maxRows={2}
          value={row.specialNotes}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length > VALIDATION_LIMITS.MAX_TEXT_LENGTH) {
              onAnnounce(`特記事項は${VALIDATION_LIMITS.MAX_TEXT_LENGTH}文字以内で入力してください`);
            }
            onUpdateRow(index, { specialNotes: value });
          }}
          placeholder="特記事項"
          error={row.specialNotes.length > VALIDATION_LIMITS.MAX_TEXT_LENGTH}
          helperText={
            row.specialNotes.length > VALIDATION_LIMITS.MAX_TEXT_LENGTH
              ? `${row.specialNotes.length}/${VALIDATION_LIMITS.MAX_TEXT_LENGTH}`
              : undefined
          }
          inputProps={{
            'aria-label': `${row.userName} 特記事項`,
            'data-testid': `daily-bulk-special-${row.userId}`,
            maxLength: VALIDATION_LIMITS.MAX_TEXT_LENGTH + 50,
          }}
          fullWidth
        />
      </TableCell>

      {/* Problem behavior checkbox */}
      <TableCell role="gridcell" align="center">
        <Tooltip title="問題行動ありの場合チェック">
          <Checkbox
            checked={row.hasProblems}
            onChange={(e) => onUpdateRow(index, { hasProblems: e.target.checked })}
            inputProps={{
              'aria-label': `${row.userName} 問題行動`,
            }}
            data-testid={`daily-bulk-problems-${row.userId}`}
            size="small"
          />
        </Tooltip>
      </TableCell>

      {/* Seizure checkbox */}
      <TableCell role="gridcell" align="center">
        <Tooltip title="発作ありの場合チェック">
          <Checkbox
            checked={row.hasSeizure}
            onChange={(e) => onUpdateRow(index, { hasSeizure: e.target.checked })}
            inputProps={{
              'aria-label': `${row.userName} 発作`,
            }}
            data-testid={`daily-bulk-seizure-${row.userId}`}
            size="small"
          />
        </Tooltip>
      </TableCell>

      {/* Save button */}
      <TableCell role="gridcell" align="right">
        <IconButton
          aria-label={`${row.userName} を保存`}
          data-testid={`daily-bulk-save-${row.userId}`}
          onClick={async () => {
            const success = await onSaveRow(index);
            if (success) {
              const nextIndex = Math.min(totalRows - 1, index + 1);
              onFocusNext(nextIndex);
            }
          }}
          ref={(element) => {
            saveButtonRef(index, element);
          }}
          disabled={row.status === 'pending'}
        >
          <SaveRoundedIcon fontSize="small" />
        </IconButton>
      </TableCell>

      {/* Status cell */}
      <TableCell
        role="gridcell"
        data-testid={`daily-bulk-status-${row.userId}`}
        aria-label={statusLabel}
        data-status={row.status}
        sx={{ minWidth: 56 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <StatusIcon status={row.status} />
          {row.status === 'error' && (
            <Tooltip title="エラー詳細を確認して再入力">
              <button
                onClick={() => {
                  const firstInput = document.querySelector(
                    `[data-testid="daily-bulk-meal-${row.userId}"], [data-testid="daily-bulk-am-${row.userId}"]`
                  ) as HTMLElement;
                  if (firstInput) {
                    firstInput.focus();
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#d32f2f',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textDecoration: 'underline',
                }}
                aria-label={`${row.userName}のエラーを修正`}
              >
                修正
              </button>
            </Tooltip>
          )}
        </Stack>
        {row.status === 'error' && (
          <Typography
            id={`error-message-${row.userId}`}
            variant="caption"
            color="error"
            sx={{ display: 'block', mt: 0.5 }}
          >
            入力内容を確認してください
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
});
