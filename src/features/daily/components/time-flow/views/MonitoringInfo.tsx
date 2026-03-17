// ---------------------------------------------------------------------------
// MonitoringInfo — モニタリング情報表示カード
// ---------------------------------------------------------------------------

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';

interface MonitoringInfoProps {
  userName: string;
  currentDate: string;
}

const MonitoringInfo: React.FC<MonitoringInfoProps> = ({ userName, currentDate }) => {
  const currentMonitoringPeriod = useMemo(() => {
    const date = new Date(currentDate);
    const month = date.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    const year = date.getFullYear();
    return `${year}年第${quarter}四半期`;
  }, [currentDate]);

  return (
    <Card sx={{ mb: 3 }} elevation={1}>
      <CardContent>
        <Typography variant="h6" gutterBottom color="primary">
          📊 モニタリング情報
        </Typography>
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
          <Chip label={`対象者: ${userName}`} color="primary" variant="outlined" />
          <Chip label={`記録日: ${currentDate}`} color="info" variant="outlined" />
          <Chip label={`モニタリング周期: ${currentMonitoringPeriod}`} color="secondary" variant="outlined" />
          <Chip label="更新頻度: 三ヶ月ごと" color="default" variant="outlined" />
        </Stack>
      </CardContent>
    </Card>
  );
};

export default MonitoringInfo;
