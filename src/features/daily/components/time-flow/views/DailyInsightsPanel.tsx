// ---------------------------------------------------------------------------
// DailyInsightsPanel — デイリーインサイト表示
// ---------------------------------------------------------------------------

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';

import type { DailySupportRecord } from '../timeFlowTypes';

interface DailyInsightsPanelProps {
  dailyRecord: DailySupportRecord;
}

const DailyInsightsPanel: React.FC<DailyInsightsPanelProps> = ({ dailyRecord }) => {
  const metrics = useMemo(() => {
    const totalSlots = dailyRecord.summary.totalTimeSlots;
    const recorded = dailyRecord.summary.recordedTimeSlots;
    const completionRate = totalSlots > 0 ? Math.round((recorded / totalSlots) * 100) : 0;
    const moodCount: Record<'良好' | '普通' | '不安定' | '未記録', number> = {
      良好: 0,
      普通: 0,
      不安定: 0,
      未記録: 0,
    };
    const intensityCount: Record<'軽度' | '中度' | '重度', number> = {
      軽度: 0,
      中度: 0,
      重度: 0,
    };

    dailyRecord.records.forEach((record) => {
      const mood = record.userCondition.mood ?? '未記録';
      if (moodCount[mood] !== undefined) {
        moodCount[mood] += 1;
      }

      if (record.abc?.intensity) {
        intensityCount[record.abc.intensity] += 1;
      }
    });

    const abcRecords = dailyRecord.records.filter((record) => Boolean(record.abc));
    const abcCoverage = dailyRecord.records.length > 0
      ? Math.round((abcRecords.length / dailyRecord.records.length) * 100)
      : 0;

    return {
      completionRate,
      moodCount,
      intensityCount,
      abcCoverage,
      incidents: dailyRecord.summary.concerningIncidents,
    };
  }, [dailyRecord]);

  return (
    <Card elevation={1}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            デイリーインサイト
          </Typography>
          <Box>
            <Typography variant="body2" color="text.secondary">
              記録カバー率
            </Typography>
            <LinearProgress
              variant="determinate"
              value={metrics.completionRate}
              sx={{ mt: 1, borderRadius: 999, height: 10 }}
            />
            <Typography variant="caption" color="text.secondary">
              {metrics.completionRate}% （{dailyRecord.summary.recordedTimeSlots}/{dailyRecord.summary.totalTimeSlots}）
            </Typography>
          </Box>

          <Divider />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box flex={1}>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  気分分布
                </Typography>
                {(['良好', '普通', '不安定'] as const).map((label) => (
                  <Stack key={label} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {metrics.moodCount[label]} 件
                    </Typography>
                  </Stack>
                ))}
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">未記録</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {metrics.moodCount['未記録']} 件
                  </Typography>
                </Stack>
              </Stack>
            </Box>
            <Box flex={1}>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  行動強度（ABC）
                </Typography>
                {(['軽度', '中度', '重度'] as const).map((label) => (
                  <Stack key={label} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {metrics.intensityCount[label]} 件
                    </Typography>
                  </Stack>
                ))}
                <Typography variant="caption" color="text.secondary">
                  ABC入力率 {metrics.abcCoverage}%
                </Typography>
              </Stack>
            </Box>
          </Stack>

          {metrics.incidents > 0 && (
            <Alert severity="warning" variant="outlined">
              懸念のある出来事が {metrics.incidents} 件記録されています。振り返り時に共有してください。
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default DailyInsightsPanel;
