/**
 * Staff Status Tab (職員タブ)
 * 
 * 目的：職員の出勤状況と「フリー」状態を可視化
 * 
 * Phase B 統合：
 * - staffAvailability（4段階判定）を活用
 * - 🟢 free: 完全フリー、ヘルプ可能
 * - 🟡 partial: 30分以内に予定あり
 * - 🟠 busy: サポート役として稼働中
 * - ⚫ occupied: メイン担当中、対応不可
 * 
 * 表示内容：
 * - 出勤職員一覧（フリー状態付き）
 * - 欠席・遅刻職員リスト
 * - 次にフリーになる時間表示
 */

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningIcon from '@mui/icons-material/Warning';
import BlockIcon from '@mui/icons-material/Block';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import type { StaffAvailability, StaffAvailabilityStatus } from '@/features/dashboard/staffAvailability';
import { StaffDetailDialog } from '@/features/dashboard/dialogs/StaffDetailDialog';

export interface StaffStatusTabProps {
  /** 職員のフリー状態情報（Phase B） */
  staffAvailability: StaffAvailability[];
  /** 欠席職員リスト */
  absentStaff: Array<{
    id: string;
    name: string;
    reason?: string;
  }>;
  /** 遅刻・勤務調整職員リスト */
  lateOrAdjustStaff: Array<{
    id: string;
    name: string;
  }>;
}

/**
 * 職員状態の設定（色、アイコン、ラベル）
 */
const STATUS_CONFIG: Record<StaffAvailabilityStatus, {
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}> = {
  free: {
    color: 'success.main',
    bgColor: 'success.lighter',
    icon: <CheckCircleIcon />,
    label: 'フリー',
    description: '完全フリー、ヘルプ対応可能',
  },
  partial: {
    color: 'warning.main',
    bgColor: 'warning.lighter',
    icon: <ScheduleIcon />,
    label: '部分フリー',
    description: '30分以内に予定あり',
  },
  busy: {
    color: 'orange',
    bgColor: '#fff3e0',
    icon: <WarningIcon />,
    label: '多忙',
    description: 'サポート役として稼働中',
  },
  occupied: {
    color: 'grey.600',
    bgColor: 'grey.100',
    icon: <BlockIcon />,
    label: '対応中',
    description: 'メイン担当中、対応不可',
  },
};

/**
 * 職員状況タブコンテンツ
 * Phase B の staffAvailability を活用した「誰がフリーか」の可視化
 * Phase C-2: クリックで詳細モーダル表示
 */
export const StaffStatusTab: React.FC<StaffStatusTabProps> = ({
  staffAvailability,
  absentStaff,
  lateOrAdjustStaff,
}) => {
  // フリー職員数をカウント
  const freeStaffCount = staffAvailability.filter(s => s.status === 'free').length;
  const partialFreeCount = staffAvailability.filter(s => s.status === 'partial').length;

  // ✨ Phase C-2: モーダル制御
  const [selectedStaff, setSelectedStaff] = useState<StaffAvailability | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleStaffClick = (staff: StaffAvailability) => {
    setSelectedStaff(staff);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  return (
    <Box>
      {/* サマリー */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          🧑‍💼 職員状況サマリー
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip label={`フリー: ${freeStaffCount}名`} color="success" size="small" />
          <Chip label={`部分フリー: ${partialFreeCount}名`} color="warning" size="small" />
          <Chip label={`欠席: ${absentStaff.length}名`} color="error" size="small" />
        </Stack>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* 出勤職員のフリー状態 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>
          出勤職員のフリー状態 ({staffAvailability.length}名)
        </Typography>
        <Stack spacing={1}>
          {staffAvailability.map((staff) => {
            const config = STATUS_CONFIG[staff.status];
            return (
              <Card
                key={staff.staffId}
                variant="outlined"
                sx={{
                  borderLeft: `4px solid`,
                  borderLeftColor: config.color,
                  bgcolor: config.bgColor,
                  '&:hover': {
                    boxShadow: 2,
                    cursor: 'pointer',
                    transform: 'translateY(-2px)',
                    transition: 'all 0.2s ease',
                  },
                }}
                onClick={() => handleStaffClick(staff)}  // ✨ クリックイベント追加
              >
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ color: config.color }}>{config.icon}</Box>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', flexGrow: 1 }}>
                      {staff.staffName}
                    </Typography>
                    <Chip size="small" label={config.label} sx={{ bgcolor: 'background.paper' }} />
                  </Stack>

                  {/* 現在の担当 */}
                  {staff.currentAssignment && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      → {staff.currentAssignment.userName} の
                      {staff.currentAssignment.role === 'main' ? 'メイン' : 'サポート'}担当
                    </Typography>
                  )}

                  {/* 次のフリー時間 */}
                  {staff.nextFreeTime && staff.status !== 'free' && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      次のフリー: {staff.nextFreeTime}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* 欠席職員リスト */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonOffIcon color="error" />
          欠席職員 ({absentStaff.length}名)
        </Typography>
        {absentStaff.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
            本日の欠席職員はいません
          </Typography>
        ) : (
          <List dense>
            {absentStaff.map((staff) => (
              <ListItem
                key={staff.id}
                sx={{
                  bgcolor: 'error.lighter',
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <ListItemIcon>
                  <PersonOffIcon color="error" />
                </ListItemIcon>
                <ListItemText
                  primary={staff.name}
                  secondary={staff.reason || '理由未記入'}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* 遅刻・勤務調整職員 */}
      {lateOrAdjustStaff.length > 0 && (
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>
            遅刻・勤務調整 ({lateOrAdjustStaff.length}名)
          </Typography>
          <List dense>
            {lateOrAdjustStaff.map((staff) => (
              <ListItem
                key={staff.id}
                sx={{
                  bgcolor: 'warning.lighter',
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <ListItemText primary={staff.name} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* ✨ Phase C-2: 職員詳細モーダル */}
      <StaffDetailDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        staff={selectedStaff}
      />
    </Box>
  );
};
