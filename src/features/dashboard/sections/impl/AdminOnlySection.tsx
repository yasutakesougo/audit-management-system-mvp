import type { IUserMaster } from '@/sharepoint/fields';
import MedicalIcon from '@mui/icons-material/LocalHospital';
import PersonIcon from '@mui/icons-material/Person';
import BehaviorIcon from '@mui/icons-material/Psychology';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    LinearProgress,
    Stack,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import React from 'react';

export interface AdminOnlySectionProps {
  tabValue: number;
  onTabChange: (event: React.SyntheticEvent, newValue: number) => void;
  stats: {
    totalUsers: number;
    lunchStats: Record<string, number>;
    problemBehaviorStats: {
      selfHarm: number;
      otherInjury: number;
      loudVoice: number;
      pica: number;
      other: number;
    };
    seizureCount: number;
  };
  intensiveSupportUsers: IUserMaster[];
  activeUsers: IUserMaster[];
  usageMap: Record<string, unknown>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && children}
    </div>
  );
}

const ADMIN_TABS = [
  { label: '集団傾向分析', icon: '📊' },
  { label: '利用状況', icon: '👥' },
  { label: '問題行動', icon: '⚠️' },
  { label: '医療・健康', icon: '🏥' },
  { label: '支援手順の実施', icon: '📋' },
];

export function AdminOnlySection({
  tabValue,
  onTabChange,
  stats,
  intensiveSupportUsers,
  activeUsers: _activeUsers,
  usageMap: _usageMap,
}: AdminOnlySectionProps) {
  return (
    <Box data-testid="dashboard-section-adminOnly">
      {/* タブナビゲーション */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={onTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          {ADMIN_TABS.map((tab) => (
            <Tab key={tab.label} label={tab.label} />
          ))}
        </Tabs>
      </Card>

      {/* 集団傾向分析 */}
      <TabPanel value={tabValue} index={0}>
        <Stack spacing={3}>
          <Card>
            <CardContent sx={{ py: 1.25, px: 1.5 }}>
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
            <CardContent sx={{ py: 1.25, px: 1.5 }}>
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
                  label={`他傷: ${stats.problemBehaviorStats.otherInjury}件`}
                  color={stats.problemBehaviorStats.otherInjury > 0 ? 'error' : 'default'}
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
      <TabPanel value={tabValue} index={2}>
        <Stack spacing={2}>
          {stats.problemBehaviorStats.selfHarm > 0 && (
            <Alert severity="error" icon={<WarningIcon />}>
              本日、自傷行動が{stats.problemBehaviorStats.selfHarm}件発生しています。該当者の個別対応を確認してください。
            </Alert>
          )}
          {stats.problemBehaviorStats.otherInjury > 0 && (
            <Alert severity="error" icon={<WarningIcon />}>
              本日、他傷行動が{stats.problemBehaviorStats.otherInjury}件発生しています。環境調整・支援方法の見直しを検討してください。
            </Alert>
          )}
          {Object.values(stats.problemBehaviorStats).every(count => count === 0) && (
            <Alert severity="success">
              本日は問題行動の記録がありません。良好な状態が維持されています。
            </Alert>
          )}

          <Card>
            <CardContent sx={{ py: 1.25, px: 1.5 }}>
              <Typography variant="h6" gutterBottom>問題行動対応履歴</Typography>
              <Typography variant="body2" color="text.secondary">
                詳細な対応記録と改善傾向の分析は個別の日々の記録をご確認ください。
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      </TabPanel>

      {/* 医療・健康情報 */}
      <TabPanel value={tabValue} index={3}>
        <Stack spacing={3}>
          <Card>
            <CardContent sx={{ py: 1.25, px: 1.5 }}>
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
            <CardContent sx={{ py: 1.25, px: 1.5 }}>
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
      <TabPanel value={tabValue} index={4}>
        <Stack spacing={2}>
          <Typography variant="h6" gutterBottom>
            <PersonIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            強度行動障害対象者 支援手順の実施
          </Typography>

          {intensiveSupportUsers.map(user => (
            <Card key={user.Id} sx={{ border: '2px solid', borderColor: 'warning.main' }}>
              <CardContent sx={{ py: 1.25, px: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">
                    {user.FullName}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip label="強度行動障害" color="warning" size="small" />
                    <Chip label="支援手順の実施対象" color="info" size="small" />
                  </Stack>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
                  支援手順の実施の自動集計は準備中です。個別の日々の記録は下のボタンからご確認ください。
                </Alert>

                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => window.open(`/daily/support?user=${user.UserID}`, '_blank')}
                >
                  日々の記録を開く
                </Button>
              </CardContent>
            </Card>
          ))}

          {intensiveSupportUsers.length === 0 && (
            <Alert severity="info">
              現在、支援手順の実施対象者はいません。
            </Alert>
          )}
        </Stack>
      </TabPanel>
    </Box>
  );
}
