/**
 * RecordActionQueue — 未完了レコードのキュー表示
 *
 * Hero（次に書く1件）の下に配置し、残りの未完了レコードを一覧表示する。
 * 完了済みは折りたたみで初期非表示。
 *
 * 設計判断:
 * - Hero 表示分は除外済み（classifyQueueRecords が担当）
 * - CTA 文言は状態に合わせる: 未作成→「記録する」, 作成中→「続ける」
 * - 完了済みセクションはデフォルト閉じ
 */

import type { PersonDaily } from '@/domain/daily/types';
import { classifyQueueRecords } from '../../domain/legacy/classifyQueueRecords';
import { resolveHeroRecord } from '../../domain/legacy/resolveHeroRecord';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useMemo } from 'react';

// ─── Props ──────────────────────────────────────────────────────

export type RecordActionQueueProps = {
  /** 今日の全レコード（日付フィルタ済み） */
  todayRecords: readonly PersonDaily[];
  /** レコードの入力開始/再開コールバック */
  onStartRecord: (record: PersonDaily) => void;
  /** 完了済みアコーディオンの展開/閉じコールバック（テレメトリ用, 任意） */
  onCompletedToggle?: (expanded: boolean) => void;
};

// ─── Sub-components ─────────────────────────────────────────────

const QueueItem: React.FC<{
  record: PersonDaily;
  onStartRecord: (record: PersonDaily) => void;
}> = ({ record, onStartRecord }) => {
  const isResume = record.status === '作成中';

  return (
    <ListItem
      data-testid={`queue-item-${record.userId}`}
      sx={{
        py: 1,
        px: 1.5,
        borderRadius: 1,
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
      secondaryAction={
        <Button
          size="small"
          variant={isResume ? 'contained' : 'outlined'}
          color={isResume ? 'warning' : 'primary'}
          startIcon={isResume ? <EditNoteIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          onClick={() => onStartRecord(record)}
          data-testid={`queue-cta-${record.userId}`}
          sx={{ minWidth: 90, fontWeight: 600 }}
        >
          {isResume ? '続ける' : '記録する'}
        </Button>
      }
    >
      <ListItemText
        primary={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {record.userName}
            </Typography>
            <Chip
              label={record.status}
              size="small"
              color={isResume ? 'warning' : 'default'}
              variant={isResume ? 'filled' : 'outlined'}
              sx={{ fontSize: '0.65rem', height: 20 }}
            />
          </Stack>
        }
      />
    </ListItem>
  );
};

const CompletedItem: React.FC<{ record: PersonDaily }> = ({ record }) => (
  <ListItem sx={{ py: 0.5, px: 1.5, opacity: 0.7 }}>
    <ListItemText
      primary={
        <Stack direction="row" spacing={1} alignItems="center">
          <CheckCircleOutlineIcon
            color="success"
            sx={{ fontSize: 16 }}
          />
          <Typography variant="body2" color="text.secondary">
            {record.userName}
          </Typography>
          <Chip
            label="完了"
            size="small"
            color="success"
            variant="outlined"
            sx={{ fontSize: '0.6rem', height: 18 }}
          />
        </Stack>
      }
    />
  </ListItem>
);

// ─── Main Component ─────────────────────────────────────────────

export const RecordActionQueue: React.FC<RecordActionQueueProps> = ({
  todayRecords,
  onStartRecord,
  onCompletedToggle,
}) => {
  const theme = useTheme();

  // Hero レコードの ID を取得して除外
  const heroState = useMemo(() => resolveHeroRecord(todayRecords), [todayRecords]);
  const heroRecordId = heroState.kind === 'next' ? heroState.record.id : null;

  const { incomplete, completed, incompleteCount, completedCount } = useMemo(
    () => classifyQueueRecords(todayRecords, heroRecordId),
    [todayRecords, heroRecordId],
  );

  // Hero もなく Queue もない → 表示なし
  if (todayRecords.length === 0) return null;

  // 全件完了かつ Queue が空 → 表示なし（Hero が完了メッセージを担当）
  if (incompleteCount === 0 && heroState.kind === 'allCompleted') return null;

  return (
    <Paper
      data-testid="record-action-queue"
      variant="outlined"
      sx={{
        mb: 3,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* ── ヘッダー ── */}
      {incompleteCount > 0 && (
        <>
          <Box
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                📋 未完了の記録
              </Typography>
              <Chip
                label={`残り ${incompleteCount} 件`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            </Stack>
          </Box>

          {/* ── 未完了リスト ── */}
          <List dense disablePadding data-testid="queue-incomplete-list">
            {incomplete.map((record, index) => (
              <React.Fragment key={record.id}>
                {index > 0 && <Divider component="li" />}
                <QueueItem record={record} onStartRecord={onStartRecord} />
              </React.Fragment>
            ))}
          </List>
        </>
      )}

      {/* ── 完了済み（折りたたみ） ── */}
      {completedCount > 0 && (
        <Accordion
          disableGutters
          elevation={0}
          defaultExpanded={false}
          data-testid="queue-completed-section"
          onChange={(_event, expanded) => onCompletedToggle?.(expanded)}
          sx={{
            '&::before': { display: 'none' },
            borderTop: incompleteCount > 0 ? '1px solid' : 'none',
            borderColor: 'divider',
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              minHeight: 40,
              px: 2,
              '& .MuiAccordionSummary-content': { my: 0.5 },
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <CheckCircleOutlineIcon color="success" sx={{ fontSize: 18 }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                完了済み ({completedCount} 件)
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <List dense disablePadding data-testid="queue-completed-list">
              {completed.map((record) => (
                <CompletedItem key={record.id} record={record} />
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      )}
    </Paper>
  );
};
