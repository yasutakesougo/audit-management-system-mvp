// ---------------------------------------------------------------------------
// ProactiveAlertBanner — 行動データドリブンのプロアクティブ 支援計画シート アラートバナー
//
// IBDHubPage のステータスグリッド上部に配置し、urgent / watch レベルの
// アラートを MUI Alert で表示する。Snooze 機能付き。
// ---------------------------------------------------------------------------
import CloseIcon from '@mui/icons-material/Close';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback, useState } from 'react';

import type { ProactiveAlert } from '../proactiveSPSAlerts';

// ---------------------------------------------------------------------------
// Snooze Logic
// ---------------------------------------------------------------------------

const SNOOZE_STORAGE_KEY = 'proactive-sps-alert-snooze';
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

function isSnoozed(): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_STORAGE_KEY);
    if (!raw) return false;
    const snoozeUntil = Number(raw);
    return Date.now() < snoozeUntil;
  } catch {
    return false;
  }
}

function setSnooze(): void {
  localStorage.setItem(SNOOZE_STORAGE_KEY, String(Date.now() + SNOOZE_DURATION_MS));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProactiveAlertBannerProps {
  alerts: ProactiveAlert[];
  /** ユーザー選択時のコールバック（個別支援画面への遷移など） */
  onSelectUser?: (userId: string) => void;
}

export function ProactiveAlertBanner({ alerts, onSelectUser }: ProactiveAlertBannerProps) {
  const [dismissed, setDismissed] = useState(isSnoozed);

  const handleDismiss = useCallback(() => {
    setSnooze();
    setDismissed(true);
  }, []);

  if (alerts.length === 0 || dismissed) return null;

  const urgentAlerts = alerts.filter((a) => a.level === 'urgent');
  const watchAlerts = alerts.filter((a) => a.level === 'watch');
  const severity = urgentAlerts.length > 0 ? 'error' : 'warning';

  return (
    <Collapse in={!dismissed}>
      <Alert
        severity={severity}
        icon={severity === 'error' ? <WarningAmberIcon /> : <NotificationsActiveIcon />}
        action={
          <Tooltip title="24時間非表示にする">
            <IconButton
              color="inherit"
              size="small"
              onClick={handleDismiss}
              aria-label="アラートを一時非表示"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        }
        sx={{
          mb: 3,
          borderRadius: 2,
          '& .MuiAlert-message': { width: '100%' },
        }}
        data-testid="proactive-alert-banner"
      >
        <AlertTitle sx={{ fontWeight: 700 }}>
          {severity === 'error'
            ? `🔴 支援計画シート前倒し改訂の推奨（${urgentAlerts.length}名）`
            : `🟠 行動事象の増加傾向を検出（${watchAlerts.length}名）`}
        </AlertTitle>

        <Stack spacing={1} sx={{ mt: 1 }}>
          {/* Urgent alerts */}
          {urgentAlerts.map((alert) => (
            <AlertItem key={alert.userId} alert={alert} onSelect={onSelectUser} />
          ))}

          {/* Watch alerts */}
          {watchAlerts.map((alert) => (
            <AlertItem key={alert.userId} alert={alert} onSelect={onSelectUser} />
          ))}
        </Stack>
      </Alert>
    </Collapse>
  );
}

// ---------------------------------------------------------------------------
// Alert Item
// ---------------------------------------------------------------------------

function AlertItem({
  alert,
  onSelect,
}: {
  alert: ProactiveAlert;
  onSelect?: (userId: string) => void;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 0.5,
        cursor: onSelect ? 'pointer' : 'default',
        '&:hover': onSelect ? { bgcolor: 'action.hover', borderRadius: 1 } : {},
        px: 1,
        mx: -1,
      }}
      onClick={onSelect ? () => onSelect(alert.userId) : undefined}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      data-testid={`proactive-alert-item-${alert.userId}`}
    >
      <Chip
        label={alert.level === 'urgent' ? '緊急' : '注意'}
        color={alert.level === 'urgent' ? 'error' : 'warning'}
        size="small"
        variant="filled"
        sx={{ fontWeight: 600, minWidth: 48 }}
      />
      <Typography variant="body2" sx={{ flex: 1 }}>
        <strong>{alert.userName}</strong>
        {' — '}
        直近7日で{alert.incidentCount}件の事象
        {alert.highIntensityCount > 0 && `（高強度${alert.highIntensityCount}件）`}
      </Typography>
      {alert.daysUntilSPSReview !== null && (
        <Chip
          label={`支援計画シート ${alert.daysUntilSPSReview > 0 ? `残${alert.daysUntilSPSReview}日` : '期限超過'}`}
          size="small"
          variant="outlined"
          color={alert.daysUntilSPSReview <= 0 ? 'error' : 'default'}
          sx={{ fontSize: '0.75rem' }}
        />
      )}
    </Box>
  );
}
