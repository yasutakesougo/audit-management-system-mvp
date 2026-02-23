/**
 * Staff Detail Dialog (Phase C-2)
 * 
 * 目的：職員の詳細情報をモーダルで表示
 * 
 * 表示内容：
 * - 職員の基本情報（名前、ステータス）
 * - 今日のタイムライン（ガントチャート風）
 * - フリー時間帯の可視化
 * - 現在の担当と次の予定
 * - 緊急連絡先（オプション）
 * 
 * データソース：
 * - StaffAvailability（Phase B で計算済み）
 * - scheduleLanesToday.staffLane（詳細スケジュール）
 */

import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningIcon from '@mui/icons-material/Warning';
import BlockIcon from '@mui/icons-material/Block';
import type { StaffAvailability, StaffAvailabilityStatus, TimeSlot } from '@/features/dashboard/staffAvailability';

export interface StaffDetailDialogProps {
  /** モーダルの開閉状態 */
  open: boolean;
  /** 閉じる時のコールバック */
  onClose: () => void;
  /** 表示する職員の詳細情報 */
  staff: StaffAvailability | null;
}

/**
 * 職員状態の設定（色、アイコン、ラベル）
 */
const STATUS_CONFIG: Record<StaffAvailabilityStatus, {
  color: string;
  icon: React.ReactElement;
  label: string;
  description: string;
}> = {
  free: {
    color: 'success.main',
    icon: <CheckCircleIcon />,
    label: 'フリー',
    description: '完全フリー、ヘルプ対応可能',
  },
  partial: {
    color: 'warning.main',
    icon: <ScheduleIcon />,
    label: '部分フリー',
    description: '30分以内に予定あり',
  },
  busy: {
    color: 'orange',
    icon: <WarningIcon />,
    label: '多忙',
    description: 'サポート役として稼働中',
  },
  occupied: {
    color: 'grey.600',
    icon: <BlockIcon />,
    label: '対応中',
    description: 'メイン担当中、対応不可',
  },
};

/**
 * タイムラインバーコンポーネント
 * 営業時間（8:00-18:00）を100%として、フリースロットを可視化
 */
const TimelineBar: React.FC<{ freeSlots: TimeSlot[] }> = ({ freeSlots }) => {
  const WORK_START = 8 * 60; // 8:00 = 480分
  const WORK_END = 18 * 60;  // 18:00 = 1080分
  const TOTAL_MINUTES = WORK_END - WORK_START; // 600分

  // "HH:MM" を分に変換
  const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  return (
    <Box sx={{ position: 'relative', height: 40, bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden' }}>
      {/* 背景グリッド（時間の目安） */}
      {[9, 12, 15].map((hour) => {
        const left = ((hour * 60 - WORK_START) / TOTAL_MINUTES) * 100;
        return (
          <Box
            key={hour}
            sx={{
              position: 'absolute',
              left: `${left}%`,
              top: 0,
              height: '100%',
              width: 1,
              bgcolor: 'grey.400',
              opacity: 0.5,
            }}
          />
        );
      })}

      {/* フリースロットを緑色で表示 */}
      {freeSlots.map((slot, index) => {
        const startMinutes = timeToMinutes(slot.start);
        const endMinutes = timeToMinutes(slot.end);
        const left = ((startMinutes - WORK_START) / TOTAL_MINUTES) * 100;
        const width = ((endMinutes - startMinutes) / TOTAL_MINUTES) * 100;

        return (
          <Box
            key={index}
            sx={{
              position: 'absolute',
              left: `${left}%`,
              width: `${width}%`,
              height: '100%',
              bgcolor: 'success.light',
              opacity: 0.8,
              border: '1px solid',
              borderColor: 'success.main',
            }}
          />
        );
      })}

      {/* 時間ラベル */}
      <Stack
        direction="row"
        justifyContent="space-between"
        sx={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: '100%', px: 1 }}
      >
        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'grey.700' }}>
          8:00
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'grey.700' }}>
          12:00
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'grey.700' }}>
          18:00
        </Typography>
      </Stack>
    </Box>
  );
};

/**
 * 職員詳細ダイアログ
 * Phase B の staffAvailability データを活用した詳細表示
 */
export const StaffDetailDialog: React.FC<StaffDetailDialogProps> = ({
  open,
  onClose,
  staff,
}) => {
  if (!staff) return null;

  const config = STATUS_CONFIG[staff.status];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ bgcolor: config.color, width: 48, height: 48 }}>
            {staff.staffName[0]}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">{staff.staffName}</Typography>
            <Typography variant="caption" color="text.secondary">
              職員ID: {staff.staffId}
            </Typography>
          </Box>
          <Chip
            icon={config.icon}
            label={config.label}
            sx={{ bgcolor: config.color, color: 'white' }}
          />
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* ステータス説明 */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              {config.description}
            </Typography>
          </Box>

          <Divider />

          {/* タイムライン */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
              📅 本日のタイムライン（8:00 - 18:00）
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              緑色の部分がフリー時間です
            </Typography>
            <TimelineBar freeSlots={staff.freeSlots} />
          </Box>

          <Divider />

          {/* 現在の状況 */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
              🔄 現在の状況
            </Typography>
            {staff.currentAssignment ? (
              <Box sx={{ bgcolor: 'info.lighter', p: 2, borderRadius: 1 }}>
                <Typography variant="body2">
                  <strong>{staff.currentAssignment.userName}様</strong>の
                  {staff.currentAssignment.role === 'main' ? 'メイン担当' : 'サポート'}として対応中
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {staff.currentAssignment.startTime} - {staff.currentAssignment.endTime}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                現在、担当はありません
              </Typography>
            )}
          </Box>

          {/* 次にフリーになる時間 */}
          {staff.nextFreeTime && staff.status !== 'free' && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                  ⏰ 次のフリー時間
                </Typography>
                <Chip
                  label={`${staff.nextFreeTime} から対応可能`}
                  color="success"
                  variant="outlined"
                />
              </Box>
            </>
          )}

          {/* フリー時間帯のリスト */}
          {staff.freeSlots.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                  🟢 フリー時間帯
                </Typography>
                <List dense>
                  {staff.freeSlots.map((slot, index) => (
                    <ListItem key={index} sx={{ bgcolor: 'success.lighter', borderRadius: 1, mb: 0.5 }}>
                      <ListItemText
                        primary={`${slot.start} - ${slot.end}`}
                        secondary="ヘルプ対応可能"
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};
