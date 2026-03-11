/**
 * HandoffUserGroupedView — 利用者ごとに申し送りをグループ表示
 *
 * 折りたたみ時: 利用者名 + 最新メッセージ + 投稿者 + 件数 + 重要度バッジ
 * 展開時: その利用者の全投稿を HandoffItem で表示
 *
 * 既存の TodayHandoffTimelineList と同じ props で差し替え可能。
 */

import { motionTokens } from '@/app/theme';
import {
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon,
    FiberManualRecord as FiberManualRecordIcon,
    Person as PersonIcon,
} from '@mui/icons-material';
import {
    Box,
    Card,
    CardActionArea,
    CardContent,
    Chip,
    Collapse,
    Skeleton,
    Stack,
    Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { groupHandoffsByUser, type HandoffUserGroup } from '../domain/groupHandoffsByUser';
import { getSeverityColor } from '../handoffConstants';
import type { HandoffRecord, HandoffStatus, MeetingMode } from '../handoffTypes';
import type { WorkflowActions } from '../useHandoffTimelineViewModel';
import { HandoffItem } from './HandoffItem';

// ────────────────────────────────────────────────────────────
// 時刻フォーマット
// ────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

type HandoffUserGroupedViewProps = {
  items: HandoffRecord[];
  loading: boolean;
  error: string | null;
  updateHandoffStatus: (id: number, newStatus: HandoffStatus, carryOverDate?: string) => Promise<void>;
  meetingMode?: MeetingMode;
  workflowActions?: WorkflowActions;
};

// ────────────────────────────────────────────────────────────
// 利用者グループカード（1人分）
// ────────────────────────────────────────────────────────────

type UserGroupCardProps = {
  group: HandoffUserGroup;
  updateHandoffStatus: HandoffUserGroupedViewProps['updateHandoffStatus'];
  meetingMode: MeetingMode;
  workflowActions?: WorkflowActions;
};

const UserGroupCard: React.FC<UserGroupCardProps> = ({
  group,
  updateHandoffStatus,
  meetingMode,
  workflowActions,
}) => {
  const [expanded, setExpanded] = useState(false);

  // 重要度に基づくアクセントカラー
  const accentColor = (() => {
    if (group.hasImportant) return 'error.main';
    if (group.hasCaution) return 'warning.main';
    return 'grey.400';
  })();

  const accentBg = (() => {
    if (group.hasImportant) return 'rgba(211, 47, 47, 0.04)';
    if (group.hasCaution) return 'rgba(237, 108, 2, 0.03)';
    return undefined;
  })();

  // メッセージを1行に収める
  const truncatedMessage = group.latestMessage.length > 60
    ? group.latestMessage.substring(0, 60) + '…'
    : group.latestMessage;

  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: `4px solid`,
        borderLeftColor: accentColor,
        bgcolor: accentBg || 'background.paper',
        transition: motionTokens.transition.cardInteractive,
        '&:hover': {
          bgcolor: accentBg || 'action.hover',
        },
      }}
    >
      {/* ── 折りたたみヘッダー ── */}
      <CardActionArea onClick={() => setExpanded((p) => !p)}>
        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
          <Stack spacing={0.75}>

            {/* ROW 1: 利用者名 + 件数 + バッジ */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: 'text.primary',
                }}
              >
                {group.userName}
              </Typography>

              <Chip
                size="small"
                label={`${group.totalCount}件`}
                variant="outlined"
                sx={{
                  height: 22,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  borderColor: 'divider',
                }}
              />

              {group.hasImportant && (
                <Chip
                  size="small"
                  label="重要"
                  color={getSeverityColor('重要')}
                  variant="filled"
                  sx={{ height: 22, fontSize: '0.65rem', fontWeight: 700 }}
                />
              )}

              {!group.hasImportant && group.hasCaution && (
                <Chip
                  size="small"
                  label="要注意"
                  color={getSeverityColor('要注意')}
                  variant="filled"
                  sx={{ height: 22, fontSize: '0.65rem', fontWeight: 600 }}
                />
              )}

              <Box sx={{ flexGrow: 1 }} />

              {expanded
                ? <ExpandLessIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                : <ExpandMoreIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              }
            </Stack>

            {/* ROW 2: 最新メッセージ（1行） */}
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                lineHeight: 1.4,
                fontSize: '0.825rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {truncatedMessage}
            </Typography>

            {/* ROW 3: 最新投稿者 + 時刻 */}
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <FiberManualRecordIcon sx={{ fontSize: 6, color: 'text.disabled' }} />
              <Typography
                variant="caption"
                sx={{
                  color: 'text.disabled',
                  fontSize: '0.68rem',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatTime(group.latestAt)} {group.latestAuthorName}
              </Typography>
            </Stack>

          </Stack>
        </CardContent>
      </CardActionArea>

      {/* ── 展開時: 全投稿を HandoffItem で表示 ── */}
      <Collapse in={expanded} timeout={250}>
        <Box
          sx={{
            px: 1.5,
            pb: 1.5,
            pt: 0.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', mb: 1, display: 'block' }}
          >
            {group.userName} の申し送り（{group.totalCount}件）
          </Typography>

          <Stack spacing={1.5}>
            {group.records.map((record) => (
              <HandoffItem
                key={record.id}
                item={record}
                onStatusChange={async (id, status) => {
                  await updateHandoffStatus(id, status);
                }}
                meetingMode={meetingMode}
                workflowActions={workflowActions}
              />
            ))}
          </Stack>
        </Box>
      </Collapse>
    </Card>
  );
};

// ────────────────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────────────────

export const HandoffUserGroupedView: React.FC<HandoffUserGroupedViewProps> = ({
  items,
  loading,
  error,
  updateHandoffStatus,
  meetingMode = 'normal',
  workflowActions,
}) => {
  const groups = useMemo(() => groupHandoffsByUser(items), [items]);

  // ── ローディング ──
  if (loading) {
    return (
      <Stack spacing={1.5}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={80} />
        ))}
      </Stack>
    );
  }

  // ── エラー ──
  if (error) {
    return (
      <Typography color="error" variant="body2">
        ⚠️ 申し送りの読み込みに失敗しました: {error}
      </Typography>
    );
  }

  // ── 空状態 ──
  if (groups.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 4,
          px: 2,
          bgcolor: 'grey.50',
          borderRadius: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          📋 該当する申し送りはありません
        </Typography>
      </Box>
    );
  }

  // ── グループ一覧 ──
  return (
    <Stack spacing={1.5} data-testid="handoff-user-grouped-view">
      {groups.map((group) => (
        <UserGroupCard
          key={group.userId}
          group={group}
          updateHandoffStatus={updateHandoffStatus}
          meetingMode={meetingMode}
          workflowActions={workflowActions}
        />
      ))}
    </Stack>
  );
};
