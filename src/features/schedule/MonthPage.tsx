import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

const MonthPage: React.FC = () => (
  <Box sx={{ p: 2 }}>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
      <CalendarMonthRoundedIcon color="primary" />
      <Typography variant="h5" component="h1">
        月間スケジュール
      </Typography>
    </Stack>
    <Alert severity="info" variant="outlined" sx={{ maxWidth: 520 }}>
      月表示は現在準備中です。週表示のカレンダーをご利用ください。
    </Alert>
  </Box>
);

export default MonthPage;
