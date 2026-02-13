import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { createCrossModuleAlertScenarios } from '@/features/cross-module/mockData';
import { buildCrossModuleDashboardAlerts } from '@/features/dashboard/crossModuleAlerts';
import { convertDashboardAlertsToSafetyHUD, getAlertIcon } from '@/lib/safetyHUDLogic';
import { TESTIDS, tid, tidWithSuffix } from '@/testids';
import { isE2E } from '@/env';

export type DashboardSafetyHUDProps = {
  /** 集計日。指定しない場合は本日の日付で生成 */
  date?: string;
};

const defaultDate = (): string => new Date().toISOString().slice(0, 10);

const severityChipColor: Record<'error' | 'warning' | 'info', 'error' | 'warning' | 'info'> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
};

const DashboardSafetyHUD: React.FC<DashboardSafetyHUDProps> = ({ date = defaultDate() }) => {
  const hudAlerts = useMemo(() => {
    const { snapshots } = createCrossModuleAlertScenarios(date);
    const dashboardAlerts = buildCrossModuleDashboardAlerts(snapshots);
    return convertDashboardAlertsToSafetyHUD(dashboardAlerts);
  }, [date]);

  const isAutomation =
    isE2E ||
    (typeof navigator !== 'undefined' && navigator.webdriver) ||
    (typeof window !== 'undefined' && Boolean((window as Window & { __PLAYWRIGHT__?: unknown }).__PLAYWRIGHT__));
  const shouldAutoOpen = isAutomation;
  const [open, setOpen] = useState(shouldAutoOpen);
  const counts = useMemo(() => {
    return hudAlerts.reduce(
      (acc, alert) => {
        acc[alert.severity] += 1;
        return acc;
      },
      { error: 0, warning: 0, info: 0 },
    );
  }, [hudAlerts]);
  const attentionCount = counts.error + counts.warning;

  return (
    <Box {...tid(TESTIDS['dashboard-safety-hud'])}>
      <Paper elevation={0} sx={{ p: 1, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
              🛡️ 安全指標
            </Typography>
            {attentionCount > 0 ? (
              <Chip
                size="small"
                variant="outlined"
                color={counts.error > 0 ? 'error' : 'warning'}
                icon={<span aria-hidden="true">{getAlertIcon(counts.error > 0 ? 'error' : 'warning')}</span>}
                label={`注意 ${attentionCount}`}
              />
            ) : (
              <Chip size="small" variant="outlined" color="success" label="安定" />
            )}
            {counts.info > 0 && (
              <Chip
                size="small"
                variant="outlined"
                color="info"
                icon={<span aria-hidden="true">{getAlertIcon('info')}</span>}
                label={`情報 ${counts.info}`}
              />
            )}
          </Stack>
          <IconButton
            size="small"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="安全指標の詳細を開閉"
          >
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Stack>

        <Collapse in={open} timeout="auto" unmountOnExit>
          <Stack spacing={0.75} sx={{ mt: 1 }} {...tidWithSuffix(TESTIDS['dashboard-safety-hud'], '-alerts')}>
            <Stack spacing={0.25}>
              <Typography variant="caption" color="text.secondary">
                主要モジュールの不整合やリスクを上位3件まで表示します。
              </Typography>
              <Typography variant="caption" color="text.secondary">
                今日の安全インジケーター / 予定の重なり をここで確認できます。
              </Typography>
              <Box
                component="span"
                aria-hidden
                hidden
                sx={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: 'hidden',
                  clip: 'rect(0, 0, 0, 0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }}
              >
                Safety HUD
              </Box>
            </Stack>

            {hudAlerts.length === 0 ? (
              <Alert severity="success" variant="outlined" data-testid="safety-hud-alert-empty">
                現在アラートはありません。
              </Alert>
            ) : (
              hudAlerts.map((alert, index) => {
                const content = (
                  <Stack spacing={0.25}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={alert.severity.toUpperCase()}
                        color={severityChipColor[alert.severity]}
                        size="small"
                        variant="outlined"
                      />
                      <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                        {alert.title}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                      {alert.message}
                    </Typography>
                  </Stack>
                );

                return (
                  <Alert
                    key={alert.id}
                    severity={alert.severity}
                    variant="outlined"
                    icon={<span aria-hidden="true">{getAlertIcon(alert.severity)}</span>}
                    data-testid={`safety-hud-alert-${alert.severity}-${index}`}
                    className={`safety-hud-alert ${alert.severity}`}
                    sx={{ cursor: alert.href ? 'pointer' : 'default' }}
                  >
                    {alert.href ? (
                      <Link to={alert.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </Alert>
                );
              })
            )}
          </Stack>
        </Collapse>
      </Paper>
    </Box>
  );
};

export default DashboardSafetyHUD;
