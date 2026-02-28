// ---------------------------------------------------------------------------
// SupportPlanQuickView — 支援手順プレビュー
// ---------------------------------------------------------------------------

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';

import { stageLabelMap } from '../timeFlowConstants';
import type { DailySupportRecord } from '../timeFlowTypes';
import type { FlowSupportActivityTemplate } from '../timeFlowUtils';

interface SupportPlanQuickViewProps {
  dailyRecord: DailySupportRecord;
  activities: FlowSupportActivityTemplate[];
}

const SupportPlanQuickView: React.FC<SupportPlanQuickViewProps> = ({ dailyRecord, activities }) => {
  const { pendingActivities, nextActivity } = useMemo(() => {
    const pending = activities.filter((activity) => {
      const record = dailyRecord.records.find((entry) => entry.activityKey === activity.time);
      return !(record && record.status === '記録済み');
    });

    return {
      pendingActivities: pending,
      nextActivity: pending[0],
    };
  }, [activities, dailyRecord]);

  return (
    <Card elevation={1} sx={{ mt: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              支援手順プレビュー
            </Typography>
            <Typography variant="body2" color="text.secondary">
              残り {pendingActivities.length} 件の時間帯が未記録です。
            </Typography>
          </Stack>

          {nextActivity ? (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: '1px dashed', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 600 }}>
                次の候補: {nextActivity.time} {nextActivity.title}
              </Typography>
              <Chip
                label={stageLabelMap[nextActivity.stage]}
                size="small"
                color="success"
                variant="outlined"
              />
              <Typography variant="body2" color="text.secondary">
                本人: {nextActivity.personTodo}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                支援者: {nextActivity.supporterTodo}
              </Typography>
            </Box>
          ) : (
            <Alert severity="success" variant="outlined">
              すべての時間帯が記録済みです。お疲れさまでした！
            </Alert>
          )}

          {pendingActivities.slice(1, 4).map((activity) => (
            <Box key={activity.time} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {activity.time} {activity.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stageLabelMap[activity.stage]}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                本人: {activity.personTodo}
              </Typography>
            </Box>
          ))}

          {pendingActivities.length > 4 && (
            <Typography variant="caption" color="text.secondary">
              他 {pendingActivities.length - 4} 件の未記録があります。
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default SupportPlanQuickView;
