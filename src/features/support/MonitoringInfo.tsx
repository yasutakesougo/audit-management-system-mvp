import AssessmentIcon from '@mui/icons-material/Assessment';
import DateRangeIcon from '@mui/icons-material/DateRange';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TimelineIcon from '@mui/icons-material/Timeline';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

interface MonitoringInfoProps {
  personName: string;
  currentDate: string;
}

const MonitoringInfo: React.FC<MonitoringInfoProps> = ({
  personName,
  currentDate
}) => {
  // 現在日付から四半期を計算
  const getCurrentQuarter = (date: string) => {
    const currentMonth = new Date(date).getMonth() + 1; // 0-based index なので +1
    if (currentMonth <= 3) return { quarter: 1, period: '1-3月' };
    if (currentMonth <= 6) return { quarter: 2, period: '4-6月' };
    if (currentMonth <= 9) return { quarter: 3, period: '7-9月' };
    return { quarter: 4, period: '10-12月' };
  };

  const { quarter, period } = getCurrentQuarter(currentDate);
  const currentYear = new Date(currentDate).getFullYear();

  // 次回モニタリング予定日を計算
  const getNextMonitoringDate = () => {
    const nextQuarterMonth = (quarter % 4) * 3 + 1; // 次の四半期の開始月
    const nextYear = quarter === 4 ? currentYear + 1 : currentYear;

    return new Date(nextYear, nextQuarterMonth - 1, 1).toISOString().split('T')[0];
  };

  const nextMonitoringDate = getNextMonitoringDate();

  // 四半期の進捗計算（簡易版）
  const getQuarterProgress = () => {
    const currentTime = new Date(currentDate);
    const quarterStart = new Date(currentYear, (quarter - 1) * 3, 1);
    const quarterEnd = new Date(currentYear, quarter * 3, 0); // 月末日

    const totalDays = (quarterEnd.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24);
    const passedDays = (currentTime.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24);

    return Math.min(Math.max((passedDays / totalDays) * 100, 0), 100);
  };

  const quarterProgress = getQuarterProgress();

  return (
    <Card elevation={2} sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
          <AssessmentIcon color="primary" />
          モニタリング情報 - {personName}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Stack spacing={2}>
          {/* 開所時間情報 */}
          <Alert severity="info" sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: '100%' }}>
              <Typography variant="subtitle2" fontWeight="bold" display="flex" alignItems="center" gap={1}>
                <ScheduleIcon fontSize="small" />
                開所時間
              </Typography>
              <Typography variant="body2">
                平日 9:30-16:00（6時間30分）
              </Typography>
            </Box>
          </Alert>

          {/* モニタリング周期情報 */}
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" display="flex" alignItems="center" gap={1} mb={1}>
              <DateRangeIcon fontSize="small" color="primary" />
              モニタリング周期：三ヶ月ごと
            </Typography>

            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', mb: 2 }}>
              <Chip
                label={`現在：第${quarter}四半期（${period}）`}
                color="primary"
                variant="filled"
              />
              <Chip
                label={`年度：${currentYear}年`}
                color="secondary"
                variant="outlined"
              />
              <Chip
                label={`次回モニタリング：${nextMonitoringDate}`}
                color="warning"
                variant="outlined"
              />
            </Stack>

            {/* 四半期進捗 */}
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary" display="flex" alignItems="center" gap={1}>
                <TimelineIcon fontSize="small" />
                第{quarter}四半期 進捗状況 ({Math.round(quarterProgress)}%)
              </Typography>
              <LinearProgress
                variant="determinate"
                value={quarterProgress}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  mt: 0.5,
                  bgcolor: 'grey.200',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3
                  }
                }}
              />
            </Box>
          </Box>

          {/* モニタリング項目 */}
          <Alert severity="success">
            <Typography variant="subtitle2" fontWeight="bold">
              モニタリング評価項目
            </Typography>
            <Typography variant="body2">
              • 支援目標の達成状況<br />
              • 支援方法の有効性<br />
              • 本人の変化・成長<br />
              • 支援計画の見直し必要性<br />
              • 次期支援計画への提言
            </Typography>
          </Alert>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default MonitoringInfo;