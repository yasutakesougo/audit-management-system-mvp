/**
 * @fileoverview CycleAlertsCard — 期限超過・停滞アラート KPI カード
 */
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { CycleDiagnosis, PdcaCycleMetricsResult } from '@/domain/metrics/pdcaCycleMetrics';

import OpsMetricCard from './OpsMetricCard';
import type { MetricStatus } from './OpsMetricCard';

export interface CycleAlertsCardProps {
  metrics: PdcaCycleMetricsResult | null;
  /** 表示するアラートの最大件数（デフォルト 5） */
  maxAlerts?: number;
}

function deriveStatus(alerts: CycleDiagnosis[]): MetricStatus {
  if (alerts.some(a => a.status === 'overdue')) return 'critical';
  if (alerts.length > 0) return 'warning';
  return 'good';
}

const STATUS_CHIP_PROPS: Record<string, { label: string; color: 'error' | 'warning' }> = {
  overdue: { label: '期限超過', color: 'error' },
  stalled: { label: '停滞', color: 'warning' },
};

const CycleAlertsCard: React.FC<CycleAlertsCardProps> = ({
  metrics,
  maxAlerts = 5,
}) => {
  const alerts = metrics?.alerts ?? [];
  const displayAlerts = alerts.slice(0, maxAlerts);

  return (
    <OpsMetricCard
      title="注意サイクル"
      icon={<WarningAmberIcon />}
      primaryValue={alerts.length}
      primaryUnit="件"
      primaryLabel={alerts.length === 0 ? '全サイクル正常' : '対応が必要なサイクル'}
      status={deriveStatus(alerts)}
    >
      {displayAlerts.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Stack spacing={0.75}>
            {displayAlerts.map((alert) => {
              const chipProps = STATUS_CHIP_PROPS[alert.status] ?? STATUS_CHIP_PROPS.stalled;
              return (
                <Stack
                  key={alert.cycleId}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{
                    p: 0.75,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Chip
                      label={chipProps.label}
                      color={chipProps.color}
                      size="small"
                      sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                      {alert.userId}
                    </Typography>
                  </Stack>
                  {alert.overdueDays > 0 && (
                    <Typography variant="caption" color="error" sx={{ fontWeight: 600 }}>
                      +{alert.overdueDays}日
                    </Typography>
                  )}
                </Stack>
              );
            })}
          </Stack>
          {alerts.length > maxAlerts && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.5, textAlign: 'center' }}
            >
              他 {alerts.length - maxAlerts} 件
            </Typography>
          )}
        </Box>
      )}
    </OpsMetricCard>
  );
};

export default React.memo(CycleAlertsCard);
