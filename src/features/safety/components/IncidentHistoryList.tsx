// ---------------------------------------------------------------------------
// IncidentHistoryList — インシデント履歴一覧コンポーネント
//
// P0-1: 危機対応記録のリスト表示。severity フィルター・ソート対応。
// ---------------------------------------------------------------------------
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
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
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';

import type { RiskSeverity } from '@/domain/support/highRiskIncident';
import type { IncidentRecord, IncidentType } from '@/domain/support/incidentRepository';
import { localIncidentRepository } from '@/infra/localStorage/localIncidentRepository';
import { formatRelativeTime } from '@/lib/dateFormat';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type SeverityFilter = 'all' | RiskSeverity;

const SEVERITY_COLORS: Record<RiskSeverity, 'default' | 'info' | 'warning' | 'error'> = {
  '低': 'default',
  '中': 'info',
  '高': 'warning',
  '重大インシデント': 'error',
};

const SEVERITY_ICONS: Record<RiskSeverity, React.ReactNode> = {
  '低': null,
  '中': <ErrorOutlineIcon fontSize="small" />,
  '高': <WarningAmberIcon fontSize="small" />,
  '重大インシデント': <ReportProblemIcon fontSize="small" />,
};

const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  behavior: '行動',
  injury: '負傷',
  property: '物品破損',
  elopement: '離設',
  other: 'その他',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// relativeTime — replaced by formatRelativeTime from @/lib/dateFormat
const relativeTime = (iso: string): string => formatRelativeTime(iso);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type IncidentHistoryListProps = {
  /** ユーザーID でフィルター（省略時は全件） */
  userId?: string;
  /** 外部から更新を通知するためのキー */
  refreshKey?: number;
  /** 表示件数上限（デフォルト 20） */
  maxItems?: number;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IncidentHistoryList({
  userId,
  refreshKey = 0,
  maxItems = 20,
}: IncidentHistoryListProps) {
  const [records, setRecords] = useState<IncidentRecord[]>([]);
  const [filter, setFilter] = useState<SeverityFilter>('all');

  const loadRecords = useCallback(async () => {
    const data = userId
      ? await localIncidentRepository.getByUserId(userId)
      : await localIncidentRepository.getAll();
    setRecords(data);
  }, [userId]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords, refreshKey]);

  const handleClear = useCallback(async () => {
    // 全件削除（確認付き）
    for (const r of records) {
      await localIncidentRepository.delete(r.id);
    }
    setRecords([]);
  }, [records]);

  // フィルタリング
  const filtered = filter === 'all'
    ? records
    : records.filter((r) => r.severity === filter);

  const display = filtered.slice(0, maxItems);

  // ─────────────────────────────────────
  // Empty state
  // ─────────────────────────────────────
  if (records.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 4,
          textAlign: 'center',
          bgcolor: 'action.hover',
          borderStyle: 'dashed',
        }}
      >
        <HistoryRoundedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography variant="subtitle1" fontWeight={600}>
          インシデント記録はまだありません
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          高リスク事象が記録されると、ここに履歴が表示されます
        </Typography>
      </Paper>
    );
  }

  // ─────────────────────────────────────
  // Main render
  // ─────────────────────────────────────
  return (
    <Stack spacing={1.5}>
      {/* Header + Filter */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        useFlexGap
      >
        <Stack direction="row" spacing={0.5} alignItems="center">
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filter}
            onChange={(_, v) => v && setFilter(v as SeverityFilter)}
          >
            <ToggleButton value="all">すべて</ToggleButton>
            <ToggleButton value="低">低</ToggleButton>
            <ToggleButton value="中">中</ToggleButton>
            <ToggleButton value="高">高</ToggleButton>
            <ToggleButton value="重大インシデント">重大</ToggleButton>
          </ToggleButtonGroup>
          <Chip
            size="small"
            variant="outlined"
            label={`${filtered.length} 件`}
          />
        </Stack>
        <Button
          size="small"
          color="error"
          variant="text"
          onClick={handleClear}
          sx={{ textTransform: 'none' }}
        >
          全件クリア
        </Button>
      </Stack>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>日時</TableCell>
              <TableCell>重症度</TableCell>
              <TableCell>種別</TableCell>
              <TableCell>概要</TableCell>
              <TableCell align="right">報告者</TableCell>
              <TableCell align="right">F/U</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {display.map((record) => (
              <TableRow
                key={record.id}
                hover
                sx={{
                  borderLeft: record.severity === '重大インシデント'
                    ? '3px solid'
                    : record.severity === '高'
                      ? '3px solid'
                      : 'none',
                  borderLeftColor: record.severity === '重大インシデント'
                    ? 'error.main'
                    : record.severity === '高'
                      ? 'warning.main'
                      : 'transparent',
                }}
              >
                <TableCell>
                  <Tooltip title={new Date(record.occurredAt).toLocaleString('ja-JP')} arrow>
                    <Typography variant="body2" noWrap>
                      {relativeTime(record.occurredAt)}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    icon={SEVERITY_ICONS[record.severity] as React.ReactElement | undefined}
                    label={record.severity}
                    color={SEVERITY_COLORS[record.severity]}
                    variant={record.severity === '重大インシデント' ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {INCIDENT_TYPE_LABELS[record.incidentType] ?? record.incidentType}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title={record.description ?? ''} arrow>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {record.description || '—'}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" noWrap>
                    {record.reportedBy}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {record.followUpRequired ? (
                    <Chip size="small" label="要F/U" color="warning" variant="outlined" />
                  ) : (
                    <Typography variant="body2" color="text.secondary">—</Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Overflow indicator */}
      {filtered.length > maxItems && (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            他 {filtered.length - maxItems} 件の記録があります
          </Typography>
        </Box>
      )}
    </Stack>
  );
}
