import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { BehaviorSupportPlan } from '../../types/behaviorPlan';

interface VersionHistoryViewerProps {
  currentPlan: BehaviorSupportPlan;
  archivedPlans: BehaviorSupportPlan[];
}

const VersionCard: React.FC<{ plan: BehaviorSupportPlan; isCurrent?: boolean }> = ({
  plan,
  isCurrent = false,
}) => {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={<HistoryIcon />}
              label={`v${plan.version}`}
              color={isCurrent ? 'primary' : 'default'}
              size="small"
            />
            <Chip label={plan.status} size="small" variant="outlined" />
            <Typography variant="caption" color="text.secondary">
              更新日: {new Date(plan.updatedAt).toLocaleString('ja-JP')}
            </Typography>
          </Stack>
          <Typography variant="subtitle2" color="text.secondary">
            行動関連項目スコア: {plan.assessmentSummary.kodoScore} 点
          </Typography>
          <Typography variant="body2" color="text.secondary">
            機能仮説: {plan.assessmentSummary.functionalHypothesis.join(', ') || '未設定'}
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Typography variant="body2" color="text.secondary">
            手順カード: {plan.dailyActivities.length} 件 ｜ モニタリング履歴: {plan.monitoringHistory.length} 件
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
};

const VersionHistoryViewer: React.FC<VersionHistoryViewerProps> = ({ currentPlan, archivedPlans }) => {
  return (
    <Stack spacing={2}>
      <Typography variant="h6" fontWeight={700}>
        バージョン履歴
      </Typography>
      <VersionCard plan={currentPlan} isCurrent />

      {archivedPlans.length > 0 ? (
        archivedPlans.map((plan) => (
          <Accordion key={plan.planId} elevation={1} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">
                  v{plan.version} ｜ {plan.status}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(plan.updatedAt).toLocaleString('ja-JP')}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <VersionCard plan={plan} />
              {plan.monitoringHistory.length > 0 && (
                <Stack spacing={1.5} mt={2}>
                  <Typography variant="subtitle2" color="text.secondary">
                    モニタリング所見
                  </Typography>
                  {plan.monitoringHistory.map((record) => (
                    <Card key={`${plan.planId}-${record.date}`} variant="outlined">
                      <CardContent>
                        <Typography variant="caption" color="text.secondary">
                          {record.date} ｜ 前バージョン: {record.previousVersionId}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {record.summary}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </AccordionDetails>
          </Accordion>
        ))
      ) : (
        <Typography variant="body2" color="text.secondary">
          過去バージョンはまだ存在しません。計画更新時の履歴がここに表示されます。
        </Typography>
      )}
    </Stack>
  );
};

export default VersionHistoryViewer;
