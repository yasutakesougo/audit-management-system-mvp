import { PageHeader } from '@/components/PageHeader';
import { useFeatureFlags } from '@/config/featureFlags';
import { canAccessDashboardAudience, type DashboardAudience } from '@/features/auth/store';
import { DashboardZoneLayout } from '@/features/dashboard/components/DashboardZoneLayout';
import type { TodayChanges } from '@/features/dashboard/components/TodayChangesCard';
import { getDashboardAnchorIdByKey } from '@/features/dashboard/sections/buildSections';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DashboardIcon from '@mui/icons-material/Dashboard';

import MedicalIcon from '@mui/icons-material/LocalHospital';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import BehaviorIcon from '@mui/icons-material/Psychology';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

import { getSectionComponent, type SectionProps } from '@/features/dashboard/sections/registry';

import Container from '@mui/material/Container';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAttendanceStore } from '@/features/attendance/store';
import DashboardBriefingHUD from '@/features/dashboard/DashboardBriefingHUD';
import { generateTodosFromSchedule } from '@/features/dashboard/generateTodos';
import { useDashboardLayoutMode } from '@/features/dashboard/hooks/useDashboardLayoutMode';
import { ZeroScrollLayout, type DashboardTab } from '@/features/dashboard/layouts/ZeroScrollLayout';
import { generateMockActivityRecords } from '@/features/dashboard/mocks/mockData';
import { StaffStatusTab } from '@/features/dashboard/tabs/StaffStatusTab';
import { TodoTab } from '@/features/dashboard/tabs/TodoTab';
import { UserStatusTab } from '@/features/dashboard/tabs/UserStatusTab';
import { useDashboardSummary } from '@/features/dashboard/useDashboardSummary';
import { useDashboardViewModel, type DashboardSection, type DashboardSectionKey } from '@/features/dashboard/useDashboardViewModel';
import { useAttendanceCounts } from '@/features/staff/attendance/useAttendanceCounts';
import { useStaffStore } from '@/features/staff/store';
import type { HandoffDayScope } from '../features/handoff/handoffTypes';
import { useHandoffSummary } from '../features/handoff/useHandoffSummary';
import { useUsersDemo } from '../features/users/usersStoreDemo';

// useAttendanceCounts → extracted to @/features/staff/attendance/useAttendanceCounts
// generateMockActivityRecords → extracted to @/features/dashboard/mocks/mockData

// タブパネルコンポーネント
interface DashboardPageProps {
  audience?: DashboardAudience;
}

// StaffConflict / calculateStaffConflicts → extracted to @/features/dashboard/dashboardLogic
export { calculateStaffConflicts, type StaffConflict } from '@/features/dashboard/dashboardLogic';

const ADMIN_TABS = [
  { label: '集団傾向分析', icon: <TrendingUpIcon /> },
  { label: '利用状況', icon: <MonitorHeartIcon /> },
  { label: '問題行動サマリー', icon: <BehaviorIcon /> },
  { label: '医療・健康情報', icon: <MedicalIcon /> },
  { label: '個別支援記録', icon: <AssignmentIcon /> },
];

const DashboardPage: React.FC<DashboardPageProps> = ({ audience = 'staff' }) => {
  /**
   * Phase 4 note:
   * - このページは「表示（レイアウト/配置）」に寄せ、判断/計算は ViewModel に集約する方針。
   * - 新しいカードやセクション追加は原則 `useDashboardViewModel` に寄せて、
   *   ここでは `vm.sections` を描画するだけに留める（Page肥大化を防ぐ）。
   * - E2E/スモークの安定性のため、Page側に副作用やデータ整形を増やさない。
   */
  const navigate = useNavigate();
  const layoutMode = useDashboardLayoutMode();
  const { schedules: schedulesEnabled } = useFeatureFlags();
  const [tabValue, setTabValue] = useState(0);
  const [showAttendanceNames, setShowAttendanceNames] = useState(false);
  const [highlightSection, setHighlightSection] = useState<DashboardSectionKey | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const { data: users } = useUsersDemo();
  const { visits } = useAttendanceStore();
  const { staff } = useStaffStore();
  const {
    total: handoffTotal,
    byStatus: handoffStatus,
    criticalCount: handoffCritical,
  } = useHandoffSummary({ dayScope: 'today' });

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.slice(0, 7);
  const currentHour = new Date().getHours();
  const isMorningTime = currentHour >= 8 && currentHour < 12;
  const isEveningTime = currentHour >= 17 && currentHour < 19;

  const openTimeline = (scope: HandoffDayScope = 'today') => {
    navigate('/handoff-timeline', {
      state: { dayScope: scope, timeFilter: 'all' },
    });
  };

  const openBriefing = useCallback(() => {
    const tab = isMorningTime ? 'morning' : 'evening';
    navigate('/dashboard/briefing', { state: { tab } });
  }, [navigate, isMorningTime]);

  // Phase 1: anchor ID を常に全 8 個揃える（ロール関係なく）
  // これで scrollToSection(key) が undefined になることはない
  const sectionIdByKey = getDashboardAnchorIdByKey();

  // ===== 「本日の変更」用の仮データ =====
  const dateLabel = new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date()); // TODO: selectedDate を使う

  const todayChanges: TodayChanges = {
    userChanges: [
      // { id: 'u1', text: '山田：10:30来所', tone: 'info' },
      // { id: 'u2', text: '佐藤：休み', tone: 'warn' },
    ],
    staffChanges: [
      // { id: 's1', text: '高橋：9:30出勤', tone: 'info' },
    ],
  };

  const scrollToSection = useCallback(
    (sectionKeyOrAnchorId: DashboardSectionKey | string) => {
      // DashboardSectionKey の場合は sectionIdByKey で anchorId に変換
      // string（anchorId）の場合はそのまま使用
      const targetId = (sectionIdByKey as Record<string, string>)[sectionKeyOrAnchorId] ?? sectionKeyOrAnchorId;
      const node = document.getElementById(targetId);

      // ❌ 安全性：セクションが非表示でDOMにない場合
      // 例：staff ロールが staffOnly へスクロール指定 → DOM には sec-staff が存在しない
      if (!node) {
        console.warn(
          `[dashboard] section not found or hidden: ${sectionKeyOrAnchorId} -> #${targetId}`,
        );
        return;
      }

      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHighlightSection(sectionKeyOrAnchorId as DashboardSectionKey);
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightSection(null);
      }, 1400);
    },
    [sectionIdByKey],
  );

  // Get attendance counts (needed by useDashboardSummary)
  const attendanceCounts = useAttendanceCounts(today);

  // Call consolidated dashboard summary hook
  // (replaces 7 useMemo blocks: activityRecords, usageMap, stats, attendanceSummary, dailyRecordStatus, scheduleLanes, prioritizedUsers)
  const summary = useDashboardSummary({
    users,
    today,
    currentMonth,
    visits,
    staff,
    attendanceCounts,
    generateMockActivityRecords,
  });

  // Destructure all values from hook
  const {
    usageMap,
    stats,
    attendanceSummary,
    dailyRecordStatus,
    scheduleLanesToday,
    scheduleLanesTomorrow,
    prioritizedUsers,
    intensiveSupportUsers,
    briefingAlerts,  // ✨ 新規
    staffAvailability,  // ✨ Phase B: 職員フリー状態
  } = summary;

  // Keep development logging for usageMap
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug('[usageMap]', currentMonth, usageMap);
    }
  }, [usageMap, currentMonth]);

  const vm = useDashboardViewModel({
    role: audience,
    summary: {
      attendanceSummary,
      dailyRecordStatus,
      stats,
      handoff: {
        total: handoffTotal,
        byStatus: handoffStatus,
        critical: handoffCritical,
      },
      timing: {
        isMorningTime,
        isEveningTime,
      },
      briefingAlerts,  // ✨ 新規: ViewModel へ渡す
    },
  });

  // renderScheduleLanes → replaced by ScheduleLanesWidget component in StaffOnlySection

  const dailyStatusCards = [
    {
      label: '未入力',
      value: dailyRecordStatus.pending,
      helper: `対象 ${dailyRecordStatus.total}名`,
      color: 'error.main',
      emphasize: true,
    },
    {
      label: '入力途中',
      value: dailyRecordStatus.inProgress,
      helper: `対象 ${dailyRecordStatus.total}名`,
      color: 'warning.main',
    },
    {
      label: '完了',
      value: dailyRecordStatus.completed,
      helper: `対象 ${dailyRecordStatus.total}名`,
      color: 'text.secondary',
    },
  ];

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  useEffect(() => {
    if (!canAccessDashboardAudience(vm.role, 'admin')) return;
    const maxIndex = ADMIN_TABS.length - 1;
    if (tabValue > maxIndex) {
      setTabValue(0);
    }
  }, [vm.role, tabValue]);

  useEffect(() => () => {
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
  }, []);

  /**
   * セクションキーに基づいて、対応するコンポーネントに渡す props を生成する
   */
  const getSectionProps = useCallback((key: DashboardSectionKey, section: DashboardSection): SectionProps[typeof key] => {
    switch (key) {
      case 'safety':
        return {};
      case 'attendance':
        return {
          attendanceSummary,
          showAttendanceNames,
          onToggleAttendanceNames: setShowAttendanceNames,
          visits,
        };
      case 'daily':
        return {
          dailyStatusCards,
          dailyRecordStatus,
        };
      case 'schedule':
        return {
          title: section.title,
          schedulesEnabled,
          scheduleLanesToday,
        };
      case 'handover':
        return {
          title: section.title ?? '申し送りタイムライン',
          handoffTotal,
          handoffCritical,
          handoffStatus,
          onOpenTimeline: openTimeline,
        };
      case 'stats':
        return {
          stats,
          intensiveSupportUsersCount: intensiveSupportUsers.length,
        };
      case 'adminOnly':
        return {
          tabValue,
          onTabChange: handleTabChange,
          stats,
          intensiveSupportUsers,
          activeUsers: users,
          usageMap,
        };
      case 'staffOnly':
        return {
          isMorningTime,
          isEveningTime,
          dailyStatusCards,
          prioritizedUsers,
          scheduleLanesToday,
          scheduleLanesTomorrow,
          stats,
          onOpenTimeline: openTimeline,
        };
      default:
        throw new Error(`Unhandled dashboard section key: ${section.key}`);
    }
  }, [
    attendanceSummary,
    showAttendanceNames,
    dailyStatusCards,
    dailyRecordStatus,
    schedulesEnabled,
    scheduleLanesToday,
    handoffTotal,
    handoffCritical,
    handoffStatus,
    openTimeline,
    stats,
    intensiveSupportUsers,
    tabValue,
    handleTabChange,
    users,
    usageMap,
    isMorningTime,
    isEveningTime,
    prioritizedUsers,
    scheduleLanesTomorrow,
  ]);

  /**
   * Registry パターンでコンポーネントを取得して render する
   */
  const renderSection = useCallback((section: DashboardSection) => {
    // Role-based exclusion
    if (section.key === 'adminOnly' && vm.role !== 'admin') return null;
    if (section.key === 'staffOnly' && vm.role !== 'staff') return null;

    const SectionComponent = getSectionComponent(section.key);
    const props = getSectionProps(section.key, section);

    return <SectionComponent {...props} />;
  }, [getSectionProps, vm.role]);

  /**
   * Phase C-1: Zero-Scroll Layout のタブデータ準備
   * 利用者・職員・やることタブのデータを useMemo で計算
   */
  const zeroScrollTabs: DashboardTab[] = React.useMemo(() => {
    // 利用者タブのデータ
    const userTabData = {
      attendeeCount: attendanceSummary.facilityAttendees,
      absentUsers: attendanceSummary.absenceNames.map((name, index) => ({
        id: `absent-${index}`,
        name,
        reason: '理由未記入', // TODO: 実データから取得
      })),
      lateOrEarlyUsers: attendanceSummary.lateOrEarlyNames.map((name, index) => ({
        id: `late-${index}`,
        name,
        type: 'late' as const, // TODO: 実データで判別
      })),
    };

    // 職員タブのデータ
    const staffTabData = {
      staffAvailability,  // ✨ Phase B で計算済み
      absentStaff: [], // 外出中 status removed (Issue 1-1)
      lateOrAdjustStaff: [], // TODO: 実データから取得
    };

    // ✨ Phase C-2: やることタブのデータ（スケジュールから自動生成）
    const todoItems = generateTodosFromSchedule(scheduleLanesToday);



    return [
      {
        id: 'users',
        label: '利用者',
        count: userTabData.absentUsers.length + userTabData.lateOrEarlyUsers.length,
        component: <UserStatusTab {...userTabData} />,
      },
      {
        id: 'staff',
        label: '職員',
        count: staffTabData.absentStaff.length,
        component: <StaffStatusTab {...staffTabData} />,
      },
      {
        id: 'todo',
        label: 'やること',
        count: todoItems.length,
        component: <TodoTab todos={todoItems} />,
      },
    ];
  }, [attendanceSummary, staffAvailability, scheduleLanesToday]);

  return (
    <Container maxWidth="lg" data-testid="dashboard-page">
      <Box sx={{ py: { xs: 1.5, sm: 2, md: 2.5 } }}>
        {/* ヘッダー */}
        <PageHeader
          title="黒ノート"
          icon={<DashboardIcon />}
          actions={
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<AccessTimeIcon />}
                onClick={openBriefing}
                size="small"
                color="primary"
              >
                朝会・夕会情報
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  navigate('/room-management');
                }}
                size="small"
              >
                🏢 お部屋情報
              </Button>
            </Stack>
          }
        />

        <Stack spacing={{ xs: 2, sm: 3, md: 4 }} sx={{ mb: { xs: 2, sm: 3 } }}>
          {/* レイアウトモード別の描画 */}
          {layoutMode === 'zeroScroll' && (() => {
            const handoverSection = vm.orderedSections.find(s => s.key === 'handover');
            const leftContent = handoverSection ? renderSection(handoverSection) : (
              <Typography color="text.secondary">申し送り情報がありません</Typography>
            );
            return (
              <ZeroScrollLayout
                leftSection={leftContent}
                rightHeader={
                  <DashboardBriefingHUD
                    alerts={vm.briefingAlerts}
                    isBriefingTime={vm.contextInfo.isBriefingTime}
                    briefingType={vm.contextInfo.briefingType}
                    onNavigateTo={scrollToSection}
                  />
                }
                tabs={zeroScrollTabs}
              />
            );
          })()}

          {layoutMode === 'tabletLandscape' && (
            <>
              <DashboardBriefingHUD
                alerts={vm.briefingAlerts}
                isBriefingTime={vm.contextInfo.isBriefingTime}
                briefingType={vm.contextInfo.briefingType}
                onNavigateTo={scrollToSection}
              />
              <DashboardZoneLayout
                sections={vm.orderedSections}
                renderSection={renderSection}
                sectionIdByKey={sectionIdByKey}
                highlightSection={highlightSection}
                dateLabel={dateLabel}
                todayChanges={todayChanges}
              />
            </>
          )}

          {layoutMode === 'standard' && (
            <>
              <DashboardBriefingHUD
                alerts={vm.briefingAlerts}
                isBriefingTime={vm.contextInfo.isBriefingTime}
                briefingType={vm.contextInfo.briefingType}
                onNavigateTo={scrollToSection}
              />
              {vm.orderedSections.map((section) => (
                <Box
                  key={section.key}
                  id={sectionIdByKey[section.key]}
                  sx={(theme) => ({
                    scrollMarginTop: { xs: 80, sm: 96 },
                    transition: 'box-shadow 0.2s ease, outline-color 0.2s ease',
                    outline: highlightSection === section.key ? '2px solid' : '2px solid transparent',
                    outlineColor: highlightSection === section.key ? theme.palette.primary.main : 'transparent',
                    borderRadius: highlightSection === section.key ? 2 : 0,
                  })}
                >
                  {section.enabled === false ? null : renderSection(section)}
                </Box>
              ))}
            </>
          )}
        </Stack>

      </Box>

    </Container>
  );
};

export const AdminDashboardPage: React.FC = () => <DashboardPage audience="admin" />;
export const StaffDashboardPage: React.FC = () => <DashboardPage audience="staff" />;

export default DashboardPage;
