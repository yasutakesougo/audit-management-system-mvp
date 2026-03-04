/**
 * useBulkDailyRecordState — Composable hook for bulk daily record state
 *
 * Manages rows, validation, individual/bulk save, keyboard shortcuts,
 * focus management, and accessibility announcements.
 *
 * Extracted from BulkDailyRecordList.tsx for single-responsibility.
 */

import * as React from 'react';
import {
    type BulkDailyRow,
    type BulkRowStatus,
    createInitialRows,
    validateRowData,
} from './bulkDailyRecordConstants';

// ─── Hook options ───────────────────────────────────────────────────────────

export interface UseBulkDailyRecordStateOptions {
  onSave?: (records: BulkDailyRow[]) => Promise<void>;
  onSaveRow?: (row: BulkDailyRow) => Promise<void>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useBulkDailyRecordState({ onSave, onSaveRow }: UseBulkDailyRecordStateOptions) {
  const [rows, setRows] = React.useState<BulkDailyRow[]>(createInitialRows);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [announceMessage, setAnnounceMessage] = React.useState<string>('');
  const rowRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  React.useEffect(() => {
    rowRefs.current = rowRefs.current.slice(0, rows.length);
  }, [rows.length]);

  const focusRow = React.useCallback((index: number) => {
    const target = rowRefs.current[index];
    if (target) {
      target.focus({ preventScroll: true });
    }
  }, []);

  const updateRow = React.useCallback(
    (index: number, patch: Partial<BulkDailyRow>) => {
      setRows((prev) =>
        prev.map((row, rowIndex) =>
          rowIndex === index
            ? {
                ...row,
                ...patch,
                status: patch.status ?? (row.status === 'saved' ? 'idle' : row.status),
              }
            : row,
        ),
      );
    },
    [],
  );

  const saveRow = React.useCallback(
    async (index: number) => {
      const row = rows[index];
      if (!row) return false;

      const validation = validateRowData(row);
      if (!validation.isValid) {
        updateRow(index, { status: 'error' });
        setAnnounceMessage(`${row.userName}の保存に失敗しました。${validation.errors[0]}`);
        return false;
      }

      if (!row.mealAmount && !row.amNotes.trim() && !row.pmNotes.trim() && !row.specialNotes.trim()) {
        updateRow(index, { status: 'error' });
        setAnnounceMessage(`${row.userName}の保存に失敗しました。必要な項目を入力してください。`);
        return false;
      }

      updateRow(index, { status: 'pending' });

      try {
        if (onSaveRow) {
          await onSaveRow(row);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        updateRow(index, { status: 'saved' });
        setAnnounceMessage(`${row.userName}の記録を保存しました。`);
        return true;
      } catch {
        updateRow(index, { status: 'error' });
        setAnnounceMessage(`${row.userName}の保存中にエラーが発生しました。`);
        return false;
      }
    },
    [rows, updateRow, onSaveRow],
  );

  const handleKeyDown = React.useCallback(
    async (index: number, event: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const success = await saveRow(index);
        if (success) {
          const nextIndex = event.shiftKey ? Math.max(0, index - 1) : Math.min(rows.length - 1, index + 1);
          focusRow(nextIndex);
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveRow(index);
      }
    },
    [focusRow, rows.length, saveRow],
  );

  const handleBulkSave = React.useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const filteredRows = rows.filter(
        (row) =>
          row.mealAmount !== '完食' ||
          row.amNotes.trim() ||
          row.pmNotes.trim() ||
          row.specialNotes.trim() ||
          row.hasProblems ||
          row.hasSeizure,
      );

      if (onSave) {
        await onSave(filteredRows);
      }

      setRows((prev) =>
        prev.map((row) => {
          const isTouched =
            row.mealAmount !== '完食' ||
            row.amNotes.trim() ||
            row.pmNotes.trim() ||
            row.specialNotes.trim() ||
            row.hasProblems ||
            row.hasSeizure;

          return {
            ...row,
            status: isTouched ? ('saved' as BulkRowStatus) : row.status,
          };
        }),
      );
      setAnnounceMessage(`一括保存完了: ${filteredRows.length}件の記録を保存しました。`);
    } catch {
      setRows((prev) =>
        prev.map((row) => ({ ...row, status: 'error' as BulkRowStatus })),
      );
      setAnnounceMessage(`一括保存失敗: エラーが発生しました。各行の状態を確認してください。`);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, rows, onSave]);

  // Alt+S global shortcut
  React.useEffect(() => {
    const handleAltS = (event: KeyboardEvent) => {
      const key = event.key?.toLowerCase?.() ?? '';
      const isHotkey = event.code === 'KeyS' || key === 's';
      if (event.altKey && isHotkey) {
        event.preventDefault();
        void handleBulkSave();
      }
    };
    window.addEventListener('keydown', handleAltS);
    return () => window.removeEventListener('keydown', handleAltS);
  }, [handleBulkSave]);

  return {
    rows,
    isSubmitting,
    announceMessage,
    rowRefs,
    updateRow,
    saveRow,
    focusRow,
    handleKeyDown,
    handleBulkSave,
    setAnnounceMessage,
  };
}
