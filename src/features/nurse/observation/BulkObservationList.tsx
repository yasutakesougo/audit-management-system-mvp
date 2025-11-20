import ShortcutHint from '@/features/nurse/components/ShortcutHint';
import StatusLegend from '@/features/nurse/components/StatusLegend';
import { useToast } from '@/features/nurse/components/ToastContext';
import { thresholds } from '@/features/nurse/constants/thresholds';
import { buildIdempotencyKey, queue, QUEUE_MAX, type ObservationVitalsPayload } from '@/features/nurse/state/offlineQueue';
import { useLastSync } from '@/features/nurse/state/useLastSync';
import { flushNurseQueue, type FlushSummary } from '@/features/nurse/state/useNurseSync';
import { formatFlushSummaryToast } from '@/features/nurse/toast/formatFlushSummaryToast';
import { NURSE_USERS, type NurseWeightGroup } from '@/features/nurse/users';
import { TESTIDS, tidWithSuffix } from '@/testids';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import PendingRoundedIcon from '@mui/icons-material/PendingRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
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
import { useObsWorkspaceParams } from './useObsWorkspaceParams';
import VitalCell from './VitalCell';

export type RowStatus = 'idle' | 'queued' | 'ok' | 'partial' | 'error';

const statusLabels: Record<RowStatus, string> = {
  idle: '未保存',
  queued: '同期待機',
  ok: '同期済み',
  partial: '一部同期',
  error: '同期エラー',
};

export type BulkRow = {
  userId: string;
  temp: string;
  weight: string;
  memo: string;
  status: RowStatus;
};

const numberFromString = (raw: string): number | null => {
  if (!raw) return null;
  const normalized = raw.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export type WeightGroupFilter = 'all' | NurseWeightGroup;

const userIndex = new Map(NURSE_USERS.map((user) => [user.id, user] as const));

const createInitialRows = (): BulkRow[] =>
  NURSE_USERS.filter((user) => user.isActive !== false).map((user) => ({
    userId: user.id,
    temp: '',
    weight: '',
    memo: '',
    status: 'idle',
  }));

const buildTimestamp = (date?: string | null) => {
  const now = new Date();
  if (!date) {
    return now.toISOString();
  }
  const pad = (value: number) => value.toString().padStart(2, '0');
  const timeFragment = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const candidate = new Date(`${date}T${timeFragment}`);
  if (Number.isNaN(candidate.getTime())) {
    return now.toISOString();
  }
  return candidate.toISOString();
};

const isTempDanger = (value: string) => {
  const numeric = numberFromString(value);
  if (numeric == null) return false;
  return (
    numeric >= thresholds.temp.danger ||
    numeric < thresholds.temp.min ||
    numeric > thresholds.temp.max
  );
};

const isWeightDanger = (value: string) => {
  const numeric = numberFromString(value);
  if (numeric == null) return false;
  return numeric < thresholds.weight.min || numeric > thresholds.weight.max;
};

type BulkObservationListProps = {
  fullHeight?: boolean;
  weightGroup?: WeightGroupFilter;
};

export default function BulkObservationList(
  { fullHeight = false, weightGroup = 'all' }: BulkObservationListProps = {},
) {
  const { date } = useObsWorkspaceParams();
  const [rows, setRows] = React.useState<BulkRow[]>(createInitialRows);
  const rowRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const lastSync = useLastSync();
  const toast = useToast();

  const visibleRows = React.useMemo(() => {
    const annotated = rows.map((row, index) => ({ row, index }));
    if (weightGroup === 'all') {
      return annotated;
    }
    return annotated.filter(
      ({ row }) => userIndex.get(row.userId)?.weightGroup === weightGroup,
    );
  }, [rows, weightGroup]);

  const visibleOrder = React.useMemo(
    () => visibleRows.map(({ index }) => index),
    [visibleRows],
  );

  React.useEffect(() => {
    rowRefs.current.length = rows.length;
  }, [rows.length]);

  const focusRow = React.useCallback((rowIndex: number | null) => {
    if (rowIndex == null) {
      return;
    }
    const target = rowRefs.current[rowIndex];
    if (target) {
      target.focus({ preventScroll: true });
    }
  }, []);

  const getNeighborRowIndex = React.useCallback(
    (currentRowIndex: number, direction: 1 | -1) => {
      if (visibleOrder.length === 0) {
        return null;
      }
      const position = visibleOrder.indexOf(currentRowIndex);
      if (position === -1) {
        return visibleOrder[direction > 0 ? 0 : visibleOrder.length - 1];
      }
      const nextPosition = position + direction;
      if (nextPosition < 0) {
        return visibleOrder[0];
      }
      if (nextPosition >= visibleOrder.length) {
        return visibleOrder[visibleOrder.length - 1];
      }
      return visibleOrder[nextPosition];
    },
    [visibleOrder],
  );

  const markStatus = React.useCallback((index: number, status: RowStatus) => {
    setRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, status } : row)),
    );
  }, []);

  const saveRow = React.useCallback(
    async (rowIndex: number) => {
      const row = rows[rowIndex];
      if (!row) {
        return false;
      }

      const temp = numberFromString(row.temp);
      const weight = numberFromString(row.weight);

      const vitals: ObservationVitalsPayload = {};
      if (temp != null) {
        vitals.temp = temp;
      }
      if (weight != null) {
        vitals.weight = weight;
      }

      if (Object.keys(vitals).length === 0 && row.memo.trim().length === 0) {
        markStatus(rowIndex, 'error');
        return false;
      }

      const timestampUtc = buildTimestamp(date);
      const idempotencyKey = buildIdempotencyKey({ userId: row.userId, type: 'observation', timestampUtc });
      const result = queue.add({
        idempotencyKey,
        type: 'observation',
        userId: row.userId,
        vitals,
        memo: row.memo.trim(),
        tags: [],
        timestampUtc,
        localTz: 'Asia/Tokyo',
        source: 'observation.form',
        retryCount: 0,
      });

      if (result.warned) {
        const severity = result.size >= QUEUE_MAX ? 'warning' : 'info';
        const message =
          severity === 'warning'
            ? `未送信キューが上限に近づいています（${result.size}/${QUEUE_MAX}）。同期してください。`
            : `未送信キュー：${result.size} 件`;
        toast.show(message, severity);
      }

      markStatus(rowIndex, 'queued');
      return true;
    },
  [date, markStatus, rows, toast],
  );

  const handleKey = React.useCallback(
    async (rowIndex: number, event: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const success = await saveRow(rowIndex);
        if (success) {
          const direction: 1 | -1 = event.shiftKey ? -1 : 1;
          const nextIndex = getNeighborRowIndex(rowIndex, direction);
          focusRow(nextIndex);
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveRow(rowIndex);
      }
    },
    [focusRow, getNeighborRowIndex, saveRow],
  );

  const updateRow = React.useCallback(
    (index: number, patch: Partial<BulkRow>) => {
      setRows((prev) =>
        prev.map((row, rowIndex) =>
          rowIndex === index
            ? {
                ...row,
                ...patch,
                status: patch.status ?? row.status,
              }
            : row,
        ),
      );
    },
    [],
  );

  const applyFlushSummary = React.useCallback(
    (summary?: FlushSummary | null) => {
      if (!summary || summary.entries.length === 0) {
        return;
      }
      const statusByUser = new Map(summary.entries.map((entry) => [entry.userId, entry.status] as const));
      setRows((prev) =>
        prev.map((row) => {
          const nextStatus = statusByUser.get(row.userId);
          if (!nextStatus) {
            return row;
          }
          const mapped: RowStatus =
            nextStatus === 'ok' ? 'ok' : nextStatus === 'partial' ? 'partial' : 'error';
          return { ...row, status: mapped };
        }),
      );
    },
    [],
  );

  const runFlush = React.useCallback(async () => {
    try {
  const summary = await flushNurseQueue(undefined, { source: 'manual', suppressToast: true });
      applyFlushSummary(summary);
      const payload = formatFlushSummaryToast(summary);
      toast.show(payload.message, payload.severity);
    } catch {
      setRows((prev) =>
        prev.map((row) => (row.status === 'queued' ? { ...row, status: 'error' } : row)),
      );
      toast.show('一括同期に失敗しました', 'error');
    }
  }, [applyFlushSummary, toast]);

  React.useEffect(() => {
    const summary = lastSync.summary;
    if (!summary || summary.entries.length === 0) {
      return;
    }
    applyFlushSummary(summary);
  }, [lastSync.summary, applyFlushSummary]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleBulkSync = () => {
      void runFlush();
    };
    const listener: EventListener = () => {
      handleBulkSync();
    };
    window.addEventListener('nurse:bulk-sync', listener);
    return () => {
      window.removeEventListener('nurse:bulk-sync', listener);
    };
  }, [runFlush]);

  return (
    <Paper
      variant="outlined"
      role="region"
      aria-label="一覧入力"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: fullHeight ? '100%' : undefined,
        flex: fullHeight ? 1 : undefined,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, gap: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            一覧入力
          </Typography>
          <ShortcutHint />
        </Stack>
        <Tooltip title="Alt+S でも実行できます">
          <span>
            <Button
              startIcon={<SyncRoundedIcon />}
              onClick={() => {
                void runFlush();
              }}
              data-testid={TESTIDS.NURSE_BULK_SYNC}
              variant="contained"
            >
              一括同期
            </Button>
          </span>
        </Tooltip>
      </Stack>

      <Box sx={{ px: 2, pb: 1 }}>
        <StatusLegend />
      </Box>

      <Box sx={{ px: 2, pb: 2, overflow: 'auto', flex: 1, minHeight: 0 }}>
        <Table
          size="small"
          role="grid"
          aria-label="健康記録 一覧入力"
          data-testid={TESTIDS.NURSE_BULK_TABLE}
          stickyHeader
        >
          <TableHead>
            <TableRow>
              <TableCell
                role="columnheader"
                scope="col"
                data-testid={TESTIDS.NURSE_BULK_COL_USER}
              >
                利用者
              </TableCell>
              <TableCell
                role="columnheader"
                scope="col"
                data-testid={TESTIDS.NURSE_BULK_COL_TEMP}
              >
                体温
              </TableCell>
              <TableCell
                role="columnheader"
                scope="col"
                data-testid={TESTIDS.NURSE_BULK_COL_WEIGHT}
              >
                体重
              </TableCell>
              <TableCell
                role="columnheader"
                scope="col"
                data-testid={TESTIDS.NURSE_BULK_COL_MEMO}
              >
                メモ
              </TableCell>
              <TableCell
                role="columnheader"
                scope="col"
                align="right"
                data-testid={TESTIDS.NURSE_BULK_COL_SAVE}
              >
                保存
              </TableCell>
              <TableCell
                role="columnheader"
                scope="col"
                data-testid={TESTIDS.NURSE_BULK_COL_STATUS}
              >
                状態
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    選択したグループの対象者が見つかりませんでした。
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map(({ row, index: rowIndex }) => {
                const userMeta = userIndex.get(row.userId);
                const rowId = row.userId;
                const statusLabel = statusLabels[row.status];
                const statusIcon = (() => {
                  if (row.status === 'queued') {
                    return <PendingRoundedIcon color="warning" fontSize="small" />;
                  }
                  if (row.status === 'ok') {
                    return <CheckCircleRoundedIcon color="success" fontSize="small" />;
                  }
                  if (row.status === 'partial') {
                    return <CheckCircleRoundedIcon color="info" fontSize="small" />;
                  }
                  if (row.status === 'error') {
                    return <ErrorRoundedIcon color="error" fontSize="small" />;
                  }
                  return <span aria-hidden="true">—</span>;
                })();

                return (
                  <TableRow
                    key={rowId}
                    role="row"
                    {...tidWithSuffix(TESTIDS.NURSE_BULK_ROW_PREFIX, `-${rowId}`)}
                    data-status={row.status}
                    onKeyDown={(event) => handleKey(rowIndex, event)}
                  >
                    <TableCell role="gridcell">
                      <Stack spacing={0.25} sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {rowId}
                        </Typography>
                        {userMeta?.name ? (
                          <Typography variant="caption" color="text.secondary">
                            {userMeta.name}
                          </Typography>
                        ) : null}
                      </Stack>
                    </TableCell>

                    <TableCell role="gridcell">
                      <VitalCell
                        id={`${TESTIDS.NURSE_BULK_FIELD_PREFIX}-temp-${rowId}`}
                        label={`${rowId} 体温（℃）`}
                        unit="℃"
                        value={row.temp}
                        danger={isTempDanger(row.temp)}
                        min={thresholds.temp.min}
                        max={thresholds.temp.max}
                        onChange={(value) => updateRow(rowIndex, { temp: value })}
                      />
                    </TableCell>

                    <TableCell role="gridcell">
                      <VitalCell
                        id={`${TESTIDS.NURSE_BULK_FIELD_PREFIX}-weight-${rowId}`}
                        label={`${rowId} 体重（kg）`}
                        unit="kg"
                        value={row.weight}
                        danger={isWeightDanger(row.weight)}
                        min={thresholds.weight.min}
                        max={thresholds.weight.max}
                        onChange={(value) => updateRow(rowIndex, { weight: value })}
                      />
                    </TableCell>

                    <TableCell role="gridcell" sx={{ minWidth: 160 }}>
                      <TextField
                        size="small"
                        value={row.memo}
                        onChange={(event) => updateRow(rowIndex, { memo: event.target.value })}
                        inputProps={{
                          'aria-label': `${rowId} メモ`,
                          ...tidWithSuffix(TESTIDS.NURSE_BULK_FIELD_PREFIX, `-memo-${rowId}`),
                        }}
                        fullWidth
                      />
                    </TableCell>

                    <TableCell role="gridcell" align="right">
                      <IconButton
                        aria-label={`${rowId} を保存`}
                        {...tidWithSuffix(TESTIDS.NURSE_BULK_SAVE_PREFIX, `-${rowId}`)}
                        onClick={async () => {
                          const success = await saveRow(rowIndex);
                          if (success) {
                            const nextIndex = getNeighborRowIndex(rowIndex, 1);
                            focusRow(nextIndex);
                          }
                        }}
                        ref={(element) => {
                          rowRefs.current[rowIndex] = element;
                        }}
                      >
                        <PendingRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>

                    <TableCell
                      role="gridcell"
                      {...tidWithSuffix(TESTIDS.NURSE_BULK_STATUS_PREFIX, `-${rowId}`)}
                      aria-label={statusLabel}
                      data-status={row.status}
                      sx={{ minWidth: 56 }}
                    >
                      {statusIcon}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
}
