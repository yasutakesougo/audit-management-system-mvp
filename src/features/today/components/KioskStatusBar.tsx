/**
 * KioskStatusBar — キオスクモード専用ステータスバー (v1: 個別指標)
 *
 * Today画面上部に常時表示。本日の進捗セクションと同じ4指標を表示。
 *
 * 表示: 支援記録 0/3  日々の記録 0/32  出席 26/32  連絡 2件
 *
 * 設計原則: 各指標が一目で把握でき、本日の進捗と数値が一致する
 */
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import React from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export type KioskStatusMetrics = {
  /** 支援手順の実施: 完了数 */
  recordCompleted: number;
  /** 支援手順の実施: 全件数 */
  recordTotal: number;
  /** 日々の記録: 完了数 */
  caseCompleted: number;
  /** 日々の記録: 全件数 */
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

/** 指標の色を判定: 完了=success, 未完了あり=warning/error */
function metricColor(completed: number, total: number): 'success' | 'warning' | 'error' | 'default' {
  if (total === 0) return 'default';
  if (completed >= total) return 'success';
  if (completed === 0) return 'error';
  return 'warning';
}

export const KioskStatusBar: React.FC<{ metrics: KioskStatusMetrics }> = ({ metrics }) => {
  const now = useCurrentTime();
  const { isOnline } = useNetworkStatus();

  const timeStr = now.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const chipSx = {
    fontWeight: 700,
    fontSize: '0.82rem',
    height: 32,
    fontVariantNumeric: 'tabular-nums' as const,
  };

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
        borderBottom: '2px solid',
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

      {/* 支援記録 */}
      <Chip
        label={`支援記録 ${metrics.recordCompleted}/${metrics.recordTotal}`}
        size="small"
        color={metricColor(metrics.recordCompleted, metrics.recordTotal)}
        variant="outlined"
        sx={chipSx}
      />

      {/* 日々の記録 */}
      <Chip
        label={`日々の記録 ${metrics.caseCompleted}/${metrics.caseTotal}`}
        size="small"
        color={metricColor(metrics.caseCompleted, metrics.caseTotal)}
        variant="outlined"
        sx={chipSx}
      />

      {/* 出席 */}
      <Chip
        label={`出席 ${metrics.attendeeCount}/${metrics.scheduledCount}`}
        size="small"
        color={metricColor(metrics.attendeeCount, metrics.scheduledCount)}
        variant="outlined"
        sx={chipSx}
      />

      {/* 連絡 */}
      <Chip
        label={`連絡 ${metrics.contactPending}件`}
        size="small"
        color={metrics.contactPending > 0 ? 'warning' : 'default'}
        variant="outlined"
        sx={chipSx}
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
