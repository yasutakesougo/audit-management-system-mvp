/**
 * AlertCard — アラート一覧カード
 *
 * Phase 2-A の evaluateAlertRules 結果を表示する。
 * severity 別にカウントし、主要アラートを一覧表示。
 */

import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { AlertSeverity, TriggeredAlert } from '../alertRules';

// ── severity 表示設定 ──

const SEVERITY_CONFIG: Record<AlertSeverity, {
  label: string;
  color: 'error' | 'warning' | 'info' | 'default';
  icon: React.ReactNode;
}> = {
  critical: { label: '緊急', color: 'error', icon: <ErrorOutlineIcon fontSize="small" color="error" /> },
  alert: { label: '注意', color: 'warning', icon: <WarningAmberIcon fontSize="small" color="warning" /> },
  warning: { label: '警告', color: 'info', icon: <InfoOutlinedIcon fontSize="small" color="info" /> },
  info: { label: '情報', color: 'default', icon: <InfoOutlinedIcon fontSize="small" color="disabled" /> },
};

const SEVERITY_ORDER: AlertSeverity[] = ['critical', 'alert', 'warning', 'info'];

// ── Props ──

export interface AlertCardProps {
  /** 発火済みアラート */
  alerts: TriggeredAlert[];
  /** アラート行のクリック時コールバック */
  onAlertClick?: (alert: TriggeredAlert) => void;
  /** 表示件数上限（デフォルト: 5） */
  maxDisplay?: number;
}

export default function AlertCard({
  alerts,
  onAlertClick,
  maxDisplay = 5,
}: AlertCardProps) {
  // severity 別カウント
  const counts = SEVERITY_ORDER.reduce((acc, sev) => {
    acc[sev] = alerts.filter((a) => a.severity === sev).length;
    return acc;
  }, {} as Record<AlertSeverity, number>);

  // 表示用: severity 降順（critical 先頭）→ 最大 N 件
  const displayAlerts = [...alerts]
    .sort((a, b) => {
      const ai = SEVERITY_ORDER.indexOf(a.severity);
      const bi = SEVERITY_ORDER.indexOf(b.severity);
      return ai - bi;
    })
    .slice(0, maxDisplay);

  const totalCount = alerts.length;

  return (
    <Card
      sx={{
        height: '100%',
        border: totalCount > 0 && counts.critical > 0
          ? '1px solid'
          : undefined,
        borderColor: counts.critical > 0 ? 'error.light' : undefined,
      }}
    >
      <CardContent>
        {/* ── ヘッダー ── */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <NotificationsActiveIcon
            color={totalCount > 0 ? 'warning' : 'disabled'}
            sx={{ fontSize: 22 }}
          />
          <Typography variant="subtitle1" fontWeight={700}>
            アラート
          </Typography>
          {totalCount > 0 && (
            <Chip
              label={`${totalCount}件`}
              size="small"
              color={counts.critical > 0 ? 'error' : 'warning'}
              sx={{ fontWeight: 600 }}
            />
          )}
        </Stack>

        {/* ── severity カウント ── */}
        <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
          {SEVERITY_ORDER.map((sev) => {
            const count = counts[sev];
            if (count === 0) return null;
            const cfg = SEVERITY_CONFIG[sev];
            return (
              <Chip
                key={sev}
                icon={<>{cfg.icon}</>}
                label={`${cfg.label} ${count}`}
                size="small"
                color={cfg.color}
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            );
          })}
        </Stack>

        <Divider sx={{ mb: 1 }} />

        {/* ── アラート一覧 ── */}
        {totalCount === 0 ? (
          <Box sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              現在アラートはありません
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {displayAlerts.map((alert, idx) => {
              const cfg = SEVERITY_CONFIG[alert.severity];
              return (
                <ListItemButton
                  key={`${alert.ruleId}-${alert.userCode}-${idx}`}
                  onClick={() => onAlertClick?.(alert)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    py: 0.5,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {cfg.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {alert.userDisplayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          — {alert.label}
                        </Typography>
                      </Stack>
                    }
                    secondary={alert.suggestion}
                  />
                </ListItemButton>
              );
            })}
            {totalCount > maxDisplay && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ pl: 2, pt: 0.5, display: 'block' }}
              >
                他 {totalCount - maxDisplay} 件のアラート
              </Typography>
            )}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
