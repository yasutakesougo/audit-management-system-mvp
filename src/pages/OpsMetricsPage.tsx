/**
 * @fileoverview OpsMetricsPage — /ops 独立ページ
 * @description
 * Support Operations Metrics Dashboard をフルページで表示する。
 * 現在はデモモードで動作。本番データ接続は Phase 2 で実施。
 */
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import OpsMetricsDashboard from '@/features/ops-dashboard/OpsMetricsDashboard';

const OpsMetricsPage: React.FC = () => {
  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 1, textAlign: 'right' }}
      >
        ※ デモデータで表示中 — 本番データ接続は今後対応予定
      </Typography>

      <OpsMetricsDashboard demo />
    </Box>
  );
};

export default OpsMetricsPage;
