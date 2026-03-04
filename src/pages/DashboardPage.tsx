/**
 * DashboardPage — 極薄オーケストレーター (Container)
 *
 * Phase 3: ロジック / Props 構築 / レイアウト分岐をすべて外部モジュールへ抽出。
 * このファイルはフックとコンポーネントを「配線」するだけの役割。
 *
 * 抽出先:
 * A) useDashboardPage        → State + ViewModel 構築
 * B) DashboardHeaderActions   → ヘッダーアクションボタン群
 * C) useSectionRenderer       → セクション Props 構築 + 描画
 * D) useZeroScrollTabs        → タブデータ構築
 * E) DashboardLayoutRenderer  → レイアウト条件分岐 + Bento Grid 配置
 */

import { PageHeader } from '@/components/PageHeader';
import type { DashboardAudience } from '@/features/auth/store';
import { DashboardHeaderActions } from '@/features/dashboard/components/DashboardHeaderActions';
import { DashboardLayoutRenderer } from '@/features/dashboard/components/DashboardLayoutRenderer';
import { useDashboardPage } from '@/features/dashboard/hooks/useDashboardPage';
import { useSectionRenderer } from '@/features/dashboard/hooks/useSectionRenderer';
import { useZeroScrollTabs } from '@/features/dashboard/hooks/useZeroScrollTabs';
import DashboardIcon from '@mui/icons-material/Dashboard';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import React from 'react';

// Re-export for backward compatibility
export { calculateStaffConflicts, type StaffConflict } from '@/features/dashboard/dashboardLogic';

interface DashboardPageProps {
  audience?: DashboardAudience;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ audience = 'staff' }) => {
  // A) ページ全体の State + ViewModel
  const page = useDashboardPage(audience);

  // C) セクション描画
  const { renderSection } = useSectionRenderer({
    role: page.vm.role,
    attendanceSummary: page.attendanceSummary,
    dailyRecordStatus: page.dailyRecordStatus,
    stats: page.stats,
    scheduleLanesToday: page.scheduleLanesToday,
    scheduleLanesTomorrow: page.scheduleLanesTomorrow,
    prioritizedUsers: page.prioritizedUsers,
    intensiveSupportUsers: page.intensiveSupportUsers,
    usageMap: page.usageMap,
    showAttendanceNames: page.showAttendanceNames,
    setShowAttendanceNames: page.setShowAttendanceNames,
    tabValue: page.tabValue,
    handleTabChange: page.handleTabChange,
    dailyStatusCards: page.dailyStatusCards,
    schedulesEnabled: page.schedulesEnabled,
    handoffTotal: page.handoffTotal,
    handoffCritical: page.handoffCritical,
    handoffStatus: page.handoffStatus,
    openTimeline: page.openTimeline,
    isMorningTime: page.isMorningTime,
    isEveningTime: page.isEveningTime,
    users: page.users,
    visits: page.visits,
  });

  // D) Zero-Scroll タブ
  const zeroScrollTabs = useZeroScrollTabs({
    attendanceSummary: page.attendanceSummary,
    staffAvailability: page.staffAvailability,
    scheduleLanesToday: page.scheduleLanesToday,
  });

  return (
    <Container maxWidth="lg" data-testid="dashboard-page">
      <Box sx={{ py: { xs: 1.5, sm: 2, md: 2.5 } }}>
        {/* B) ヘッダー */}
        <PageHeader
          title="黒ノート"
          icon={<DashboardIcon />}
          actions={
            <DashboardHeaderActions
              onOpenBriefing={page.openBriefing}
              onNavigateToSchedule={() => page.navigate('/schedules/month')}
              schedulesEnabled={page.schedulesEnabled}
              onNavigateToRoomManagement={() => page.navigate('/room-management')}
            />
          }
        />

        {/* E) レイアウト別描画 */}
        <Stack spacing={{ xs: 2, sm: 3, md: 4 }} sx={{ mb: { xs: 2, sm: 3 } }}>
          <DashboardLayoutRenderer
            layoutMode={page.layoutMode}
            orderedSections={page.vm.orderedSections}
            renderSection={renderSection}
            sectionIdByKey={page.sectionIdByKey}
            highlightSection={page.highlightSection}
            briefingAlerts={page.vm.briefingAlerts}
            isBriefingTime={page.vm.contextInfo.isBriefingTime}
            briefingType={page.vm.contextInfo.briefingType}
            scrollToSection={page.scrollToSection}
            dateLabel={page.dateLabel}
            todayChanges={page.todayChanges}
            zeroScrollTabs={zeroScrollTabs}
            // 🍱 Bento Grid KPI data
            handoffPending={page.handoffStatus['未対応'] ?? 0}
            handoffCritical={page.handoffCritical}
            attendanceRatio={
              page.attendanceSummary
                ? {
                    present: page.attendanceSummary.facilityAttendees ?? 0,
                    total: page.attendanceSummary.onDutyStaff ?? 0,
                  }
                : undefined
            }
            dailyRecordRatio={{
              done: page.dailyRecordStatus.completed,
              total: page.dailyRecordStatus.total,
            }}
            // 📡 Handoff Live Feed data
            handoffTimelineItems={page.handoffTimelineItems}
            handoffTimelineLoading={page.handoffTimelineLoading}
            handoffTimelineError={page.handoffTimelineError}
            handoffTimelineUpdateStatus={page.handoffTimelineUpdateStatus}
            handoffTimelineReload={page.handoffTimelineReload}
            onOpenTimeline={page.openTimeline}
          />
        </Stack>
      </Box>
    </Container>
  );
};

export const AdminDashboardPage: React.FC = () => <DashboardPage audience="admin" />;
export const StaffDashboardPage: React.FC = () => <DashboardPage audience="staff" />;

export default DashboardPage;
