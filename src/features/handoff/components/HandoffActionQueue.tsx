/**
 * HandoffActionQueue — ZONE B: 要対応の申し送りを重要度順に表示
 *
 * 責務:
 * - groupHandoffsByPriority の結果をグループ表示する
 * - 各行に「確認する」「対応済にする」CTA を配置
 * - Hero で表示中の1件は除外済み前提（親で excludeId 適用済）
 *
 * 設計:
 * - props コールバックのみ呼ぶ（テレメトリは Step 3 で Page 層に接続）
 * - ドメインロジック呼び出しなし（親から結果を受け取る）
 * - 既存の表示資産（getSeverityColor / getStatusColor）を再利用
 */

import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as DoneIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import type { HandoffPriorityGroup } from '../domain/groupHandoffsByPriority';
import type { HandoffRecord } from '../handoffTypes';
import { getSeverityColor } from '../handoffConstants';

// ─── Props ──────────────────────────────────────────────────

export type HandoffActionQueueProps = {
  /** groupHandoffsByPriority の結果（空配列 = 要対応なし） */
  groups: HandoffPriorityGroup[];
  /** 行クリック — テレメトリ用（Step 3 で接続） */
  onItemClick?: (recordId: number) => void;
  /** 「対応済にする」ボタン押下 */
  onMarkDone?: (recordId: number) => void;
};

// ─── 行コンポーネント ───────────────────────────────────────

type QueueRowProps = {
  record: HandoffRecord;
  onItemClick?: (recordId: number) => void;
  onMarkDone?: (recordId: number) => void;
};

function QueueRow({ record, onItemClick, onMarkDone }: QueueRowProps) {
  return (
    <ListItem
      sx={{
        px: 1.5,
        py: 1,
        '&:hover': { bgcolor: 'action.hover' },
        cursor: onItemClick ? 'pointer' : 'default',
      }}
      onClick={() => onItemClick?.(record.id)}
      data-testid={`handoff-queue-row-${record.id}`}
      secondaryAction={
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="確認する">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onItemClick?.(record.id);
              }}
            >
              <OpenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="対応済にする">
            <IconButton
              size="small"
              color="success"
              onClick={(e) => {
                e.stopPropagation();
                onMarkDone?.(record.id);
              }}
              data-testid={`handoff-queue-done-${record.id}`}
            >
              <DoneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      }
    >
      <ListItemText
        primary={
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {record.userDisplayName}
            </Typography>
            <Chip
              size="small"
              label={record.category}
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
            {record.status === '対応中' && (
              <Chip
                size="small"
                label="対応中"
                color="primary"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Stack>
        }
        secondary={
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            component="span"
            sx={{ display: 'block', maxWidth: '70%' }}
          >
            {record.message}
          </Typography>
        }
      />
    </ListItem>
  );
}

// ─── メインコンポーネント ───────────────────────────────────

export function HandoffActionQueue({
  groups,
  onItemClick,
  onMarkDone,
}: HandoffActionQueueProps) {
  if (groups.length === 0) {
    return null; // 要対応なし → 非表示
  }

  const totalCount = groups.reduce((sum, g) => sum + g.records.length, 0);

  return (
    <Card
      variant="outlined"
      sx={{ mb: 2 }}
      data-testid="handoff-action-queue"
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* ヘッダー */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            📋 要対応（残り {totalCount}件）
          </Typography>
        </Stack>

        {/* グループ別リスト */}
        {groups.map((group, groupIdx) => (
          <Box key={group.severity}>
            {/* グループヘッダー */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.75}
              sx={{
                px: 1.5,
                py: 0.5,
                bgcolor: 'grey.50',
                borderRadius: 1,
              }}
            >
              <Typography variant="caption" fontWeight={700}>
                {group.icon} {group.label}
              </Typography>
              <Chip
                size="small"
                label={`${group.records.length}件`}
                color={getSeverityColor(group.severity)}
                sx={{ height: 18, fontSize: '0.65rem' }}
              />
            </Stack>

            {/* レコード行 */}
            <List dense disablePadding>
              {group.records.map((record) => (
                <QueueRow
                  key={record.id}
                  record={record}
                  onItemClick={onItemClick}
                  onMarkDone={onMarkDone}
                />
              ))}
            </List>

            {/* グループ間の区切り線（最後以外） */}
            {groupIdx < groups.length - 1 && (
              <Divider sx={{ my: 0.5 }} />
            )}
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}
