// ---------------------------------------------------------------------------
// ImportHistoryPanel — CSVインポート履歴一覧コンポーネント
//
// 直近のCSVインポート履歴をテーブル形式で表示する。
// ターゲット別フィルターとステータスアイコンを備える。
// ---------------------------------------------------------------------------
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HistoryIcon from '@mui/icons-material/History';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  importHistoryStore,
  type ImportHistoryEntry,
  type ImportHistoryStatus,
  type ImportTarget,
} from '@/features/import/domain/importHistory';
import { formatRelativeTime as _formatRelativeTime } from '@/lib/dateFormat';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TARGET_LABELS: Record<ImportTarget, string> = {
  users: '利用者マスタ',
  support: '日課表',
  care: '要配慮事項',
};

const TARGET_COLORS: Record<ImportTarget, string> = {
  users: '#6366f1',
  support: '#0ea5e9',
  care: '#f59e0b',
};

const STATUS_CONFIG: Record<ImportHistoryStatus, {
  label: string;
  color: 'success' | 'warning' | 'error';
  icon: React.ReactNode;
}> = {
  success: {
    label: '成功',
    color: 'success',
    icon: <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />,
  },
  partial: {
    label: '一部エラー',
    color: 'warning',
    icon: <WarningAmberIcon sx={{ fontSize: 18 }} />,
  },
  failed: {
    label: '失敗',
    color: 'error',
    icon: <ErrorOutlineIcon sx={{ fontSize: 18 }} />,
  },
};

const FILTER_OPTIONS: { id: ImportTarget | 'all'; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'users', label: '利用者' },
  { id: 'support', label: '日課表' },
  { id: 'care', label: '配慮事項' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// formatRelativeTime — delegates to shared API with date-only fallback
const IMPORT_DATE_FALLBACK: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
function formatRelativeTime(isoDate: string): string {
  return _formatRelativeTime(isoDate, IMPORT_DATE_FALLBACK);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImportHistoryPanel({
  /** 外部から履歴更新を通知するインクリメント値 */
  refreshKey = 0,
}: {
  refreshKey?: number;
}) {
  const [entries, setEntries] = useState<ImportHistoryEntry[]>([]);
  const [filter, setFilter] = useState<ImportTarget | 'all'>('all');

  // 履歴データを読み込む
  const loadEntries = useCallback(() => {
    setEntries(importHistoryStore.getAll());
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries, refreshKey]);

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) => e.target === filter);
  }, [entries, filter]);

  const displayEntries = filteredEntries.slice(0, 15);

  const handleClearHistory = useCallback(() => {
    importHistoryStore.clear();
    setEntries([]);
  }, []);

  // ── 空状態 ──
  if (entries.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 4,
          textAlign: 'center',
          borderRadius: 2,
          borderStyle: 'dashed',
          bgcolor: 'action.hover',
        }}
        data-testid="import-history-empty"
      >
        <HistoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          インポート履歴はまだありません
        </Typography>
        <Typography variant="caption" color="text.disabled">
          CSVファイルをインポートすると、ここに履歴が表示されます
        </Typography>
      </Paper>
    );
  }

  return (
    <Box data-testid="import-history-panel">
      {/* ── Header + Filter ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Stack direction="row" spacing={0.75}>
          {FILTER_OPTIONS.map((opt) => {
            const isActive = filter === opt.id;
            return (
              <Chip
                key={opt.id}
                label={opt.label}
                size="small"
                variant={isActive ? 'filled' : 'outlined'}
                color={isActive ? 'primary' : 'default'}
                onClick={() => setFilter(opt.id)}
                data-testid={`filter-${opt.id}`}
                sx={{
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              />
            );
          })}
        </Stack>

        <Tooltip title="すべてのインポート履歴を削除">
          <Button
            size="small"
            color="inherit"
            startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
            onClick={handleClearHistory}
            data-testid="btn-clear-history"
            sx={{
              fontSize: '0.75rem',
              color: 'text.disabled',
              '&:hover': { color: 'error.main' },
            }}
          >
            履歴をクリア
          </Button>
        </Tooltip>
      </Box>

      {/* ── Table ── */}
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ borderRadius: 2, maxHeight: 400, overflow: 'auto' }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover', minWidth: 100 }}>
                日時
              </TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover', minWidth: 80 }}>
                対象
              </TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover', minWidth: 60 }}>
                状態
              </TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>
                ファイル名
              </TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }} align="right">
                取込数
              </TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }} align="right">
                総行数
              </TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }} align="right">
                エラー
              </TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }} align="right">
                サイズ
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayEntries.map((entry) => {
              const statusCfg = STATUS_CONFIG[entry.status];
              const targetColor = TARGET_COLORS[entry.target];

              return (
                <TableRow
                  key={entry.id}
                  hover
                  data-testid={`history-row-${entry.id}`}
                  sx={{
                    '&:last-child td': { borderBottom: 0 },
                    transition: 'background 0.15s',
                  }}
                >
                  {/* 日時 */}
                  <TableCell>
                    <Tooltip title={new Date(entry.importedAt).toLocaleString('ja-JP')}>
                      <Typography variant="caption" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
                        {formatRelativeTime(entry.importedAt)}
                      </Typography>
                    </Tooltip>
                  </TableCell>

                  {/* 対象 */}
                  <TableCell>
                    <Chip
                      label={TARGET_LABELS[entry.target]}
                      size="small"
                      variant="outlined"
                      sx={{
                        borderColor: `${targetColor}60`,
                        color: targetColor,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        height: 22,
                      }}
                    />
                  </TableCell>

                  {/* 状態 */}
                  <TableCell>
                    <Chip
                      icon={statusCfg.icon as React.ReactElement}
                      label={statusCfg.label}
                      size="small"
                      color={statusCfg.color}
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 22 }}
                    />
                  </TableCell>

                  {/* ファイル名 */}
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: 'monospace',
                        maxWidth: 180,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                    >
                      {entry.fileName}
                    </Typography>
                  </TableCell>

                  {/* 取込数 */}
                  <TableCell align="right">
                    <Typography variant="caption" fontWeight={700}>
                      {entry.importedRecords.toLocaleString()}
                    </Typography>
                  </TableCell>

                  {/* 総行数 */}
                  <TableCell align="right">
                    <Typography variant="caption" color="text.secondary">
                      {entry.totalRows.toLocaleString()}
                    </Typography>
                  </TableCell>

                  {/* エラー */}
                  <TableCell align="right">
                    {entry.errorCount > 0 ? (
                      <Typography variant="caption" color="error.main" fontWeight={700}>
                        {entry.errorCount}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.disabled">
                        —
                      </Typography>
                    )}
                  </TableCell>

                  {/* サイズ */}
                  <TableCell align="right">
                    <Typography variant="caption" color="text.disabled">
                      {formatFileSize(entry.fileSize)}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Footer ── */}
      {filteredEntries.length > displayEntries.length && (
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ mt: 1, display: 'block', textAlign: 'center' }}
        >
          他 {filteredEntries.length - displayEntries.length} 件の履歴…
        </Typography>
      )}

      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ mt: 0.5, display: 'block', textAlign: 'right' }}
      >
        合計 {entries.length} 件の履歴
      </Typography>
    </Box>
  );
}
