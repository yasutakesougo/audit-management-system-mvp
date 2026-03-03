/**
 * Dashboard Briefing HUD (Head-Up Display)
 *
 * 朝会・夕会の時間帯に表示される「情報の入り口」
 *
 * 責務：
 * - BriefingAlert の視覚的な表現
 * - セクションへのナビゲーション
 * - 時間帯に応じた視覚的変化
 *
 * Features:
 * - アラートの重要度別色分け（error/warning/info）
 * - 件数バッジ
 * - クリック時のセクションジャンプ
 */

import type { BriefingAlert } from '@/features/dashboard/sections/types';
import ErrorIcon from '@mui/icons-material/Error';
import EventIcon from '@mui/icons-material/Event';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import { Alert, Box, Chip, Stack, Typography, useTheme } from '@mui/material';
import React from 'react';

export type DashboardBriefingHUDProps = {
  alerts: BriefingAlert[];
  isBriefingTime: boolean;
  briefingType?: 'morning' | 'evening';
  onNavigateTo: (anchorId: string) => void;
};

/**
 * アラート種別ごとのアイコン
 */
const getAlertIcon = (type: BriefingAlert['type']) => {
  switch (type) {
    case 'absent':
      return <ErrorIcon />;
    case 'late':
      return <WarningIcon />;
    case 'urgent_handover':
      return <WarningIcon />;
    case 'critical_safety':
      return <ErrorIcon />;
    case 'health_concern':
      return <InfoIcon />;
    case 'fever_alert':
      return <ErrorIcon />;
    case 'evening_followup':
      return <WarningIcon />;
    default:
      return <InfoIcon />;
  }
};

/**
 * アラート種別ごとのラベル（日本語）
 */
const getAlertTypeLabel = (type: BriefingAlert['type']): string => {
  const labels: Record<BriefingAlert['type'], string> = {
    absent: '欠席',
    late: '遅刻・早退',
    urgent_handover: '重要申し送り',
    critical_safety: '安全アラート',
    health_concern: 'ケア要注視',
    fever_alert: '発熱',
    evening_followup: '夕方フォロー未完了',
  };
  return labels[type] ?? 'その他';
};

/**
 * 色解析：severity → Chip color prop
 */
const getSeverityColor = (severity: BriefingAlert['severity']): 'error' | 'warning' | 'info' | 'default' => {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'default';
  }
};

/**
 * 朝会HUD コンポーネント
 */
export const DashboardBriefingHUD: React.FC<DashboardBriefingHUDProps> = ({
  alerts,
  isBriefingTime,
  briefingType,
  onNavigateTo,
}) => {
  const theme = useTheme();

  if (alerts.length === 0) {
    return null;
  }

  // クリック回数によってユーザーに視覚的フィードバック
  const handleChipClick = (anchorId: string) => {
    onNavigateTo(anchorId);
  };

  const briefingLabel = briefingType === 'morning' ? '🌅 朝会サマリー' : '🌆 夕会サマリー';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        p: 2,
        bgcolor: isBriefingTime ? 'action.hover' : 'background.paper',
        border: isBriefingTime ? `2px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
        borderRadius: 1.5,
        boxShadow: isBriefingTime ? 3 : 0,
        mb: 3,
        transition: 'all 0.3s ease',
      }}
      data-testid="dashboard-briefing-hud"
    >
      {/* ヘッダー */}
      <Stack direction="row" spacing={1} alignItems="center">
        <EventIcon sx={{ color: 'primary.main' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
          {briefingLabel}
        </Typography>
        {isBriefingTime && (
          <Chip
            size="small"
            label="ライブ"
            color="primary"
            variant="filled"
            sx={{ ml: 'auto', fontWeight: 'bold' }}
          />
        )}
      </Stack>

      {/* アラートチップ群 */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        sx={{ display: 'flex', alignItems: 'flex-start' }}
      >
        {alerts.map((alert) => (
          <Chip
            key={alert.id}
            icon={getAlertIcon(alert.type)}
            label={`${alert.label}: ${alert.count}件`}
            color={getSeverityColor(alert.severity)}
            onClick={() => handleChipClick(alert.targetAnchorId)}
            sx={{
              fontWeight: 'bold',
              cursor: 'pointer',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: 2,
              },
              transition: 'all 0.2s ease',
            }}
            data-testid={`briefing-alert-${alert.id}`}
          />
        ))}
      </Stack>

      {/* 補足説明（description がある場合） */}
      {alerts.some((a) => a.description) && (
        <Stack spacing={0.5}>
          {alerts
            .filter((a) => a.description)
            .map((alert) => (
              <Alert key={`desc-${alert.id}`} severity="info" sx={{ py: 0.5, fontSize: '0.875rem' }}>
                <strong>{getAlertTypeLabel(alert.type)}:</strong> {alert.description}
              </Alert>
            ))}
        </Stack>
      )}
    </Box>
  );
};

export default DashboardBriefingHUD;
