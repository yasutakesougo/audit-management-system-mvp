/**
 * 今日の申し送りタイムライン表示
 *
 * 時系列で申し送り一覧を表示
 * 状態変更・詳細表示などの操作も提供
 * v4: コメント（返信）+ 更新履歴タブ
 *
 * HandoffItem は components/HandoffItem.tsx に抽出済み。
 * このファイルは一覧の統計・ローディング・空状態を管理する薄いオーケストレータ。
 */

import { TESTIDS, tid } from '@/testids';
import {
    Alert,
    Box,
    Chip,
    CircularProgress,
    Stack,
    Typography,
} from '@mui/material';
import React, { useEffect, useMemo } from 'react';
import { HandoffItem } from './components/HandoffItem';
import type { HandoffDayScope, HandoffRecord, HandoffStatus, MeetingMode } from './handoffTypes';
import type { WorkflowActions } from './useHandoffTimelineViewModel';

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────

export type HandoffStats = {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
};

type TodayHandoffTimelineListProps = {
  /** v3: Page から注入されたデータ (リフト済み) */
  items: HandoffRecord[];
  loading: boolean;
  error: string | null;
  updateHandoffStatus: (id: number, newStatus: HandoffStatus, carryOverDate?: string) => Promise<void>;
  dayScope?: HandoffDayScope;
  onStatsChange?: (stats: HandoffStats | null) => void;
  maxItems?: number;
  /** v3: 会議モード */
  meetingMode?: MeetingMode;
  /** v3: ワークフローアクション */
  workflowActions?: WorkflowActions;
};

// ────────────────────────────────────────────────────────────
// コンポーネント
// ────────────────────────────────────────────────────────────

export const TodayHandoffTimelineList: React.FC<TodayHandoffTimelineListProps> = ({
  items,
  loading,
  error,
  updateHandoffStatus,
  dayScope = 'today',
  onStatsChange,
  maxItems,
  meetingMode = 'normal',
  workflowActions,
}) => {
  const safeHandoffs = Array.isArray(items) ? items : [];

  const stats: HandoffStats = useMemo(() => {
    const total = safeHandoffs.length;
    const completed = safeHandoffs.filter(item => item.status === '対応済').length;
    const inProgress = safeHandoffs.filter(item => item.status === '対応中').length;
    const pending = safeHandoffs.filter(item => item.status === '未対応').length;

    return { total, completed, inProgress, pending };
  }, [safeHandoffs]);

  const visibleHandoffs = useMemo(() => {
    if (typeof maxItems !== 'number') return safeHandoffs;
    return safeHandoffs.slice(0, Math.max(0, maxItems));
  }, [safeHandoffs, maxItems]);

  useEffect(() => {
    if (!onStatsChange) {
      return;
    }
    if (loading || error) {
      onStatsChange(null);
      return;
    }
    onStatsChange(stats);
  }, [loading, error, stats, onStatsChange]);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 4 }}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          申し送りデータを読み込み中...
        </Typography>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        <Typography variant="subtitle2">データ読み込みエラー</Typography>
        <Typography variant="body2">{error}</Typography>
      </Alert>
    );
  }

  if (!safeHandoffs.length) {
    const emptyMessage = dayScope === 'yesterday'
      ? '📝 昨日の申し送りはありません'
      : '📝 本日の申し送りはまだありません';

    const subMessage = dayScope === 'yesterday'
      ? '前日からの引き継ぎ事項がない場合は問題ありません'
      : '上の「今すぐ申し送り」から気軽に記録してみてください';

    return (
      <Box sx={{
        py: 4,
        px: 2,
        textAlign: 'center',
        bgcolor: 'grey.50',
        borderRadius: 1,
        border: '1px dashed',
        borderColor: 'grey.300'
      }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          {emptyMessage}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subMessage}
        </Typography>
      </Box>
    );
  }

  const statsLabel = dayScope === 'yesterday' ? '昨日の申し送り状況' : '本日の申し送り状況';

  return (
    <Stack spacing={2}>
      {/* 統計サマリー */}
      <Box sx={{
        p: 2,
        bgcolor: 'primary.50',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'primary.200'
      }}>
        <Stack direction="row" spacing={3} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            📊 {statsLabel}
          </Typography>
          <Typography variant="body2">
            全{stats.total}件
          </Typography>
          {stats.pending > 0 && (
            <Chip
              size="small"
              label={`未対応 ${stats.pending}件`}
              color="default"
            />
          )}
          {stats.inProgress > 0 && (
            <Chip
              size="small"
              label={`対応中 ${stats.inProgress}件`}
              color="warning"
            />
          )}
          {stats.completed > 0 && (
            <Chip
              size="small"
              label={`対応済 ${stats.completed}件`}
              color="success"
            />
          )}
        </Stack>
      </Box>

      {/* 申し送り一覧 */}
      <Stack spacing={1.5} {...tid(TESTIDS['agenda-timeline-list'])}>
        {visibleHandoffs.map(item => (
          <HandoffItem
            key={item.id}
            item={item}
            onStatusChange={updateHandoffStatus}
            meetingMode={meetingMode}
            workflowActions={workflowActions}
          />
        ))}
      </Stack>
    </Stack>
  );
};
