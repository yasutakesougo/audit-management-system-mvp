/**
 * DashboardHeaderActions — ヘッダーアクションボタン群
 *
 * 責務:
 * - 「朝会・夕会情報」ボタン
 * - 「予定」ボタン（スケジュール機能が有効時のみ）
 * - 「お部屋情報」ボタン
 *
 * Presentational コンポーネント。コールバックのみ受け取り、副作用は持たない。
 */

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import React from 'react';

export interface DashboardHeaderActionsProps {
  onOpenBriefing: () => void;
  onNavigateToRoomManagement: () => void;
  onNavigateToSchedule?: () => void;
  schedulesEnabled?: boolean;
}

const actionBtnSx = {
  fontSize: '0.72rem',
  px: 1.25,
  py: 0.4,
  minHeight: 28,
  whiteSpace: 'nowrap',
  borderRadius: 1.5,
  textTransform: 'none',
} as const;

export const DashboardHeaderActions: React.FC<DashboardHeaderActionsProps> = ({
  onOpenBriefing,
  onNavigateToRoomManagement,
  onNavigateToSchedule,
  schedulesEnabled = false,
}) => (
  <Stack direction="row" spacing={0.75} alignItems="center">
    <Button
      variant="outlined"
      startIcon={<AccessTimeIcon sx={{ fontSize: '14px !important' }} />}
      onClick={onOpenBriefing}
      size="small"
      color="primary"
      sx={actionBtnSx}
    >
      朝会・夕会情報
    </Button>
    {schedulesEnabled && onNavigateToSchedule && (
      <Button
        variant="outlined"
        startIcon={<CalendarMonthIcon sx={{ fontSize: '14px !important' }} />}
        onClick={onNavigateToSchedule}
        size="small"
        color="info"
        sx={actionBtnSx}
      >
        予定
      </Button>
    )}
    <Button
      variant="outlined"
      onClick={onNavigateToRoomManagement}
      size="small"
      sx={actionBtnSx}
    >
      お部屋情報
    </Button>
  </Stack>
);
