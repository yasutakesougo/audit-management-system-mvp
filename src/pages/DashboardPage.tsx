import {
    Assignment as AssignmentIcon,
    Psychology as BehaviorIcon,
    Dashboard as DashboardIcon,
    LocalHospital as MedicalIcon,
    Person as PersonIcon,
    Restaurant as RestaurantIcon,
    TrendingUp as TrendingUpIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Divider,
    LinearProgress,
    Paper,
    Stack,
    Tab,
    Tabs,
    Typography
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { PersonDaily, SeizureRecord } from '../domain/daily/types';
import { useUsersDemo } from '../features/users/usersStoreDemo';
import { IUserMaster } from '../sharepoint/fields';

// モック活動日誌データ生成
const generateMockActivityRecords = (users: IUserMaster[], date: string): PersonDaily[] => {
  return users.map((user, index) => {
    const hasProblems = Math.random() < 0.15; // 15%の確率で問題行動
    const hasSeizure = Math.random() < 0.05; // 5%の確率で発作
    const mealAmount = ['完食', '多め', '半分', '少なめ', 'なし'][Math.floor(Math.random() * 5)] as PersonDaily['data']['mealAmount'];

    return {
      id: index + 1,
      personId: user.UserID,
      personName: user.FullName,
      date,
      status: Math.random() > 0.1 ? '完了' as const : '作成中' as const,
      reporter: { name: '職員A' },
      draft: { isDraft: false },
      kind: 'A' as const,
      data: {
        amActivities: [['作業活動', '創作活動', '運動'][Math.floor(Math.random() * 3)]],
        pmActivities: [['リハビリ', '個別支援', 'レクリエーション'][Math.floor(Math.random() * 3)]],
        amNotes: 'AM活動を実施しました。',
        pmNotes: 'PM活動を実施しました。',
        mealAmount,
        problemBehavior: hasProblems ? {
          selfHarm: Math.random() < 0.3,
          violence: Math.random() < 0.2,
          loudVoice: Math.random() < 0.4,
          pica: Math.random() < 0.1,
          other: Math.random() < 0.2,
          otherDetail: Math.random() < 0.2 ? '落ち着かない様子が見られました' : ''
        } : {
          selfHarm: false,
          violence: false,
          loudVoice: false,
          pica: false,
          other: false
        },
        seizureRecord: hasSeizure ? {
          occurred: true,
          time: `${10 + Math.floor(Math.random() * 6)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
          duration: `${Math.floor(Math.random() * 10) + 1}分`,
          severity: ['軽度', '中等度', '重度'][Math.floor(Math.random() * 3)] as SeizureRecord['severity'],
          notes: '発作が発生しました。適切に対応しました。'
        } : {
          occurred: false
        },
        specialNotes: index % 7 === 0 ? '本日は特に調子が良好でした。' : ''
      }
    };
  });
};

// タブパネルコンポーネント
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ paddingTop: '16px' }}>
    {value === index && children}
  </div>
);

const DashboardPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const { data: users } = useUsersDemo();

  const today = new Date().toISOString().split('T')[0];

  // 活動日誌データ（モック）
  const activityRecords = useMemo(() =>
    generateMockActivityRecords(users, today),
    [users, today]
  );

  // 強度行動障害対象者
  const intensiveSupportUsers = users.filter(user => user.IsSupportProcedureTarget);

  // 統計計算
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const recordedUsers = activityRecords.filter(r => r.status === '完了').length;
    const completionRate = totalUsers > 0 ? (recordedUsers / totalUsers) * 100 : 0;

    // 問題行動統計
    const problemBehaviorStats = activityRecords.reduce((acc, record) => {
      const pb = record.data.problemBehavior;
      if (pb) {
        if (pb.selfHarm) acc.selfHarm++;
        if (pb.violence) acc.violence++;
        if (pb.loudVoice) acc.loudVoice++;
        if (pb.pica) acc.pica++;
        if (pb.other) acc.other++;
      }
      return acc;
    }, { selfHarm: 0, violence: 0, loudVoice: 0, pica: 0, other: 0 });

    // 発作統計
    const seizureCount = activityRecords.filter(r =>
      r.data.seizureRecord && r.data.seizureRecord.occurred
    ).length;

    // 昼食摂取統計
    const lunchStats = activityRecords.reduce((acc, record) => {
      const amount = record.data.mealAmount || 'なし';
      acc[amount] = (acc[amount] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUsers,
      recordedUsers,
      completionRate,
      problemBehaviorStats,
      seizureCount,
      lunchStats
    };
  }, [users, activityRecords]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 3 }}>
        {/* ヘッダー */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            <DashboardIcon sx={{ verticalAlign: 'middle', mr: 2 }} />
            統合ダッシュボード
          </Typography>
          <Typography variant="body1" color="text.secondary">
            全利用者の活動状況と支援記録の統合的な管理・分析
          </Typography>
        </Box>

        {/* 基本統計 */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="h4" color="primary">
              {stats.totalUsers}名
            </Typography>
            <Typography variant="body2" color="text.secondary">
              総利用者数
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="h4" color="success.main">
              {stats.recordedUsers}名
            </Typography>
            <Typography variant="body2" color="text.secondary">
              本日記録完了
            </Typography>
            <Box sx={{ mt: 1 }}>
              <LinearProgress
                variant="determinate"
                value={stats.completionRate}
                sx={{ height: 6, borderRadius: 3 }}
              />
              <Typography variant="caption" color="text.secondary">
                {Math.round(stats.completionRate)}%
              </Typography>
            </Box>
          </Paper>

          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="h4" color="secondary.main">
              {intensiveSupportUsers.length}名
            </Typography>
            <Typography variant="body2" color="text.secondary">
              強度行動障害対象者
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="h4" color={stats.seizureCount > 0 ? "error.main" : "success.main"}>
              {stats.seizureCount}件
            </Typography>
            <Typography variant="body2" color="text.secondary">
              本日発作記録
            </Typography>
          </Paper>
        </Stack>

        {/* タブナビゲーション */}
        <Card sx={{ mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              label="集団傾向分析"
              icon={<TrendingUpIcon />}
              iconPosition="start"
            />
            <Tab
              label="問題行動サマリー"
              icon={<BehaviorIcon />}
              iconPosition="start"
            />
            <Tab
              label="医療・健康情報"
              icon={<MedicalIcon />}
              iconPosition="start"
            />
            <Tab
              label="個別支援記録"
              icon={<AssignmentIcon />}
              iconPosition="start"
            />
          </Tabs>
        </Card>

        {/* タブコンテンツ */}

        {/* 集団傾向分析 */}
        <TabPanel value={tabValue} index={0}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <RestaurantIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                  昼食摂取状況
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ gap: 1 }}>
                  {Object.entries(stats.lunchStats).map(([amount, count]) => (
                    <Chip
                      key={amount}
                      label={`${amount}: ${count}名`}
                      color={amount === '完食' ? 'success' : amount === 'なし' ? 'error' : 'default'}
                      variant={amount === '完食' ? 'filled' : 'outlined'}
                    />
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <BehaviorIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                  問題行動発生状況
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ gap: 1 }}>
                  <Chip
                    label={`自傷: ${stats.problemBehaviorStats.selfHarm}件`}
                    color={stats.problemBehaviorStats.selfHarm > 0 ? 'error' : 'default'}
                  />
                  <Chip
                    label={`暴力: ${stats.problemBehaviorStats.violence}件`}
                    color={stats.problemBehaviorStats.violence > 0 ? 'error' : 'default'}
                  />
                  <Chip
                    label={`大声: ${stats.problemBehaviorStats.loudVoice}件`}
                    color={stats.problemBehaviorStats.loudVoice > 0 ? 'warning' : 'default'}
                  />
                  <Chip
                    label={`異食: ${stats.problemBehaviorStats.pica}件`}
                    color={stats.problemBehaviorStats.pica > 0 ? 'error' : 'default'}
                  />
                  <Chip
                    label={`その他: ${stats.problemBehaviorStats.other}件`}
                    color={stats.problemBehaviorStats.other > 0 ? 'warning' : 'default'}
                  />
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </TabPanel>

        {/* 問題行動サマリー */}
        <TabPanel value={tabValue} index={1}>
          <Stack spacing={2}>
            {stats.problemBehaviorStats.selfHarm > 0 && (
              <Alert severity="error" icon={<WarningIcon />}>
                本日、自傷行動が{stats.problemBehaviorStats.selfHarm}件発生しています。該当者の個別対応を確認してください。
              </Alert>
            )}
            {stats.problemBehaviorStats.violence > 0 && (
              <Alert severity="error" icon={<WarningIcon />}>
                本日、暴力行動が{stats.problemBehaviorStats.violence}件発生しています。環境調整・支援方法の見直しを検討してください。
              </Alert>
            )}
            {Object.values(stats.problemBehaviorStats).every(count => count === 0) && (
              <Alert severity="success">
                本日は問題行動の記録がありません。良好な状態が維持されています。
              </Alert>
            )}

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>問題行動対応履歴</Typography>
                <Typography variant="body2" color="text.secondary">
                  詳細な対応記録と改善傾向の分析は個別の活動日誌をご確認ください。
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </TabPanel>

        {/* 医療・健康情報 */}
        <TabPanel value={tabValue} index={2}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <MedicalIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                  発作記録サマリー
                </Typography>
                {stats.seizureCount > 0 ? (
                  <Alert severity="warning">
                    本日{stats.seizureCount}件の発作が記録されています。医療対応と記録の詳細確認をお願いします。
                  </Alert>
                ) : (
                  <Alert severity="success">
                    本日は発作の記録がありません。
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>健康管理指標</Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" gutterBottom>昼食摂取率</Typography>
                    <LinearProgress
                      variant="determinate"
                      value={((stats.lunchStats['完食'] || 0) / stats.totalUsers) * 100}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                    <Typography variant="caption">
                      {Math.round(((stats.lunchStats['完食'] || 0) / stats.totalUsers) * 100)}%
                      ({stats.lunchStats['完食'] || 0}名/{stats.totalUsers}名)
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </TabPanel>

        {/* 個別支援記録 */}
        <TabPanel value={tabValue} index={3}>
          <Stack spacing={2}>
            <Typography variant="h6" gutterBottom>
              <PersonIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              強度行動障害対象者 支援手順記録
            </Typography>

            {intensiveSupportUsers.map(user => (
              <Card key={user.Id} sx={{ border: '2px solid', borderColor: 'warning.main' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6">
                      {user.FullName}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip label="強度行動障害" color="warning" size="small" />
                      <Chip label="支援手順記録対象" color="info" size="small" />
                    </Stack>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                    <Paper sx={{ p: 1, textAlign: 'center', flex: 1 }}>
                      <Typography variant="h6" color="primary">
                        {Math.floor(Math.random() * 15) + 10}/19
                      </Typography>
                      <Typography variant="caption">支援手順実施</Typography>
                    </Paper>
                    <Paper sx={{ p: 1, textAlign: 'center', flex: 1 }}>
                      <Typography variant="h6" color="success.main">
                        {Math.floor(Math.random() * 3) + 8}
                      </Typography>
                      <Typography variant="caption">効果的手順</Typography>
                    </Paper>
                    <Paper sx={{ p: 1, textAlign: 'center', flex: 1 }}>
                      <Typography variant="h6" color="warning.main">
                        {Math.floor(Math.random() * 3) + 1}
                      </Typography>
                      <Typography variant="caption">要改善手順</Typography>
                    </Paper>
                  </Stack>

                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => window.open(`/daily/support?user=${user.UserID}`, '_blank')}
                  >
                    詳細記録を確認
                  </Button>
                </CardContent>
              </Card>
            ))}

            {intensiveSupportUsers.length === 0 && (
              <Alert severity="info">
                現在、支援手順記録の対象者はいません。
              </Alert>
            )}
          </Stack>
        </TabPanel>

        {/* クイックアクション */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              onClick={() => window.open('/daily/activity', '_blank')}
            >
              活動日誌入力
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => window.open('/daily/support', '_blank')}
            >
              支援手順記録入力
            </Button>
            <Button
              variant="outlined"
              size="large"
              color="secondary"
            >
              月次レポート生成
            </Button>
          </Stack>
        </Box>
      </Box>
    </Container>
  );
};

export default DashboardPage;