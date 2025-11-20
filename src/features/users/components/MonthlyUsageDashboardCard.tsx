// MonthlyUsageDashboardCard.tsx
// 今月の利用可能状況を表示するダッシュボードカード

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningIcon from '@mui/icons-material/Warning';
import {
    Alert,
    Box,
    Card,
    CardContent,
    Chip,
    Divider,
    IconButton,
    LinearProgress,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import React, { useMemo } from 'react';

import type { AnyDaily } from '../../../domain/daily/types';
import type { IUserMaster } from '../typesExtended';
import {
    calculateMonthlyUsageStats,
    getCertExpiryStatus,
    getGrantPeriodStatus,
} from '../userMasterDashboardUtils';

interface MonthlyUsageDashboardCardProps {
  users: IUserMaster[];
  dailyRecords: AnyDaily[];
  targetMonth?: string; // YYYY-MM format
}

/**
 * 今月の利用日数を集計する関数
 */
const calculateMonthlyUsageCounts = (
  dailyRecords: AnyDaily[],
  targetMonth: string
): Record<string, number> => {
  const monthPrefix = `${targetMonth}-`;

  return dailyRecords
    .filter(record =>
      record.status === '完了' &&
      record.date.startsWith(monthPrefix)
    )
    .reduce<Record<string, number>>((acc, record) => {
      acc[record.personId] = (acc[record.personId] || 0) + 1;
      return acc;
    }, {});
};

/**
 * アラートアイコンを返す
 */
const getAlertIcon = (alertType: 'success' | 'warning' | 'error', size: 'small' | 'medium' = 'small') => {
  switch (alertType) {
    case 'success':
      return <CheckCircleIcon color="success" fontSize={size} />;
    case 'warning':
      return <WarningIcon color="warning" fontSize={size} />;
    case 'error':
      return <ErrorIcon color="error" fontSize={size} />;
    default:
      return <InfoIcon color="info" fontSize={size} />;
  }
};

const MonthlyUsageDashboardCard: React.FC<MonthlyUsageDashboardCardProps> = ({
  users,
  dailyRecords,
  targetMonth = new Date().toISOString().slice(0, 7)
}) => {
  const { usageStats, alertSummary, certificationAlerts } = useMemo(() => {
    const activeUsers = users.filter(user => user.UsageStatus === '利用中');
    const usageCounts = calculateMonthlyUsageCounts(dailyRecords, targetMonth);

    const stats = activeUsers.map(user => {
      const usedDays = usageCounts[user.UserID] || 0;
      const monthlyStats = calculateMonthlyUsageStats(user, usedDays, targetMonth);
      const certStatus = getCertExpiryStatus(user);
      const grantStatus = getGrantPeriodStatus(user);

      return {
        user,
        ...monthlyStats,
        certStatus,
        grantStatus,
      };
    });

    // アラートサマリー集計
    const alerts = {
      success: stats.filter(s => s.alertType === 'success').length,
      warning: stats.filter(s => s.alertType === 'warning').length,
      error: stats.filter(s => s.alertType === 'error').length,
      overUsage: stats.filter(s => s.isOverUsage).length,
    };

    // 受給者証期限アラート集計
    const certAlerts = {
      expired: stats.filter(s => s.certStatus.status === 'expired').length,
      expiringSoon: stats.filter(s => s.certStatus.status === 'warning').length,
    };

    return {
      usageStats: stats,
      alertSummary: alerts,
      certificationAlerts: certAlerts,
    };
  }, [users, dailyRecords, targetMonth]);

  // 全体の利用率計算
  const overallUtilization = useMemo(() => {
    if (usageStats.length === 0) return 0;
    const totalUtilization = usageStats.reduce((sum, stat) => sum + stat.utilizationRate, 0);
    return Math.round(totalUtilization / usageStats.length);
  }, [usageStats]);

  return (
    <Card elevation={2}>
      <CardContent>
        <Stack spacing={3}>
          {/* ヘッダー */}
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" display="flex" alignItems="center" gap={1}>
              <TrendingUpIcon color="primary" />
              今月の利用状況
            </Typography>
            <Tooltip title="支給決定に基づく月次利用状況を表示">
              <IconButton size="small">
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Typography variant="body2" color="text.secondary">
            対象月: {targetMonth} | 対象者: {usageStats.length}名
          </Typography>

          {/* 全体サマリー */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              全体概況
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                平均利用率
              </Typography>
              <LinearProgress
                variant="determinate"
                value={overallUtilization}
                sx={{
                  mt: 0.5,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'grey.200',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: overallUtilization >= 80 ? 'success.main' :
                                   overallUtilization >= 60 ? 'warning.main' : 'error.main',
                  }
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {overallUtilization}%
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                icon={getAlertIcon('success')}
                label={`余裕あり: ${alertSummary.success}名`}
                color="success"
                variant="outlined"
                size="small"
              />
              <Chip
                icon={getAlertIcon('warning')}
                label={`注意: ${alertSummary.warning}名`}
                color="warning"
                variant="outlined"
                size="small"
              />
              <Chip
                icon={getAlertIcon('error')}
                label={`緊急: ${alertSummary.error}名`}
                color="error"
                variant="outlined"
                size="small"
              />
              {alertSummary.overUsage > 0 && (
                <Chip
                  label={`超過: ${alertSummary.overUsage}名`}
                  color="error"
                  size="small"
                />
              )}
            </Stack>
          </Box>

          <Divider />

          {/* 重要アラート */}
          {(alertSummary.error > 0 || alertSummary.overUsage > 0 || certificationAlerts.expired > 0) && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'error.main' }}>
                重要な注意事項
              </Typography>
              <Stack spacing={1}>
                {alertSummary.error > 0 && (
                  <Alert severity="error" variant="outlined">
                    {alertSummary.error}名の利用者が残り利用可能日数5日以下です
                  </Alert>
                )}
                {alertSummary.overUsage > 0 && (
                  <Alert severity="error" variant="outlined">
                    {alertSummary.overUsage}名の利用者が支給決定日数を超過しています
                  </Alert>
                )}
                {certificationAlerts.expired > 0 && (
                  <Alert severity="error" variant="outlined">
                    {certificationAlerts.expired}名の利用者の受給者証が期限切れです
                  </Alert>
                )}
              </Stack>
            </Box>
          )}

          {/* 詳細リスト（問題のあるユーザーのみ表示） */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              要注意利用者
            </Typography>
            {usageStats
              .filter(stat =>
                stat.alertType === 'error' ||
                stat.isOverUsage ||
                stat.certStatus.status !== 'valid' ||
                !stat.grantStatus.isActive
              )
              .slice(0, 5) // 上位5名まで表示
              .map((stat) => (
                <Box
                  key={stat.user.UserID}
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: stat.isOverUsage ? 'error.light' : 'warning.light',
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: stat.isOverUsage ? 'error.50' : 'warning.50',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {stat.user.FullName} ({stat.user.UserID})
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        利用: {stat.usedDays}/{stat.grantedDays}日
                        ({stat.utilizationRate}%) |
                        残り: {stat.remainingDays}日
                      </Typography>
                      {stat.certStatus.status !== 'valid' && (
                        <Typography variant="caption" color="error.main">
                          受給者証: {stat.certStatus.message}
                        </Typography>
                      )}
                      {!stat.grantStatus.isActive && (
                        <Typography variant="caption" color="warning.main">
                          支給決定期間外 (残り: {stat.grantStatus.daysRemaining}日)
                        </Typography>
                      )}
                    </Box>
                    <Box>
                      {getAlertIcon(stat.alertType, 'medium')}
                    </Box>
                  </Stack>
                </Box>
              ))}

            {usageStats.filter(stat =>
              stat.alertType === 'error' ||
              stat.isOverUsage ||
              stat.certStatus.status !== 'valid' ||
              !stat.grantStatus.isActive
            ).length === 0 && (
              <Alert severity="success" variant="outlined">
                現在、特に注意が必要な利用者はいません
              </Alert>
            )}
          </Box>

          {/* 受給者証期限情報 */}
          {certificationAlerts.expiringSoon > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'warning.main' }}>
                受給者証期限
              </Typography>
              <Alert severity="warning" variant="outlined">
                {certificationAlerts.expiringSoon}名の利用者の受給者証期限が近づいています（30日以内）
              </Alert>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default MonthlyUsageDashboardCard;