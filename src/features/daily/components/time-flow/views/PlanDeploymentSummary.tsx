// ---------------------------------------------------------------------------
// PlanDeploymentSummary — 計画デプロイサマリ
// ---------------------------------------------------------------------------

import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';

import { stageLabelMap, stageOrder } from '../timeFlowConstants';
import type { SupportStrategyStage } from '../timeFlowTypes';
import type { FlowSupportActivityTemplate, SupportPlanDeployment } from '../timeFlowUtils';

interface PlanDeploymentSummaryProps {
  deployment: SupportPlanDeployment | null;
  activities: FlowSupportActivityTemplate[];
}

const PlanDeploymentSummary: React.FC<PlanDeploymentSummaryProps> = ({ deployment, activities }) => {
  const stageBreakdown = useMemo(() => {
    return activities.reduce<Record<SupportStrategyStage, number>>((acc, activity) => {
      acc[activity.stage] = (acc[activity.stage] ?? 0) + 1;
      return acc;
    }, {
      proactive: 0,
      earlyResponse: 0,
      crisisResponse: 0,
      postCrisis: 0,
    });
  }, [activities]);

  const severity = deployment ? 'success' : 'warning';

  return (
    <Alert severity={severity} sx={{ mt: 2 }}>
      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {deployment
              ? `連携中の支援計画: ${deployment.planName} (v${deployment.version})`
              : '支援計画との連携がありません（テンプレート利用中）'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {deployment?.summary ?? 'PlanWizard で承認された計画がデプロイされると自動で紐づきます。'}
          </Typography>
          {deployment?.deployedAt && (
            <Typography variant="caption" color="text.secondary">
              デプロイ日時: {new Date(deployment.deployedAt).toLocaleString('ja-JP')}
            </Typography>
          )}
          {deployment?.references && (
            <Stack spacing={0.25}>
              {deployment.references.map((item) => (
                <Typography key={item.label} variant="caption" color="text.secondary">
                  {item.label}: {item.value}
                </Typography>
              ))}
            </Stack>
          )}
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {stageOrder.map((stage) => (
            <Chip
              key={stage}
              label={`${stageLabelMap[stage]}: ${stageBreakdown[stage]}`}
              size="small"
              color={stageBreakdown[stage] > 0 ? 'primary' : 'default'}
              variant="outlined"
            />
          ))}
          <Chip label={`カード数: ${activities.length}`} size="small" color="info" variant="outlined" />
        </Stack>
      </Stack>
    </Alert>
  );
};

export default PlanDeploymentSummary;
