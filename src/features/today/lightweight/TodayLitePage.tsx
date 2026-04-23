import type { Role } from '@/auth/roles';
import type { DashboardAudience } from '@/features/auth/store';
import { getTodayPrimaryFlowSteps } from '@/features/today/config/todayCoreFlow';
import type { TodaySummary } from '@/features/today/domain/useTodaySummary';
import { toLocalDateISO } from '@/utils/getNow';
import { Stack } from '@mui/material';
import React, { useCallback, useMemo } from 'react';
import { TodayActionCards, type TodayActionCardItem } from './TodayActionCards';
import { TodayAdminInsights } from './TodayAdminInsights';
import { TodayHeaderSummary } from './TodayHeaderSummary';
import { TodayNoticePanel } from './TodayNoticePanel';

export type TodayLitePageProps = {
  summary?: TodaySummary | null;
  role: Role;
  ispRenewSuggestCount?: number;
  onNavigate: (to: string) => void;
};

export const TodayLitePage: React.FC<TodayLitePageProps> = ({
  summary,
  role,
  ispRenewSuggestCount = 0,
  onNavigate,
}) => {
  if (!summary) {
    return null;
  }

  const isAdmin = role === 'admin';

  const completion = summary.todayRecordCompletion;
  const targetCount = summary.users?.length ?? 0;
  const scheduledCount = targetCount;
  const attendedCount = summary.attendanceSummary?.facilityAttendees ?? 0;
  const attendancePending = Math.max(scheduledCount - attendedCount, 0);
  // Keep parity with legacy Today progress calculation.
  // Prefer execution-store completion counts when support targets exist.
  const recordPending = (completion && completion.total > 0)
    ? completion.pending
    : Math.max(0, summary.dailyRecordStatus?.pending ?? 0);
  const handoffPending = (summary.briefingAlerts ?? []).filter(
    (alert) => alert.severity === 'error' || alert.severity === 'warning',
  ).length;

  const handleNavigate = useCallback((to: string) => {
    onNavigate(to);
  }, [onNavigate]);

  const cards = useMemo<TodayActionCardItem[]>(
    () => {
      const countByFlowKey: Record<string, number> = {
        attendance: attendancePending,
        'daily-table': recordPending,
        'handoff-timeline': handoffPending,
        'daily-support': recordPending,
      };
      const titleByFlowKey: Record<string, string> = {
        attendance: '通所管理',
        'daily-table': '日々の記録',
        'handoff-timeline': '申し送り',
        'daily-support': '今日の業務',
      };
      const buttonLabelByFlowKey: Record<string, string> = {
        attendance: '出欠を入力する',
        'daily-table': '記録を入力する',
        'handoff-timeline': '内容を確認する',
        'daily-support': '支援手順を開く',
      };

      const audience: DashboardAudience = role === 'admin' ? 'admin' : 'staff';
      const baseCards = getTodayPrimaryFlowSteps(audience).map<TodayActionCardItem>((step) => ({
        key: step.key,
        title: titleByFlowKey[step.key] ?? step.label,
        count: countByFlowKey[step.key] ?? 0,
        primaryLabel: buttonLabelByFlowKey[step.key] ?? step.label,
        onPrimaryClick: () => handleNavigate(step.route),
      }));

      if (isAdmin && ispRenewSuggestCount > 0) {
        baseCards.push({
          key: 'isp-renew-suggest',
          title: '計画見直し推奨',
          count: ispRenewSuggestCount,
          primaryLabel: '見直し提案を確認',
          onPrimaryClick: () => handleNavigate('/support-plan-guide?tab=operations.monitoring'),
        });
      }

      return baseCards;
    },
    [attendancePending, handoffPending, isAdmin, ispRenewSuggestCount, recordPending, handleNavigate, role],
  );

  const notices = useMemo(() => {
    return (summary.briefingAlerts ?? [])
      .slice(0, 3)
      .map((alert) => `${alert.label} ${alert.count}件`);
  }, [summary.briefingAlerts]);

  return (
    <Stack spacing={2} data-testid="today-lite-page">
      <TodayHeaderSummary
        dateText={`${toLocalDateISO()} の状況`}
        targetCount={targetCount}
        attendancePending={attendancePending}
        recordPending={recordPending}
        handoffPending={handoffPending}
      />
      <TodayActionCards cards={cards} />
      <TodayNoticePanel notices={notices} />
      <TodayAdminInsights
        visible={isAdmin}
        exceptionCount={summary.todayExceptions?.length ?? 0}
        ispRenewSuggestCount={ispRenewSuggestCount}
        onOpenExceptionCenter={() => handleNavigate('/admin/exception-center')}
        onOpenIspRecommendations={() => handleNavigate('/support-plan-guide?tab=operations.monitoring')}
      />
    </Stack>
  );
};

export default TodayLitePage;
