import type { ComplianceRiskFlag } from '@/domain/compliance/entities';
import type { SupportPlanSnapshot } from '@/domain/compliance/mock';
import {
    Assessment as AssessmentIcon,
    DateRange as DateRangeIcon,
    FactCheck as FactCheckIcon,
    Schedule as ScheduleIcon,
    Timeline as TimelineIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Card,
    CardContent,
    Chip,
    Divider,
    LinearProgress,
    Stack,
    Typography
} from '@mui/material';
import React, { useMemo } from 'react';

interface MonitoringInfoProps {
  personName: string;
  currentDate?: string;
  snapshot?: SupportPlanSnapshot | null;
  riskFlags?: ComplianceRiskFlag[];
}

const formatDate = (iso?: string | null) => {
  if (!iso) {
    return '未登録';
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return parsed.toLocaleDateString('ja-JP');
};

const clamp = (value: number) => Math.min(Math.max(value, 0), 100);

const formatIsoLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const computeQuarterInfo = (reference: Date) => {
  const month = reference.getMonth(); // zero-based
  const year = reference.getFullYear();
  const quarter = Math.floor(month / 3) + 1;
  const startMonth = (quarter - 1) * 3;
  const quarterStart = new Date(year, startMonth, 1);
  const quarterEnd = new Date(year, startMonth + 3, 0);
  const nextQuarterStart =
    quarter === 4 ? new Date(year + 1, 0, 1) : new Date(year, startMonth + 3, 1);

  const dayMs = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.round((nextQuarterStart.getTime() - quarterStart.getTime()) / dayMs));
  const passedDays = Math.max(0, Math.round((reference.getTime() - quarterStart.getTime()) / dayMs));
  const daysUntilNextMonitoring = Math.ceil((nextQuarterStart.getTime() - reference.getTime()) / dayMs);

  return {
    quarter,
    periodLabel: `${startMonth + 1}-${startMonth + 3}月`,
    progress: clamp((passedDays / totalDays) * 100),
    nextMonitoringDate: formatIsoLocalDate(nextQuarterStart),
    quarterStart,
    quarterEnd,
    daysUntilNextMonitoring,
  };
};

const MonitoringInfo: React.FC<MonitoringInfoProps> = ({
  personName,
  currentDate,
  snapshot,
  riskFlags,
}) => {
  const referenceDate = useMemo(() => (currentDate ? new Date(currentDate) : new Date()), [currentDate]);
  const quarterInfo = useMemo(() => computeQuarterInfo(referenceDate), [referenceDate]);


    const planProgress = useMemo(() => {
      const planEffectiveFrom = snapshot?.planEffectiveFrom ? new Date(snapshot.planEffectiveFrom) : null;
      const planEffectiveTo = snapshot?.planEffectiveTo ? new Date(snapshot.planEffectiveTo) : null;

      if (!snapshot || !planEffectiveFrom || !planEffectiveTo || planEffectiveTo <= planEffectiveFrom) {
        return quarterInfo.progress;
      }
      const total = planEffectiveTo.getTime() - planEffectiveFrom.getTime();
      const passed = referenceDate.getTime() - planEffectiveFrom.getTime();
      return clamp((passed / total) * 100);
    }, [quarterInfo.progress, referenceDate, snapshot]);

  const outstandingActions = snapshot?.outstandingActions ?? {
    requiresMonitoring: false,
    hasExpiredPlan: false,
    requiresConsentRenewal: false,
  };

  const monitoringDueDate = snapshot?.monitoringDueOn
    ? new Date(snapshot.monitoringDueOn)
    : new Date(quarterInfo.nextMonitoringDate);
  const monitoringDaysDiff = Math.ceil(
    (monitoringDueDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const monitoringCountdownLabel =
    monitoringDaysDiff >= 0
      ? `次回モニタリングまで残り ${monitoringDaysDiff}日`
      : `モニタリング期限を ${Math.abs(monitoringDaysDiff)}日超過`;
  const monitoringCountdownSeverity: 'success' | 'warning' | 'error' =
    monitoringDaysDiff < 0 ? 'error' : monitoringDaysDiff <= 7 ? 'warning' : 'success';

  const complianceIssues: string[] = [];
  if (outstandingActions.hasExpiredPlan) {
    complianceIssues.push('支援計画の有効期限が切れています。');
  } else if (snapshot?.planEffectiveTo && new Date(snapshot.planEffectiveTo).getTime() < quarterInfo.quarterEnd.getTime()) {
    complianceIssues.push('計画期限が四半期内で終了予定です。');
  }
  if (outstandingActions.requiresMonitoring) {
    complianceIssues.push('モニタリングの実施期限を超過しています。');
  }
  if (outstandingActions.requiresConsentRenewal) {
    complianceIssues.push('計画の交付・同意更新が必要です。');
  }
  if (snapshot?.unlinkedActivities) {
    complianceIssues.push(`計画に紐づかない活動が ${snapshot.unlinkedActivities} 件あります。`);
  }

  const aggregatedRiskFlags = riskFlags ?? snapshot?.riskFlags ?? [];
  if (aggregatedRiskFlags.length === 0 && complianceIssues.length === 0) {
    complianceIssues.push('現在の計画は要件を満たしています。');
  }

  const alertSeverity: 'success' | 'warning' | 'error' =
    complianceIssues.some((message) => message.includes('期限') || message.includes('切れ'))
      ? 'error'
      : complianceIssues[0]?.includes('満たしています')
        ? 'success'
        : 'warning';

  const lastMonitoring = snapshot?.lastMonitoringOn ? formatDate(snapshot.lastMonitoringOn) : '未実施';
  const monitoringDue = snapshot?.monitoringDueOn
    ? formatDate(snapshot.monitoringDueOn)
    : quarterInfo.nextMonitoringDate;
  const planDueInDays =
    snapshot?.planEffectiveTo != null
      ? Math.ceil((new Date(snapshot.planEffectiveTo).getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

  return (
    <Card elevation={2} sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
          <AssessmentIcon color="primary" />
          モニタリング情報 - {personName}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Stack spacing={2}>
          <Alert severity="info" sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: '100%' }}>
              <Typography variant="subtitle2" fontWeight="bold" display="flex" alignItems="center" gap={1}>
                <ScheduleIcon fontSize="small" />
                開所時間
              </Typography>
              <Typography variant="body2">平日 9:30-16:00（6時間30分）</Typography>
            </Box>
          </Alert>

          <Box>
            <Typography variant="subtitle2" fontWeight="bold" display="flex" alignItems="center" gap={1} mb={1}>
              <DateRangeIcon fontSize="small" color="primary" />
              {snapshot ? '個別支援計画のモニタリング' : 'モニタリング周期：四半期ごと'}
            </Typography>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 2 }}>
              {snapshot ? (
                <>
                  <Chip label={`バージョン: v${snapshot.version}`} color="primary" variant="outlined" />
                  <Chip
                    label={`有効期間: ${formatDate(snapshot.planEffectiveFrom)}〜${formatDate(snapshot.planEffectiveTo)}`}
                    color={outstandingActions.hasExpiredPlan ? 'warning' : 'primary'}
                    variant={outstandingActions.hasExpiredPlan ? 'filled' : 'outlined'}
                  />
                  <Chip
                    label={`最終モニタリング: ${lastMonitoring}`}
                    color={outstandingActions.requiresMonitoring ? 'warning' : 'info'}
                    variant={outstandingActions.requiresMonitoring ? 'filled' : 'outlined'}
                  />
                  <Chip
                    label={`次回モニタリング: ${monitoringDue}`}
                    color={outstandingActions.requiresMonitoring ? 'warning' : 'success'}
                    variant="outlined"
                  />
                  <Chip
                    label={`交付・同意: ${formatDate(snapshot.consentSignedOn)}`}
                    color={outstandingActions.requiresConsentRenewal ? 'warning' : 'success'}
                    variant={outstandingActions.requiresConsentRenewal ? 'filled' : 'outlined'}
                  />
                  <Chip
                    label={
                      planDueInDays == null
                        ? '計画期限: 未登録'
                        : planDueInDays >= 0
                          ? `計画期限まで残り ${planDueInDays}日`
                          : `計画期限を ${Math.abs(planDueInDays)}日超過`
                    }
                    color={
                      planDueInDays == null
                        ? 'warning'
                        : planDueInDays < 0
                          ? 'error'
                          : planDueInDays <= 30
                            ? 'warning'
                            : 'info'
                    }
                    variant={planDueInDays != null && planDueInDays < 0 ? 'filled' : 'outlined'}
                  />
                  <Chip
                    label={`計画連携済み活動: ${Math.max(0, (snapshot?.linkedServiceItems?.length ?? 0) - (snapshot?.unlinkedActivities ?? 0))}/${snapshot?.linkedServiceItems?.length ?? 0}`}
                    color={snapshot?.unlinkedActivities ? 'warning' : 'success'}
                    variant={snapshot?.unlinkedActivities ? 'filled' : 'outlined'}
                  />
                </>
              ) : (
                <>
                  <Chip label={`現在: 第${quarterInfo.quarter}四半期（${quarterInfo.periodLabel}）`} color="primary" variant="filled" />
                  <Chip label={`年度: ${referenceDate.getFullYear()}年`} color="secondary" variant="outlined" />
                  <Chip label={`次回モニタリング予定: ${quarterInfo.nextMonitoringDate}`} color="warning" variant="outlined" />
                </>
              )}
              <Chip label={monitoringCountdownLabel} color={monitoringCountdownSeverity} variant="outlined" />
            </Stack>

            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary" display="flex" alignItems="center" gap={1}>
                <TimelineIcon fontSize="small" />
                {snapshot ? '計画期間の経過状況' : `四半期サイクルの進捗状況`}
                ({Math.round(planProgress)}%)
              </Typography>
              <LinearProgress
                variant="determinate"
                value={planProgress}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  mt: 0.5,
                  bgcolor: 'grey.200',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          </Box>

          <Alert severity={alertSeverity} icon={<WarningIcon fontSize="small" />}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              モニタリング対応状況
            </Typography>
            <Box component="ul" sx={{ pl: 2, m: 0, typography: 'body2' }}>
              {complianceIssues.map(message => (
                <li key={message}>{message}</li>
              ))}
            </Box>
          </Alert>

          {aggregatedRiskFlags.length > 0 && (
            <Alert severity="warning" variant="outlined">
              <Typography variant="subtitle2" fontWeight="bold" display="flex" alignItems="center" gap={1} gutterBottom>
                <FactCheckIcon fontSize="small" />
                関連コンプライアンス警告
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {aggregatedRiskFlags.map((flag) => (
                  <Chip
                    key={flag.flagId}
                    label={flag.message}
                    color={flag.severity === 'error' ? 'error' : flag.severity === 'warning' ? 'warning' : 'info'}
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Stack>
            </Alert>
          )}

          <Alert severity="success">
            <Typography variant="subtitle2" fontWeight="bold">
              モニタリング評価項目
            </Typography>
            <Typography variant="body2">
              • 支援目標の達成状況
              <br />
              • 支援方法の有効性
              <br />
              • 本人の変化・成長
              <br />
              • 支援計画の見直し必要性
              <br />
              • 次期支援計画への提言
            </Typography>
          </Alert>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default MonitoringInfo;
