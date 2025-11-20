import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import PendingRoundedIcon from '@mui/icons-material/PendingRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import { type MealAmount } from '../../domain/daily/types';

export type BulkRowStatus = 'idle' | 'saved' | 'error' | 'pending';

export type BulkDailyRow = {
  userId: string;
  userName: string;
  mealAmount: MealAmount;
  amNotes: string;
  pmNotes: string;
  specialNotes: string;
  hasProblems: boolean;
  hasSeizure: boolean;
  status: BulkRowStatus;
};

const statusLabels: Record<BulkRowStatus, string> = {
  idle: '未保存',
  saved: '保存済み',
  error: 'エラー',
  pending: '保存中',
};

const mealOptions: { value: MealAmount; label: string }[] = [
  { value: '完食', label: '完食' },
  { value: '多め', label: '多め' },
  { value: '半分', label: '半分' },
  { value: '少なめ', label: '少なめ' },
  { value: 'なし', label: 'なし' },
];

// ダミーユーザーデータ
const mockUsers = [
  { UserID: '001', FullName: '田中太郎' },
  { UserID: '002', FullName: '佐藤花子' },
  { UserID: '003', FullName: '鈴木次郎' },
  { UserID: '004', FullName: '高橋美咲' },
  { UserID: '005', FullName: '山田健一' },
  { UserID: '006', FullName: '渡辺由美' },
  { UserID: '007', FullName: '伊藤雄介' },
  { UserID: '008', FullName: '中村恵子' },
  { UserID: '009', FullName: '小林智子' },
  { UserID: '010', FullName: '加藤秀樹' },
  { UserID: '011', FullName: '吉田京子' },
  { UserID: '012', FullName: '清水達也' },
  { UserID: '013', FullName: '松本麻衣' },
  { UserID: '014', FullName: '森田健二' },
  { UserID: '015', FullName: '池田理恵' },
  { UserID: '016', FullName: '石井大輔' },
];

const createInitialRows = (): BulkDailyRow[] =>
  mockUsers.map((user) => ({
    userId: user.UserID,
    userName: user.FullName,
    mealAmount: '完食',
    amNotes: '',
    pmNotes: '',
    specialNotes: '',
    hasProblems: false,
    hasSeizure: false,
    status: 'idle',
  }));

// バリデーション定数
const VALIDATION_LIMITS = {
  MAX_TEXT_LENGTH: 500,
  MAX_NOTES_LENGTH: 200,
} as const;

// バリデーション関数
const validateRowData = (row: BulkDailyRow): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (row.amNotes.length > VALIDATION_LIMITS.MAX_NOTES_LENGTH) {
    errors.push(`午前記録は${VALIDATION_LIMITS.MAX_NOTES_LENGTH}文字以内で入力してください`);
  }

  if (row.pmNotes.length > VALIDATION_LIMITS.MAX_NOTES_LENGTH) {
    errors.push(`午後記録は${VALIDATION_LIMITS.MAX_NOTES_LENGTH}文字以内で入力してください`);
  }

  if (row.specialNotes.length > VALIDATION_LIMITS.MAX_TEXT_LENGTH) {
    errors.push(`特記事項は${VALIDATION_LIMITS.MAX_TEXT_LENGTH}文字以内で入力してください`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

interface BulkDailyRecordListProps {
  selectedDate?: string;
  onSave?: (records: BulkDailyRow[]) => Promise<void>;
  onSaveRow?: (row: BulkDailyRow) => Promise<void>;
}

export default function BulkDailyRecordList({ selectedDate, onSave, onSaveRow }: BulkDailyRecordListProps) {
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

      // バリデーション実行
      const validation = validateRowData(row);
      if (!validation.isValid) {
        updateRow(index, { status: 'error' });
        setAnnounceMessage(`${row.userName}の保存に失敗しました。${validation.errors[0]}`);
        return false;
      }

      // 最低限の入力チェック
      if (!row.mealAmount && !row.amNotes.trim() && !row.pmNotes.trim() && !row.specialNotes.trim()) {
        updateRow(index, { status: 'error' });
        setAnnounceMessage(`${row.userName}の保存に失敗しました。必要な項目を入力してください。`);
        return false;
      }

      updateRow(index, { status: 'pending' });

      try {
        // 行ごと保存処理：onSaveRowが提供されていればそれを使用、なければモック
        if (onSaveRow) {
          await onSaveRow(row);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 500)); // モック
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

      // 保存成功時の状態更新：入力がある行のみ'saved'にする
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
      // エラー時の状態更新
      setRows((prev) =>
        prev.map((row) => ({ ...row, status: 'error' as BulkRowStatus })),
      );
      setAnnounceMessage(`一括保存失敗: エラーが発生しました。各行の状態を確認してください。`);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, rows, onSave]);

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

  return (
    <Paper variant="outlined" role="region" aria-label="支援記録（ケース記録）一覧入力">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, gap: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            支援記録（ケース記録）一覧入力
          </Typography>
          {selectedDate && (
            <Chip label={selectedDate} variant="outlined" size="small" />
          )}
        </Stack>
        <Tooltip title="Alt+S でも実行できます">
          <span>
            <Button
              startIcon={<SyncRoundedIcon />}
              onClick={handleBulkSave}
              disabled={isSubmitting}
              variant="contained"
              data-testid="daily-bulk-save"
            >
              {isSubmitting ? '保存中...' : '一括保存'}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {/* アナウンス領域 */}
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
        {announceMessage}
      </Box>

      {/* ショートカットヒント & ステータス凡例 */}
      <Box sx={{ px: 2, pb: 1 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" color="text.secondary">
              キーボード操作:
            </Typography>
            <Chip size="small" label="Enter=保存して次へ" variant="outlined" />
            <Chip size="small" label="Ctrl+S=保存" variant="outlined" />
            <Chip size="small" label="Alt+S=一括保存" variant="outlined" />
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" color="text.secondary">
              状態:
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <span aria-hidden="true">—</span>
              <Typography variant="caption" color="text.secondary">未保存</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <CheckCircleRoundedIcon color="success" sx={{ fontSize: 16 }} />
              <Typography variant="caption" color="text.secondary">保存済み</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <PendingRoundedIcon color="warning" sx={{ fontSize: 16 }} />
              <Typography variant="caption" color="text.secondary">保存中</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <ErrorRoundedIcon color="error" sx={{ fontSize: 16 }} />
              <Typography variant="caption" color="text.secondary">エラー</Typography>
            </Stack>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ px: 2, pb: 2, overflow: 'auto' }}>
        <Table
          size="small"
          role="grid"
          aria-label="支援記録（ケース記録） 一覧入力"
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
            {rows.map((row, index) => {
              const statusLabel = statusLabels[row.status];
              const statusIcon = (() => {
                if (row.status === 'pending') {
                  return <PendingRoundedIcon color="warning" fontSize="small" />;
                }
                if (row.status === 'saved') {
                  return <CheckCircleRoundedIcon color="success" fontSize="small" />;
                }
                if (row.status === 'error') {
                  return <ErrorRoundedIcon color="error" fontSize="small" />;
                }
                return <span aria-hidden="true">—</span>;
              })();

              return (
                <TableRow
                  key={row.userId}
                  role="row"
                  data-testid={`daily-bulk-row-${row.userId}`}
                  data-status={row.status}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  aria-describedby={row.status === 'error' ? `error-message-${row.userId}` : undefined}
                  sx={{
                    backgroundColor: row.status === 'error' ? 'error.light' : undefined,
                    '&:hover': {
                      backgroundColor: row.status === 'error' ? 'error.light' : undefined,
                    },
                  }}
                >
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

                  <TableCell role="gridcell" sx={{ minWidth: 100 }}>
                    <FormControl size="small" fullWidth>
                      <Select
                        value={row.mealAmount}
                        onChange={(e) => updateRow(index, { mealAmount: e.target.value as MealAmount })}
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

                  <TableCell role="gridcell" sx={{ minWidth: 160 }}>
                    <TextField
                      size="small"
                      multiline
                      maxRows={2}
                      value={row.amNotes}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length > VALIDATION_LIMITS.MAX_NOTES_LENGTH) {
                          setAnnounceMessage(`午前記録は${VALIDATION_LIMITS.MAX_NOTES_LENGTH}文字以内で入力してください`);
                        }
                        updateRow(index, { amNotes: value });
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
                        maxLength: VALIDATION_LIMITS.MAX_NOTES_LENGTH + 50, // 少し余裕を持たせてユーザーに警告表示
                      }}
                      fullWidth
                    />
                  </TableCell>

                  <TableCell role="gridcell" sx={{ minWidth: 160 }}>
                    <TextField
                      size="small"
                      multiline
                      maxRows={2}
                      value={row.pmNotes}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length > VALIDATION_LIMITS.MAX_NOTES_LENGTH) {
                          setAnnounceMessage(`午後記録は${VALIDATION_LIMITS.MAX_NOTES_LENGTH}文字以内で入力してください`);
                        }
                        updateRow(index, { pmNotes: value });
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

                  <TableCell role="gridcell" sx={{ minWidth: 160 }}>
                    <TextField
                      size="small"
                      multiline
                      maxRows={2}
                      value={row.specialNotes}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length > VALIDATION_LIMITS.MAX_TEXT_LENGTH) {
                          setAnnounceMessage(`特記事項は${VALIDATION_LIMITS.MAX_TEXT_LENGTH}文字以内で入力してください`);
                        }
                        updateRow(index, { specialNotes: value });
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

                  <TableCell role="gridcell" align="center">
                    <Tooltip title="問題行動ありの場合チェック">
                      <Checkbox
                        checked={row.hasProblems}
                        onChange={(e) => updateRow(index, { hasProblems: e.target.checked })}
                        inputProps={{
                          'aria-label': `${row.userName} 問題行動`,
                        }}
                        data-testid={`daily-bulk-problems-${row.userId}`}
                        size="small"
                      />
                    </Tooltip>
                  </TableCell>

                  <TableCell role="gridcell" align="center">
                    <Tooltip title="発作ありの場合チェック">
                      <Checkbox
                        checked={row.hasSeizure}
                        onChange={(e) => updateRow(index, { hasSeizure: e.target.checked })}
                        inputProps={{
                          'aria-label': `${row.userName} 発作`,
                        }}
                        data-testid={`daily-bulk-seizure-${row.userId}`}
                        size="small"
                      />
                    </Tooltip>
                  </TableCell>

                  <TableCell role="gridcell" align="right">
                    <IconButton
                      aria-label={`${row.userName} を保存`}
                      data-testid={`daily-bulk-save-${row.userId}`}
                      onClick={async () => {
                        const success = await saveRow(index);
                        if (success) {
                          const nextIndex = Math.min(rows.length - 1, index + 1);
                          focusRow(nextIndex);
                        }
                      }}
                      ref={(element) => {
                        rowRefs.current[index] = element;
                      }}
                      disabled={row.status === 'pending'}
                    >
                      <SaveRoundedIcon fontSize="small" />
                    </IconButton>
                  </TableCell>

                  <TableCell
                    role="gridcell"
                    data-testid={`daily-bulk-status-${row.userId}`}
                    aria-label={statusLabel}
                    data-status={row.status}
                    sx={{ minWidth: 56 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {statusIcon}
                      {row.status === 'error' && (
                        <Tooltip title="エラー詳細を確認して再入力">
                          <button
                            onClick={() => {
                              // 最初の入力フィールドにフォーカスを移動
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
            })}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
}