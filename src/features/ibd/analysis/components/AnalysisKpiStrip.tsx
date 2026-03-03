import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import * as React from 'react';

// ---------------------------------------------------------------------------
// AnalysisKpiStrip — 分析ワークスペース共通KPIバー
//
// 各タブで共有される3〜4個のKPIカードを横並びで表示。
// 氷山PDCAページとAnalysisDashboardの重複KPIを一本化。
// ---------------------------------------------------------------------------

export type KpiItem = {
  label: string;
  value: string;
  sub?: string;
  testId?: string;
};

type Props = {
  items: KpiItem[];
};

export const AnalysisKpiStrip: React.FC<Props> = ({ items }) => (
  <Stack
    direction={{ xs: 'column', sm: 'row' }}
    spacing={1}
    sx={{ mb: 2 }}
  >
    {items.map((item) => (
      <Paper
        key={item.label}
        variant="outlined"
        data-testid={item.testId}
        sx={{
          p: 1.5,
          minWidth: 160,
          flex: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {item.label}
        </Typography>
        <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
          {item.value}
        </Typography>
        {item.sub && (
          <Typography variant="caption" color="text.secondary">
            {item.sub}
          </Typography>
        )}
      </Paper>
    ))}
  </Stack>
);
