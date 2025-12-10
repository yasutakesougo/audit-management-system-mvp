// UsageStatusDashboard.tsx
// 利用者の契約・支給決定・利用状況を統合管理するダッシュボードページ

import {
    Box,
    Card,
    CardContent,
    Chip,
    Container,
    Paper,
    Stack,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import type { AnyDaily } from '../../domain/daily/types';
import MonthlyUsageDashboardCard from './components/MonthlyUsageDashboardCard';
import type { IUserMaster } from './typesExtended';
import { USAGE_STATUS_VALUES } from './typesExtended';
import {
    generateBillingOverview,
    getExpiringCertUsers,
    getRenewalRequiredUsers,
} from './userMasterDashboardUtils';

interface UsageStatusDashboardProps {
  users: IUserMaster[];
  dailyRecords: AnyDaily[];
}

const UsageStatusDashboard: React.FC<UsageStatusDashboardProps> = ({
  users,
  dailyRecords
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const currentMonth = new Date().toISOString().slice(0, 7);

  // 統計情報の計算
  const statistics = useMemo(() => {
    const statusCounts = users.reduce<Record<string, number>>((acc, user) => {
      const status = user.UsageStatus || '未設定';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const billingOverview = generateBillingOverview(users);
    const expiringCerts = getExpiringCertUsers(users, 60);
    const renewalRequired = getRenewalRequiredUsers(users);

    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.UsageStatus === USAGE_STATUS_VALUES.ACTIVE).length,
      statusCounts,
      billingOverview,
      expiringCerts: expiringCerts.length,
      renewalRequired: renewalRequired.length,
    };
  }, [users]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Stack spacing={3}>
        {/* ヘッダー */}
        <Box>
          <Typography variant="h4" gutterBottom>
            利用状況ダッシュボード
          </Typography>
          <Typography variant="body1" color="text.secondary">
            契約・支給決定・利用実績を統合管理
          </Typography>
        </Box>

        {/* サマリーカード */}
        <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" }} gap={3}>
          <Card elevation={1}>
            <CardContent>
              <Typography variant="h6" color="primary.main">
                {statistics.totalUsers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                登録利用者数
              </Typography>
            </CardContent>
          </Card>
          <Card elevation={1}>
            <CardContent>
              <Typography variant="h6" color="success.main">
                {statistics.activeUsers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                現在利用中
              </Typography>
            </CardContent>
          </Card>
          <Card elevation={1}>
            <CardContent>
              <Typography variant="h6" color="warning.main">
                {statistics.expiringCerts}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                受給者証期限迫る
              </Typography>
            </CardContent>
          </Card>
          <Card elevation={1}>
            <CardContent>
              <Typography variant="h6" color="error.main">
                {statistics.renewalRequired}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                支給決定更新要
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* タブナビゲーション */}
        <Paper elevation={1}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="今月の利用状況" />
            <Tab label="契約・支給決定管理" />
            <Tab label="請求・加算管理" />
          </Tabs>
        </Paper>

        {/* タブコンテンツ */}
        <Box>
          {activeTab === 0 && (
            <Box display="grid" gridTemplateColumns={{ xs: "1fr", lg: "2fr 1fr" }} gap={3}>
              <Box>
                <MonthlyUsageDashboardCard
                  users={users}
                  dailyRecords={dailyRecords}
                  targetMonth={currentMonth}
                />
              </Box>
              <Box>
                <Stack spacing={3}>
                  <Card elevation={1}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        利用ステータス分布
                      </Typography>
                      <Stack spacing={1}>
                        {Object.entries(statistics.statusCounts).map(([status, count]) => (
                          <Box
                            key={status}
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Chip
                              label={status}
                              size="small"
                              color={status === '利用中' ? 'success' : 'default'}
                              variant="outlined"
                            />
                            <Typography variant="body2">
                              {count}名
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Stack>
              </Box>
            </Box>
          )}

          {activeTab === 1 && (
            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={3}>
              <Card elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    受給者証期限管理
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    期限が近づいている受給者証の管理
                  </Typography>
                  {/* 期限切れ近い受給者証のリストを表示 */}
                </CardContent>
              </Card>
              <Card elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    支給決定期間管理
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    更新が必要な支給決定期間の管理
                  </Typography>
                  {/* 更新要支給決定のリストを表示 */}
                </CardContent>
              </Card>
            </Box>
          )}

          {activeTab === 2 && (
            <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={3}>
              <Card elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    送迎加算
                  </Typography>
                  <Stack spacing={1}>
                    {Object.entries(statistics.billingOverview.transportAdditionCount).map(([type, count]) => (
                      <Box
                        key={type}
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography variant="body2">{type}</Typography>
                        <Chip label={`${count}名`} size="small" variant="outlined" />
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
              <Card elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    食事提供体制加算
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">利用者</Typography>
                    <Chip
                      label={`${statistics.billingOverview.mealAdditionUsers}名`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                </CardContent>
              </Card>
              <Card elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    利用者負担金支払方法
                  </Typography>
                  <Stack spacing={1}>
                    {Object.entries(statistics.billingOverview.copayMethods).map(([method, count]) => (
                      <Box
                        key={method}
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography variant="body2">{method}</Typography>
                        <Chip label={`${count}名`} size="small" variant="outlined" />
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>
      </Stack>
    </Container>
  );
};

export default UsageStatusDashboard;