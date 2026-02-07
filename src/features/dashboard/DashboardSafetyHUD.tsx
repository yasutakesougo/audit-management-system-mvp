import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { createCrossModuleAlertScenarios } from '@/features/cross-module/mockData';
import { buildCrossModuleDashboardAlerts } from '@/features/dashboard/crossModuleAlerts';
import { convertDashboardAlertsToSafetyHUD, getAlertIcon } from '@/lib/safetyHUDLogic';
import { TESTIDS, tid, tidWithSuffix } from '@/testids';

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

  const totalAlerts = hudAlerts.length;
  const headline = totalAlerts > 0 ? `${totalAlerts}件の注意が必要` : '安定しています';

  return (
    <Box {...tid(TESTIDS['dashboard-safety-hud'])}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="flex-start" spacing={1.5} sx={{ mb: 1 }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                安全インジケーター
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                🛡️ ダッシュボード安全指標
              </Typography>
              <Typography variant="body2" color="text.secondary">
                主要モジュールの不整合やリスクを上位3件まで表示します。
              </Typography>
              <Typography variant="body2" color="text.secondary">
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
            </Box>
            <Chip label={headline} color={totalAlerts > 0 ? 'warning' : 'success'} variant={totalAlerts > 0 ? 'filled' : 'outlined'} size="small" />
          </Stack>

          <Stack spacing={1} {...tidWithSuffix(TESTIDS['dashboard-safety-hud'], '-alerts')}>
            {hudAlerts.length === 0 ? (
              <Alert severity="success" variant="outlined" data-testid="safety-hud-alert-empty">
                現在アラートはありません。
              </Alert>
            ) : (
              hudAlerts.map((alert, index) => {
                const content = (
                  <Stack spacing={0.25}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={alert.severity.toUpperCase()} color={severityChipColor[alert.severity]} size="small" variant="outlined" />
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
                    variant="filled"
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
        </CardContent>
      </Card>
    </Box>
  );
};

export default DashboardSafetyHUD;
