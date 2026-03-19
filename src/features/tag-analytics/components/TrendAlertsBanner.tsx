/**
 * @fileoverview Phase F2: TrendAlertsBanner — トレンドアラート表示 UI
 * @description
 * detectTagTrends の出力を、コンパクトなバナーで表示する。
 * spike は warning Alert、drop/new は info Chip で表示。
 */
import React from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import FiberNewRoundedIcon from '@mui/icons-material/FiberNewRounded';

import type { TagTrendAlerts, TrendAlert } from '../domain/tagTrendAlerts';

// ─── Props ───────────────────────────────────────────────

type TrendAlertsBannerProps = {
  alerts: TagTrendAlerts;
  /** 最大表示件数（default: 5） */
  maxItems?: number;
};

// ─── Main Component ──────────────────────────────────────

export const TrendAlertsBanner: React.FC<TrendAlertsBannerProps> = ({
  alerts,
  maxItems = 5,
}) => {
  if (!alerts.hasAlerts) return null;

  const displayed = alerts.all.slice(0, maxItems);

  // spike があるかどうかで Alert severity を決定
  const hasSpikes = alerts.spikes.length > 0;

  return (
    <Box data-testid="trend-alerts-banner">
      <Alert
        severity={hasSpikes ? 'warning' : 'info'}
        variant="outlined"
        sx={{ borderRadius: 2, py: 0.5 }}
        icon={false}
      >
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, mb: 0.75 }}
        >
          {hasSpikes ? '⚠️ タグ傾向の変化を検知' : 'ℹ️ タグの動き'}
        </Typography>
        <Stack spacing={0.5}>
          {displayed.map((alert, i) => (
            <TrendAlertItem key={`${alert.tagKey}-${alert.type}-${i}`} alert={alert} />
          ))}
        </Stack>
        {alerts.all.length > maxItems && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 0.5, display: 'block' }}
          >
            他 {alerts.all.length - maxItems} 件
          </Typography>
        )}
      </Alert>
    </Box>
  );
};

// ─── Sub Component ───────────────────────────────────────

const ALERT_ICON: Record<string, React.ReactNode> = {
  spike: <TrendingUpRoundedIcon sx={{ fontSize: 16, color: '#d32f2f' }} />,
  drop: <TrendingDownRoundedIcon sx={{ fontSize: 16, color: '#1976d2' }} />,
  new: <FiberNewRoundedIcon sx={{ fontSize: 16, color: '#ed6c02' }} />,
};

const ALERT_COLORS: Record<string, string> = {
  spike: '#d32f2f',
  drop: '#1976d2',
  new: '#ed6c02',
};

const TrendAlertItem: React.FC<{ alert: TrendAlert }> = ({ alert }) => (
  <Stack
    direction="row"
    alignItems="center"
    spacing={0.75}
    data-testid={`trend-alert-${alert.type}-${alert.tagKey}`}
  >
    {ALERT_ICON[alert.type]}
    <Chip
      label={alert.tagLabel}
      size="small"
      sx={{
        bgcolor: ALERT_COLORS[alert.type],
        color: '#fff',
        fontWeight: 600,
        fontSize: '0.7rem',
        height: 22,
      }}
    />
    <Typography
      variant="caption"
      sx={{
        fontSize: '0.72rem',
        color: 'text.secondary',
      }}
    >
      {alert.type === 'spike' && `+${alert.changeRate}%`}
      {alert.type === 'drop' && `前期間 ${alert.baselineCount}回 → 0`}
      {alert.type === 'new' && `${alert.currentCount}回（初出現）`}
    </Typography>
  </Stack>
);
