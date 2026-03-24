/**
 * KioskStatusBar — キオスクモード専用ステータスバー (v2: 行動指標)
 *
 * Today画面上部に常時表示。
 *
 * v1: 支援記録 8/12  ケース記録 0/5  出席 18/20  連絡 2件
 * v2: 残り4件  ⚠️要対応2件  出席18名
 *
 * 設計原則: 「あと何件で終わるか」が一瞬でわかる
 */
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
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

export const KioskStatusBar: React.FC<{ metrics: KioskStatusMetrics }> = ({ metrics }) => {
  const now = useCurrentTime();
  const { isOnline } = useNetworkStatus();

  const timeStr = now.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // ── v2: 行動指標の導出 ──
  const remainingRecords = Math.max(0, metrics.recordTotal - metrics.recordCompleted);
  const remainingCases = Math.max(0, metrics.caseTotal - metrics.caseCompleted);
  const remainingCount = remainingRecords + remainingCases;
  const attentionCount = remainingCount + metrics.contactPending;

  const isDone = remainingCount === 0 && metrics.contactPending === 0;
  const isDanger = attentionCount > 0;

  return (
    <Box
      data-testid="kiosk-status-bar"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: isDanger ? 'error.50' : 'background.paper',
        borderBottom: '2px solid',
        borderColor: isDanger ? 'error.main' : isDone ? 'success.main' : 'divider',
        flexWrap: 'wrap',
        minHeight: 48,
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
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

      {/* 残り件数 */}
      <Chip
        icon={isDone ? <AssignmentTurnedInIcon /> : <ErrorOutlineIcon />}
        label={isDone ? '✅ 全件完了' : `📊 残り${remainingCount}件`}
        size="small"
        color={isDone ? 'success' : remainingCount > 3 ? 'error' : 'warning'}
        variant={isDone ? 'filled' : 'outlined'}
        sx={{
          fontWeight: 700,
          fontSize: '0.85rem',
          height: 34,
          '& .MuiChip-icon': { fontSize: '1.1rem' },
        }}
      />

      {/* 要対応件数（未記録 + 未対応連絡） */}
      {attentionCount > 0 && (
        <Chip
          icon={<WarningAmberIcon />}
          label={`⚠️ 要対応${attentionCount}件`}
          size="small"
          color="error"
          variant="outlined"
          sx={{
            fontWeight: 700,
            fontSize: '0.85rem',
            height: 34,
            '& .MuiChip-icon': { fontSize: '1.1rem' },
            animation: attentionCount > 3 ? 'status-pulse 2s infinite' : 'none',
            '@keyframes status-pulse': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0.6 },
              '100%': { opacity: 1 },
            },
          }}
        />
      )}

      {/* 完了した時のみ表示 */}
      {isDone && (
        <Chip
          icon={<CheckCircleIcon />}
          label="お疲れさまです！"
          size="small"
          color="success"
          variant="filled"
          sx={{
            fontWeight: 700,
            fontSize: '0.8rem',
            height: 34,
          }}
        />
      )}

      {/* 出席実数 */}
      <Chip
        icon={<PeopleAltIcon />}
        label={`出席${metrics.attendeeCount}名`}
        size="small"
        color="default"
        variant="outlined"
        sx={{
          fontWeight: 700,
          fontSize: '0.8rem',
          height: 32,
          '& .MuiChip-icon': { fontSize: '1rem' },
        }}
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
