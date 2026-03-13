// ---------------------------------------------------------------------------
// RestraintHistoryList — 身体拘束等記録の履歴一覧
//
// P0-2: 拘束記録の時系列リスト表示。ステータスフィルター対応。
// ---------------------------------------------------------------------------
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
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

import {
  allThreeRequirementsMet,
  type PhysicalRestraintRecord,
  type RestraintStatus,
} from '@/domain/safety/physicalRestraint';
import { localRestraintRepository } from '@/infra/localStorage/localRestraintRepository';
import { TESTIDS, tid } from '@/testids';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | RestraintStatus;

const STATUS_CONFIG: Record<
  RestraintStatus,
  { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error'; icon: React.ReactNode }
> = {
  draft: { label: '下書き', color: 'default', icon: <ErrorOutlineIcon fontSize="small" /> },
  submitted: { label: '提出済', color: 'info', icon: <HourglassBottomIcon fontSize="small" /> },
  approved: { label: '承認済', color: 'success', icon: <CheckCircleIcon fontSize="small" /> },
  rejected: { label: '差戻し', color: 'error', icon: <WarningAmberIcon fontSize="small" /> },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;

  if (diffMs < 60_000) return 'たった今';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}分前`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}時間前`;
  if (diffMs < 604_800_000) return `${Math.floor(diffMs / 86_400_000)}日前`;

  return new Date(iso).toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type RestraintHistoryListProps = {
  /** ユーザーID でフィルター（省略時は全件） */
  userId?: string;
  /** 外部から更新を通知するためのキー */
  refreshKey?: number;
  /** 表示件数上限（デフォルト 20） */
  maxItems?: number;
  /** 承認ボタンクリック時 */
  onApprove?: (id: string) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RestraintHistoryList({
  userId,
  refreshKey = 0,
  maxItems = 20,
  onApprove,
}: RestraintHistoryListProps) {
  const [records, setRecords] = useState<PhysicalRestraintRecord[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const loadRecords = useCallback(async () => {
    const data = userId
      ? await localRestraintRepository.getByUserId(userId)
      : await localRestraintRepository.getAll();
    setRecords(data);
  }, [userId]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords, refreshKey]);

  // フィルタリング
  const filtered =
    filter === 'all' ? records : records.filter((r) => r.status === filter);

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
          身体拘束記録はまだありません
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          身体拘束等の記録が作成されると、ここに履歴が表示されます
        </Typography>
      </Paper>
    );
  }

  // ─────────────────────────────────────
  // Main render
  // ─────────────────────────────────────
  return (
    <Stack spacing={1.5} {...tid(TESTIDS['safety-restraint-history'])}>
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
            onChange={(_, v) => v && setFilter(v as StatusFilter)}
          >
            <ToggleButton value="all">すべて</ToggleButton>
            <ToggleButton value="draft">下書き</ToggleButton>
            <ToggleButton value="submitted">提出済</ToggleButton>
            <ToggleButton value="approved">承認済</ToggleButton>
            <ToggleButton value="rejected">差戻し</ToggleButton>
          </ToggleButtonGroup>
          <Chip
            size="small"
            variant="outlined"
            label={`${filtered.length} 件`}
          />
        </Stack>

        {/* 未承認件数の警告 */}
        {records.filter((r) => r.status === 'submitted').length > 0 && (
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            icon={<HourglassBottomIcon />}
            label={`${records.filter((r) => r.status === 'submitted').length} 件の承認待ち`}
          />
        )}
      </Stack>

      {/* 三要件未充足警告 */}
      {records.some((r) => !allThreeRequirementsMet(r.threeRequirements)) && (
        <Alert severity="error" icon={<WarningAmberIcon />}>
          三要件が未確認の記録があります。制度上、三要件すべての確認が必要です。
        </Alert>
      )}

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>日時</TableCell>
              <TableCell>態様</TableCell>
              <TableCell align="center">継続時間</TableCell>
              <TableCell align="center">三要件</TableCell>
              <TableCell>記録者</TableCell>
              <TableCell align="center">ステータス</TableCell>
              {onApprove && <TableCell align="right">操作</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {display.map((record) => {
              const reqMet = allThreeRequirementsMet(record.threeRequirements);
              const statusCfg = STATUS_CONFIG[record.status];

              return (
                <TableRow
                  key={record.id}
                  hover
                  sx={{
                    borderLeft: !reqMet ? '3px solid' : 'none',
                    borderLeftColor: !reqMet ? 'error.main' : 'transparent',
                  }}
                >
                  <TableCell>
                    <Tooltip
                      title={new Date(record.startedAt).toLocaleString('ja-JP')}
                      arrow
                    >
                      <Typography variant="body2" noWrap>
                        {relativeTime(record.startedAt)}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
                      {record.restraintType}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                      <AccessTimeIcon fontSize="small" color={record.durationMinutes > 120 ? 'warning' : 'action'} />
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={record.durationMinutes > 120 ? 'warning.main' : 'text.primary'}
                      >
                        {formatDuration(record.durationMinutes)}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={reqMet ? '充足' : '未充足'}
                      color={reqMet ? 'success' : 'error'}
                      variant={reqMet ? 'outlined' : 'filled'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap>
                      {record.recordedBy}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      {...tid(TESTIDS['safety-restraint-approval-chip'])}
                      size="small"
                      icon={statusCfg.icon as React.ReactElement}
                      label={statusCfg.label}
                      color={statusCfg.color}
                      variant={record.status === 'approved' ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  {onApprove && (
                    <TableCell align="right">
                      {record.status === 'submitted' && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          onClick={() => onApprove(record.id)}
                          sx={{ textTransform: 'none' }}
                        >
                          承認
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
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
