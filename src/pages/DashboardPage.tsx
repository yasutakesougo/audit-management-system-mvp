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
  const { nav, ui, vm, summary, handoff } = page;

  // C) セクション描画
  const { renderSection } = useSectionRenderer({
    role: vm.role,
    summary,
    showAttendanceNames: ui.showAttendanceNames,
    setShowAttendanceNames: ui.setShowAttendanceNames,
    tabValue: ui.tabValue,
    handleTabChange: ui.handleTabChange,
    dailyStatusCards: ui.dailyStatusCards,
    schedulesEnabled: nav.schedulesEnabled,
    handoffTotal: handoff.total,
    handoffCritical: handoff.critical,
    handoffStatus: handoff.status,
    openTimeline: nav.openTimeline,
    isMorningTime: ui.isMorningTime,
    isEveningTime: ui.isEveningTime,
    users: ui.users,
    visits: ui.visits,
  });

  // D) Zero-Scroll タブ
  const zeroScrollTabs = useZeroScrollTabs({
    attendanceSummary: summary.attendanceSummary,
    staffAvailability: summary.staffAvailability,
    scheduleLanesToday: summary.scheduleLanesToday,
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
              onOpenBriefing={nav.openBriefing}
              onNavigateToSchedule={() => nav.navigate('/schedules/month')}
              schedulesEnabled={nav.schedulesEnabled}
              onNavigateToRoomManagement={() => nav.navigate('/room-management')}
            />
          }
        />

        {/* E) レイアウト別描画 */}
        <Stack spacing={{ xs: 2, sm: 3, md: 4 }} sx={{ mb: { xs: 2, sm: 3 } }}>
          <DashboardLayoutRenderer
            layoutMode={nav.layoutMode}
            orderedSections={vm.orderedSections}
            renderSection={renderSection}
            sectionIdByKey={ui.sectionIdByKey}
            highlightSection={ui.highlightSection}
            briefingAlerts={vm.briefingAlerts}
            isBriefingTime={vm.contextInfo.isBriefingTime}
            briefingType={vm.contextInfo.briefingType}
            scrollToSection={ui.scrollToSection}
            dateLabel={ui.dateLabel}
            todayChanges={ui.todayChanges}
            zeroScrollTabs={zeroScrollTabs}
            // 🍱 Bento Grid KPI data
            handoffPending={handoff.status['未対応'] ?? 0}
            handoffCritical={handoff.critical}
            attendanceRatio={
              summary.attendanceSummary
                ? {
                    present: summary.attendanceSummary.facilityAttendees ?? 0,
                    total: summary.attendanceSummary.onDutyStaff ?? 0,
                  }
                : undefined
            }
            dailyRecordRatio={{
              done: summary.dailyRecordStatus.completed,
              total: summary.dailyRecordStatus.total,
            }}
            // 📊 Handoff Summary Card data
            handoffTotal={handoff.total}
            handoffByStatus={handoff.status}
            onOpenTimeline={nav.openTimeline}
            handoffByCategory={handoff.byCategory}
          />
        </Stack>
      </Box>
    </Container>
  );
};

export const AdminDashboardPage: React.FC = () => <DashboardPage audience="admin" />;
export const StaffDashboardPage: React.FC = () => <DashboardPage audience="staff" />;

export default DashboardPage;
