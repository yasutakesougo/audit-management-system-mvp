import type { DashboardAudience } from '@/features/auth/store';
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
  role: DashboardAudience;
  onNavigate: (to: string) => void;
};

export const TodayLitePage: React.FC<TodayLitePageProps> = ({ summary, role, onNavigate }) => {
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
    () => [
      {
        key: 'attendance',
        title: '出欠確認',
        count: attendancePending,
        primaryLabel: '出欠を確認する',
        onPrimaryClick: () => handleNavigate('/daily/attendance'),
      },
      {
        key: 'record',
        title: '記録入力',
        count: recordPending,
        primaryLabel: '記録を入力する',
        onPrimaryClick: () => handleNavigate('/daily/table'),
      },
      {
        key: 'handoff',
        title: '申し送り',
        count: handoffPending,
        primaryLabel: '申し送りを見る',
        onPrimaryClick: () => handleNavigate('/handoff-timeline'),
      },
    ],
    [attendancePending, handoffPending, recordPending, handleNavigate],
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
        onOpenExceptionCenter={() => handleNavigate('/admin/exception-center')}
      />
    </Stack>
  );
};

export default TodayLitePage;
