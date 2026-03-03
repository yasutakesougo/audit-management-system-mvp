/**
 * DashboardHeaderActions — ヘッダーアクションボタン群
 *
 * 責務:
 * - 「朝会・夕会情報」ボタン
 * - 「お部屋情報」ボタン
 *
 * Presentational コンポーネント。コールバックのみ受け取り、副作用は持たない。
 */

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import React from 'react';

export interface DashboardHeaderActionsProps {
  onOpenBriefing: () => void;
  onNavigateToRoomManagement: () => void;
}

export const DashboardHeaderActions: React.FC<DashboardHeaderActionsProps> = ({
  onOpenBriefing,
  onNavigateToRoomManagement,
}) => (
  <Stack direction="row" spacing={1}>
    <Button
      variant="contained"
      startIcon={<AccessTimeIcon />}
      onClick={onOpenBriefing}
      size="small"
      color="primary"
    >
      朝会・夕会情報
    </Button>
    <Button
      variant="outlined"
      onClick={onNavigateToRoomManagement}
      size="small"
    >
      🏢 お部屋情報
    </Button>
  </Stack>
);
