/**
 * KioskStatusBar — キオスクモード専用ステータスバー
 *
 * Today画面上部に常時表示。1行で業務進捗が把握できる。
 *
 * 表示内容:
 *   - 現在時刻（リアルタイム更新）
 *   - 支援記録 完了/全件
 *   - ケース記録 完了/全件
 *   - 出席数
 *   - 未対応連絡件数
 *   - オンライン/オフライン状態
 */
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import React from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export type KioskStatusMetrics = {
  /** 支援手順記録: 完了数 */
  recordCompleted: number;
  /** 支援手順記録: 全件数 */
  recordTotal: number;
  /** ケース記録: 完了数 */
  caseCompleted: number;
  /** ケース記録: 全件数 */
  caseTotal: number;
  /** 出席者数 */
  attendeeCount: number;
  /** 予定者数 */
  scheduledCount: number;
  /** 未対応連絡件数 */
  contactPending: number;
};

function useCurrentTime() {
  const [time, setTime] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return time;
}

type StatusChipProps = {
  label: string;
  completed: number;
  total: number;
};

function StatusChip({ label, completed, total }: StatusChipProps) {
  const done = completed >= total && total > 0;
  return (
    <Chip
      icon={done ? <CheckCircleIcon /> : <ErrorOutlineIcon />}
      label={`${label} ${completed}/${total}`}
      size="small"
      color={done ? 'success' : completed > 0 ? 'warning' : 'error'}
      variant="outlined"
      sx={{
        fontWeight: 700,
        fontSize: '0.8rem',
        height: 32,
        '& .MuiChip-icon': { fontSize: '1rem' },
      }}
    />
  );
}

export const KioskStatusBar: React.FC<{ metrics: KioskStatusMetrics }> = ({ metrics }) => {
  const now = useCurrentTime();
  const { isOnline } = useNetworkStatus();

  const timeStr = now.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Box
      data-testid="kiosk-status-bar"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexWrap: 'wrap',
        minHeight: 48,
      }}
    >
      {/* 現在時刻 */}
      <Typography
        variant="h6"
        sx={{
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          mr: 1,
          fontSize: '1.1rem',
        }}
      >
        🕐 {timeStr}
      </Typography>

      {/* 業務指標 */}
      <StatusChip label="支援記録" completed={metrics.recordCompleted} total={metrics.recordTotal} />
      <StatusChip label="ケース記録" completed={metrics.caseCompleted} total={metrics.caseTotal} />
      <StatusChip label="出席" completed={metrics.attendeeCount} total={metrics.scheduledCount} />

      {/* 連絡 */}
      <Chip
        label={`連絡 ${metrics.contactPending}件`}
        size="small"
        color={metrics.contactPending === 0 ? 'success' : 'warning'}
        variant="outlined"
        sx={{ fontWeight: 700, fontSize: '0.8rem', height: 32 }}
      />

      {/* スペーサー */}
      <Box sx={{ flex: 1 }} />

      {/* ネットワーク状態 */}
      <Chip
        icon={isOnline ? <WifiIcon /> : <WifiOffIcon />}
        label={isOnline ? 'オンライン' : 'オフライン'}
        size="small"
        color={isOnline ? 'default' : 'error'}
        variant={isOnline ? 'outlined' : 'filled'}
        sx={{
          fontWeight: 600,
          fontSize: '0.75rem',
          height: 28,
          '& .MuiChip-icon': { fontSize: '0.9rem' },
        }}
      />
    </Box>
  );
};
