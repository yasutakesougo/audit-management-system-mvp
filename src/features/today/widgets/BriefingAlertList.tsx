/**
 * BriefingAlertList — 朝会ブリーフィングアラート
 *
 * briefingAlerts を severity アイコン付きで表示。
 * Collapse で 0件→有件 のレイアウトジャンプを防止。
 */
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import { Alert, Collapse, Paper, Stack, Typography } from '@mui/material';
import React from 'react';

export type BriefingAlertListProps = {
  alerts: BriefingAlert[];
};

export const BriefingAlertList: React.FC<BriefingAlertListProps> = ({ alerts }) => {
  return (
    <Collapse in={alerts.length > 0}>
      <Paper data-testid="today-briefing-alerts" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          ⚠️ 朝会アラート
        </Typography>
        <Stack spacing={1}>
          {alerts.map((alert) => (
            <Alert
              key={alert.id}
              severity={alert.severity}
              variant="outlined"
              sx={{ py: 0.25 }}
            >
              <Typography variant="body2" fontWeight={500}>
                {alert.label}
                {alert.count > 0 && ` (${alert.count}件)`}
              </Typography>
              {alert.description && (
                <Typography variant="caption" color="text.secondary">
                  {alert.description}
                </Typography>
              )}
            </Alert>
          ))}
        </Stack>
      </Paper>
    </Collapse>
  );
};
