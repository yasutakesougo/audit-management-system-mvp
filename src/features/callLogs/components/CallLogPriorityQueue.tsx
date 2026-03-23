/**
 * CallLogPriorityQueue — 優先度別グループで未対応ログを表示するコンポーネント（ZONE B）
 *
 * 責務:
 * - groupCallLogsByPriority の結果を受け取り、グループ別に表示
 * - Hero に表示済みの1件を除外して表示
 * - 各行から「完了にする」操作を提供
 *
 * 設計:
 * - データは props で受け取るのみ（hook を持たない）
 * - 全グループ空なら非表示（null を返す）
 * - CallLogRow は CallLogPage 内のものと同じ構造を使う
 */

import React from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { CallLogPriorityGroup, PriorityGroupKey } from '../domain/groupCallLogsByPriority';
import type { CallLog } from '@/domain/callLogs/schema';
import { getCallbackDueInfo, type CallbackDueLevel } from '../domain/callbackDueLabel';
import { CallLogStatusChip } from './CallLogStatusChip';
import { CallLogUrgencyChip } from './CallLogUrgencyChip';
import { formatDateTimeIntl } from '@/lib/dateFormat';

// ─── Props ────────────────────────────────────────────────────────────────────

export type CallLogPriorityQueueProps = {
  /** groupCallLogsByPriority の結果 */
  groups: CallLogPriorityGroup[];
  /** Hero に表示中の log.id（重複防止で除外する） */
  heroLogId?: string;
  /** 完了にするハンドラ */
  onMarkDone: (id: string) => void;
  /** 更新中フラグ */
  isUpdating: boolean;
  /** 行クリック時のコールバック（テレメトリ用） */
  onItemClick?: () => void;
};

// ─── 視覚マッピング ──────────────────────────────────────────────────────────

const GROUP_ICON: Record<PriorityGroupKey, React.ReactNode> = {
  overdue: <ErrorOutlineIcon fontSize="small" color="error" />,
  'due-soon': <WarningAmberIcon fontSize="small" color="warning" />,
  open: <AccessTimeIcon fontSize="small" color="action" />,
};

const GROUP_CHIP_COLOR: Record<PriorityGroupKey, 'error' | 'warning' | 'default'> = {
  overdue: 'error',
  'due-soon': 'warning',
  open: 'default',
};

const DUE_CHIP_COLOR: Record<CallbackDueLevel, 'error' | 'warning' | 'default' | 'info'> = {
  overdue: 'error',
  'due-soon': 'warning',
  'due-later': 'default',
  none: 'default',
};

// ─── 日時フォーマット ─────────────────────────────────────────────────────────

const formatDateTime = (iso: string): string =>
  formatDateTimeIntl(iso, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }, iso);

// ─── PriorityRow（Queue 内の行） ──────────────────────────────────────────────

type PriorityRowProps = {
  log: CallLog;
  onMarkDone: (id: string) => void;
  isUpdating: boolean;
  onItemClick?: () => void;
};

const PriorityRow: React.FC<PriorityRowProps> = ({ log, onMarkDone, isUpdating, onItemClick }) => {
  const dueInfo = getCallbackDueInfo(log);

  return (
    <ListItem
      divider
      data-testid={`priority-row-${log.id}`}
      secondaryAction={
        log.status !== 'done' ? (
          <Tooltip title="完了にする">
            <span>
              <IconButton
                size="small"
                color="success"
                onClick={() => onMarkDone(log.id)}
                disabled={isUpdating}
                data-testid={`priority-done-btn-${log.id}`}
                aria-label={`${log.callerName}からの連絡を完了にする`}
              >
                <CheckCircleOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ) : null
      }
      sx={{ py: 1, pl: 3, cursor: onItemClick ? 'pointer' : undefined }}
      onClick={onItemClick}
    >
      <ListItemText
        primary={
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
              {log.subject}
            </Typography>
            <CallLogStatusChip status={log.status} />
            <CallLogUrgencyChip urgency={log.urgency} />
          </Stack>
        }
        secondary={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" mt={0.25}>
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(log.receivedAt)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {log.callerName} → {log.targetStaffName}
            </Typography>
            {log.relatedUserName && (
              <Chip
                icon={<PersonOutlineIcon sx={{ fontSize: 12 }} />}
                label={log.relatedUserName}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: 18 }}
              />
            )}
            {dueInfo.level !== 'none' && (
              <Chip
                label={dueInfo.label}
                size="small"
                variant={dueInfo.level === 'overdue' ? 'filled' : 'outlined'}
                color={DUE_CHIP_COLOR[dueInfo.level]}
                sx={{ fontSize: '0.65rem', height: 18, fontWeight: dueInfo.level === 'overdue' ? 700 : 400 }}
              />
            )}
          </Stack>
        }
      />
    </ListItem>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const CallLogPriorityQueue: React.FC<CallLogPriorityQueueProps> = ({
  groups,
  heroLogId,
  onMarkDone,
  isUpdating,
  onItemClick,
}) => {
  // Hero と重複するログを除外
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      logs: heroLogId
        ? group.logs.filter((l) => l.id !== heroLogId)
        : group.logs,
    }))
    .filter((group) => group.logs.length > 0);

  // 全グループ空なら非表示
  if (filteredGroups.length === 0) return null;

  return (
    <Box data-testid="call-log-priority-queue" sx={{ mt: 2 }}>
      <Typography
        variant="overline"
        sx={{
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'text.secondary',
          fontSize: '0.7rem',
          mb: 1,
          display: 'block',
        }}
      >
        対応キュー
      </Typography>

      {filteredGroups.map((group) => (
        <Collapse in key={group.key} timeout={300}>
          <Box
            sx={{
              mb: 1.5,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
            }}
            data-testid={`priority-group-${group.key}`}
          >
            {/* グループヘッダー */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.75}
              sx={{
                px: 2,
                py: 1,
                bgcolor: 'action.hover',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              {GROUP_ICON[group.key]}
              <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
                {group.label}
              </Typography>
              <Chip
                label={`${group.logs.length}件`}
                size="small"
                color={GROUP_CHIP_COLOR[group.key]}
                variant="filled"
                sx={{ fontWeight: 700, fontSize: '0.7rem', height: 20, minWidth: 32 }}
              />
            </Stack>

            {/* 行リスト */}
            <List disablePadding>
              {group.logs.map((log) => (
                <PriorityRow
                  key={log.id}
                  log={log}
                  onMarkDone={onMarkDone}
                  isUpdating={isUpdating}
                  onItemClick={onItemClick}
                />
              ))}
            </List>
          </Box>
        </Collapse>
      ))}
    </Box>
  );
};

export default CallLogPriorityQueue;
