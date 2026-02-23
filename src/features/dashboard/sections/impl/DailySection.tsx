/**
 * Dashboard Daily Section Component
 *
 * 責務：「日次記録状況」セクションの表示
 * - Page から集計データとリスト構造を受け取る
 * - JSX 描画のみ
 *
 * 現在：Page の renderSection(case 'daily') の JSX をそのまま移動
 */

import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

export type DailyStatusCard = {
  label: string;
  value: number;
  helper: string;
  color: string;
  emphasize?: boolean;
};

export type DailySectionProps = {
  dailyStatusCards: DailyStatusCard[];
  dailyRecordStatus: {
    pending: number;
    inProgress: number;
    completed: number;
    total: number;
  };
};

export const DailySection: React.FC<DailySectionProps> = (props) => {
  const { dailyStatusCards, dailyRecordStatus } = props;

  return (
    <Paper elevation={3} sx={{ p: { xs: 2, sm: 2.5, md: 3 } }} data-testid="dashboard-section-daily">
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        日次記録状況
      </Typography>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" lineHeight={1.2} sx={{ fontWeight: 700 }}>
            ケース記録：未入力があります
          </Typography>
          <Typography variant="caption" lineHeight={1.3} color="text.secondary">
            未入力を優先して、入力と確認を進められます。
          </Typography>
        </Stack>
        <Stack
          spacing={0.75}
          alignItems={{ xs: 'flex-start', md: 'flex-end' }}
          sx={{ width: { xs: '100%', md: 'auto' }, minWidth: 180 }}
        >
          <Stack direction="row" spacing={1} flexWrap="nowrap" useFlexGap>
            <Button
              variant="contained"
              size="small"
              component={Link}
              to="/daily/activity"
              disabled={dailyRecordStatus.pending === 0}
            >
              未入力を入力する
            </Button>
            <Button variant="text" size="small" component={Link} to="/daily/table">
              一覧を見る
            </Button>
          </Stack>
        </Stack>
      </Stack>
      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mt: 1 }}>
        {dailyStatusCards.map(({ label, value, helper, color, emphasize }) => {
          return (
            <Grid key={label} size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, height: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {label}
                </Typography>
                <Typography
                  variant="h4"
                  sx={{ fontWeight: emphasize ? 800 : 700, color, mt: 1 }}
                >
                  {value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {helper}
                </Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Paper>
  );
};
