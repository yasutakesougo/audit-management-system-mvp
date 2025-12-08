import { useNurseDashboardDemoSeed } from '@/features/nurse/home/useNurseDashboardDemoSeed';
import ObservationBridge from '@/features/nurse/observation/ObservationBridge';
import { getFlag } from '@/env';
import { warmDataEntryComponents } from '@/mui/warm';
import { tid, TESTIDS } from '@/testids';
import type { TestId } from '@/testids';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { Fragment, useEffect } from 'react';
import type { NurseDashboardFixture } from '@/features/nurse/home/useNurseDashboardDemoSeed';

const HealthObservationPage: React.FC = () => {
  const showBetaBanner = getFlag('VITE_FEATURE_NURSE_BETA');
  const nurseSeed = useNurseDashboardDemoSeed();

  // ページ初期化時にMUIコンポーネントをプリロード
  useEffect(() => {
    warmDataEntryComponents().catch(() => {
      // プリロード失敗は非致命的エラーとして処理
    });
  }, []);

  return (
    <>
      {nurseSeed ? <NurseDashboardSeedPanel seed={nurseSeed} /> : null}
      {showBetaBanner && (
        <Alert
          severity="info"
          sx={{
            borderRadius: 0,
            borderLeft: 0,
            borderRight: 0,
            borderTop: 0,
          }}
        >
          看護観察UI（β版）です。画面構成や入力項目は今後変更される可能性があります。
        </Alert>
      )}
      <ObservationBridge />
    </>
  );
};

export default HealthObservationPage;

type NurseDashboardSeedPanelProps = {
  seed: NurseDashboardFixture;
};

const NurseDashboardSeedPanel: React.FC<NurseDashboardSeedPanelProps> = ({ seed }) => (
  <Box
    {...tid(TESTIDS['nurse-dashboard-root'])}
    sx={{
      px: 2,
      py: 2,
      bgcolor: 'background.default',
    }}
  >
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <div>
            <Typography variant="overline" color="text.secondary">
              看護ダッシュボード（dev seed）
            </Typography>
            <Typography variant="h5" fontWeight={700} {...tid(TESTIDS['nurse-dashboard-summary-total'])}>
              本日の看護タスク {seed.summary.totalTasks}件
            </Typography>
          </div>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <SummaryMetric
              testId={TESTIDS['nurse-dashboard-summary-pending']}
              label="未実施"
              value={seed.summary.pending}
            />
            <SummaryMetric
              testId={TESTIDS['nurse-dashboard-summary-in-progress']}
              label="対応中"
              value={seed.summary.inProgress}
            />
            <SummaryMetric
              testId={TESTIDS['nurse-dashboard-summary-completed']}
              label="完了"
              value={seed.summary.completed}
            />
          </Stack>
          <List dense sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            {seed.tasks.map((task, index) => (
              <Fragment key={task.id}>
                <ListItem {...tid(TESTIDS['nurse-dashboard-task-row'])} alignItems="flex-start">
                  <ListItemText
                    primary={`${task.time} ${task.userName}`}
                    secondary={`${task.label} / 状態: ${task.status}`}
                  />
                </ListItem>
                {index < seed.tasks.length - 1 ? <Divider component="li" /> : null}
              </Fragment>
            ))}
          </List>
        </Stack>
      </CardContent>
    </Card>
  </Box>
);

type SummaryMetricProps = {
  testId: TestId;
  label: string;
  value: number;
};

const SummaryMetric: React.FC<SummaryMetricProps> = ({ testId, label, value }) => (
  <Stack spacing={0.5}>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="h6" fontWeight={600} {...tid(testId)}>
      {value}件
    </Typography>
  </Stack>
);
