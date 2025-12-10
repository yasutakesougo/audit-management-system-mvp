/**
 * MeetingGuideDrawer 用ミニ申し送りサマリー（Option A）
 *
 * 朝会 Drawer → 昨日の申し送り状況をひと目で表示
 * 夕会 Drawer → 今日の申し送り状況をひと目で表示
 *
 * 現場価値：
 * - ボタンを押さなくても未対応件数が分かる
 * - 重要案件の見落とし防止
 * - Drawerだけで会議前の状況把握完了
 */

import {
    CheckCircle as CheckCircleIcon,
    ErrorOutline as ErrorOutlineIcon,
    Schedule as ScheduleIcon,
} from '@mui/icons-material';
import {
    Box,
    Chip,
    Skeleton,
    Stack,
    Typography,
} from '@mui/material';
import React from 'react';
import type { MeetingKind } from '../meeting/meetingSteps';
import { useHandoffSummary } from './useHandoffSummary';

export type HandoffMiniSummaryForDrawerProps = {
  kind: MeetingKind;
};

/**
 * MeetingGuideDrawer 内で申し送り状況をひと目で表示
 */
export const HandoffMiniSummaryForDrawer: React.FC<HandoffMiniSummaryForDrawerProps> = ({
  kind
}) => {
  const dayScope = kind === 'morning' ? 'yesterday' : 'today';
  const { total, byStatus, criticalCount } = useHandoffSummary({ dayScope });

  // ローディング状態は簡易表示
  const isLoading = false; // useHandoffSummaryは同期処理のためローディングなし

  if (isLoading) {
    return (
      <Box sx={{ py: 1 }}>
        <Skeleton variant="text" width={120} height={20} />
        <Skeleton variant="text" width={200} height={24} />
      </Box>
    );
  }

  // 申し送りがない場合
  if (total === 0) {
    return (
      <Box sx={{
        py: 1.5,
        px: 2,
        bgcolor: 'grey.50',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'grey.200',
      }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
          📨 {dayScope === 'yesterday' ? '昨日の申し送りはありません' : '今日の申し送りはまだありません'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {dayScope === 'yesterday'
            ? '前日からの引き継ぎ事項がない場合は問題ありません'
            : '必要に応じて申し送りを記録してください'
          }
        </Typography>
      </Box>
    );
  }

  // アクティブな案件（未対応+対応中）
  const activeCount = byStatus['未対応'] + byStatus['対応中'];

  return (
    <Box sx={{
      py: 1.5,
      px: 2,
      bgcolor: activeCount > 0 || criticalCount > 0 ? 'warning.50' : 'success.50',
      borderRadius: 1,
      border: '1px solid',
      borderColor: activeCount > 0 || criticalCount > 0 ? 'warning.200' : 'success.200',
    }}>
      <Stack spacing={1}>
        {/* タイトル */}
        <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
          📨 {dayScope === 'yesterday' ? '昨日の申し送り' : '今日の申し送り'}
        </Typography>

        {/* 状況チップ */}
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {/* 未対応があれば最優先表示 */}
          {byStatus['未対応'] > 0 && (
            <Chip
              size="small"
              icon={<ErrorOutlineIcon />}
              label={`未対応 ${byStatus['未対応']}件`}
              color="error"
              variant="filled"
              sx={{ fontSize: '0.75rem' }}
            />
          )}

          {/* 対応中 */}
          {byStatus['対応中'] > 0 && (
            <Chip
              size="small"
              icon={<ScheduleIcon />}
              label={`対応中 ${byStatus['対応中']}件`}
              color="warning"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          )}

          {/* 対応済（完了が多い場合は表示） */}
          {byStatus['対応済'] > 0 && activeCount === 0 && (
            <Chip
              size="small"
              icon={<CheckCircleIcon />}
              label={`対応済 ${byStatus['対応済']}件`}
              color="success"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          )}

          {/* 重要案件（未完了） */}
          {criticalCount > 0 && (
            <Chip
              size="small"
              label={`🚨 重要 ${criticalCount}件`}
              color="error"
              variant="filled"
              sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}
            />
          )}
        </Stack>

        {/* 補足メッセージ */}
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          {activeCount > 0
            ? `詳細確認をお勧めします（全${total}件中${activeCount}件が未完了）`
            : `すべて対応済みです（全${total}件）`
          }
        </Typography>
      </Stack>
    </Box>
  );
};