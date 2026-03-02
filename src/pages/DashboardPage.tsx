import { useFeatureFlags } from '@/config/featureFlags';
import { canAccessDashboardAudience, type DashboardAudience } from '@/features/auth/store';
import { getDashboardAnchorIdByKey } from '@/features/dashboard/sections/buildSections';
import type { Schedule } from '@/lib/mappers';
import { TESTIDS, tid } from '@/testids';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DashboardIcon from '@mui/icons-material/Dashboard';

import MedicalIcon from '@mui/icons-material/LocalHospital';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import BehaviorIcon from '@mui/icons-material/Psychology';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

import { getSectionComponent, type SectionProps } from '@/features/dashboard/sections/registry';
import { useTheme } from '@mui/material';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PersonDaily, SeizureRecord } from '../domain/daily/types';

import { useAttendanceStore } from '@/features/attendance/store';
import DashboardBriefingHUD from '@/features/dashboard/DashboardBriefingHUD';
import { generateTodosFromSchedule } from '@/features/dashboard/generateTodos';
import { ZeroScrollLayout, type DashboardTab } from '@/features/dashboard/layouts/ZeroScrollLayout';
import { StaffStatusTab } from '@/features/dashboard/tabs/StaffStatusTab';
import { TodoTab } from '@/features/dashboard/tabs/TodoTab';
import { UserStatusTab } from '@/features/dashboard/tabs/UserStatusTab';
import { useDashboardSummary } from '@/features/dashboard/useDashboardSummary';
import { useDashboardViewModel, type DashboardSection, type DashboardSectionKey } from '@/features/dashboard/useDashboardViewModel';
import type { AttendanceCounts } from '@/features/staff/attendance/port';
import { getStaffAttendancePort } from '@/features/staff/attendance/storage';
import { useStaffStore } from '@/features/staff/store';
import type { HandoffDayScope } from '../features/handoff/handoffTypes';
import { useHandoffSummary } from '../features/handoff/useHandoffSummary';
import { useUsersDemo } from '../features/users/usersStoreDemo';
import { IUserMaster } from '../sharepoint/fields';

const useAttendanceCounts = (recordDate: string): AttendanceCounts => {
  const [counts, setCounts] = useState<AttendanceCounts>({
    onDuty: 0,
    out: 0,
    absent: 0,
    total: 0,
  });

  useEffect(() => {
    let active = true;

    (async () => {
      const port = getStaffAttendancePort();
      const res = await port.countByDate(recordDate);
      if (!active) return;

      if (res.isOk) {
        setCounts(res.value);
      } else {
        console.warn('[attendance] countByDate failed', res.error);
        setCounts({ onDuty: 0, out: 0, absent: 0, total: 0 });
      }
    })();

    return () => {
      active = false;
    };
  }, [recordDate]);

  return counts;
};

// モック支援記録（ケース記録）データ生成
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
interface DashboardPageProps {
  audience?: DashboardAudience;
}

export type StaffConflict = {
  kind: 'staff-overlap';
  staffId: string;
  scheduleIds: string[];
  message: string;
};

type ConflictSchedule = Pick<Schedule, 'id' | 'staffIds'>;

export function calculateStaffConflicts(
  schedules: readonly ConflictSchedule[] | null | undefined,
): StaffConflict[] {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return [];
  }

  const perStaff = new Map<string, string[]>();

  for (const schedule of schedules) {
    if (!schedule) continue;
    const scheduleId = schedule.id != null ? String(schedule.id) : '';
    if (!scheduleId) continue;

    const staffIds = Array.isArray(schedule.staffIds) ? schedule.staffIds : [];
    for (const rawStaffId of staffIds) {
      const staffId = typeof rawStaffId === 'string' ? rawStaffId.trim() : '';
      if (!staffId) continue;
      const bucket = perStaff.get(staffId) ?? [];
      bucket.push(scheduleId);
      perStaff.set(staffId, bucket);
    }
  }

  const conflicts: StaffConflict[] = [];
  for (const [staffId, ids] of perStaff) {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length <= 1) continue;
    conflicts.push({
      kind: 'staff-overlap',
      staffId,
      scheduleIds: uniqueIds,
      message: `スタッフ ${staffId} の時間重複`,
    });
  }

  return conflicts;
}

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
  const location = useLocation();
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

  type ScheduleItem = {
    id: string;
    time: string;
    title: string;
    location?: string;
    owner?: string;
  };

  const renderScheduleLanes = (title: string, lanes: { userLane: ScheduleItem[]; staffLane: ScheduleItem[]; organizationLane: ScheduleItem[] }) => (
    <Card>
      <CardContent sx={{ py: 1.25, px: 1.5 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          📅 {title}
        </Typography>
        <Grid container spacing={2}>
          {[
            { label: '利用者レーン', items: lanes.userLane },
            { label: '職員レーン', items: lanes.staffLane },
            { label: '組織レーン', items: lanes.organizationLane },
          ].map(({ label, items }) => (
            <Grid key={label} size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle2" component="span" sx={{ fontWeight: 700, mb: 1 }}>
                  {label}
                </Typography>
                <List dense>
                  {items.map((item) => (
                    <ListItem key={item.id} disableGutters>
                      <ListItemText
                        primary={`${item.time} ${item.title}`}
                        secondary={item.location ? `場所: ${item.location}` : item.owner ? `担当: ${item.owner}` : undefined}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );

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
          renderScheduleLanes,
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
    renderScheduleLanes,
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
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box>
              <Typography variant="h4" component="h1">
                <DashboardIcon sx={{ verticalAlign: 'middle', mr: 2 }} />
                黒ノート
              </Typography>
            </Box>

            {/* 朝会・夕会情報、お部屋情報ボタン */}
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
          </Box>
        </Box>

        <Stack spacing={{ xs: 2, sm: 3, md: 4 }} sx={{ mb: { xs: 2, sm: 3 } }}>
          {(() => {
            const searchParams = new URLSearchParams(location.search);
            const tabletParam = searchParams.get('tablet');
            const zeroScrollParam = searchParams.get('zeroscroll');
            const forceTablet = tabletParam === '1';
            // Zero-Scrollをデフォルトで有効化（?zeroscroll=0 で無効化可能）
            const forceZeroScroll = zeroScrollParam !== '0';
            const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
            const meetsWidth = windowWidth >= 1024;
            const isTabletLandscape = forceTablet || meetsWidth;

            // Debug: コンソールに出力
            if (typeof window !== 'undefined') {
              console.log('[Dashboard Layout Debug]', {
                'URL': location.search,
                'tablet param': tabletParam,
                'zeroscroll param': zeroScrollParam,
                'forceTablet': forceTablet,
                'forceZeroScroll': forceZeroScroll,
                'window.innerWidth': windowWidth,
                'meetsWidth (>=1024)': meetsWidth,
                'isTabletLandscape (final)': isTabletLandscape,
              });
            }

            // Phase C-1: Zero-Scroll Layout（デフォルト有効、?zeroscroll=0 で無効化可能）
            if (forceZeroScroll) {
              // 左ペイン: 申し送りセクション
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
            }

            if (isTabletLandscape) {
              return (
                <>
                  {/* ✨ 朝会・夕会HUD（アラート表示） */}
                  <DashboardBriefingHUD
                    alerts={vm.briefingAlerts}
                    isBriefingTime={vm.contextInfo.isBriefingTime}
                    briefingType={vm.contextInfo.briefingType}
                    onNavigateTo={scrollToSection}
                  />
                  <DashboardZoneLayout
                    sections={vm.orderedSections}  // ✨ orderedSections を使用
                    renderSection={renderSection}
                    sectionIdByKey={sectionIdByKey}
                    highlightSection={highlightSection}
                    dateLabel={dateLabel}
                    todayChanges={todayChanges}
                  />
                </>
              );
            }

            return (
              <>
                {/* ✨ 朝会・夕会HUD（アラート表示） */}
                <DashboardBriefingHUD
                  alerts={vm.briefingAlerts}
                  isBriefingTime={vm.contextInfo.isBriefingTime}
                  briefingType={vm.contextInfo.briefingType}
                  onNavigateTo={scrollToSection}
                />
                {vm.orderedSections.map((section) => (  // ✨ orderedSections を使用
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
            );
          })()}
        </Stack>

      </Box>

    </Container>
  );
};

// ===== 「本日の変更」コンポーネント群 =====

type ChangeItem = {
  id: string;
  text: string;
  tone?: 'info' | 'warn';
};

type TodayChanges = {
  userChanges: ChangeItem[];
  staffChanges: ChangeItem[];
};

function ChangeSection(props: { title: string; items: ChangeItem[] }) {
  const { title, items } = props;

  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" sx={{ opacity: 0.85 }} fontWeight={700}>
        {title}
      </Typography>

      <Stack spacing={0.5}>
        {items.map((it) => (
          <Alert
            key={it.id}
            severity={it.tone === 'warn' ? 'warning' : 'info'}
            variant="outlined"
            sx={{
              py: 0.25,
              '& .MuiAlert-message': { py: 0 },
              borderRadius: 1,
            }}
          >
            <Typography variant="body2">{it.text}</Typography>
          </Alert>
        ))}
      </Stack>
    </Stack>
  );
}

function TodayChangesCard(props: {
  dateLabel: string;
  changes: TodayChanges;
}) {
  const { dateLabel, changes } = props;

  const hasAny = changes.userChanges.length > 0 || changes.staffChanges.length > 0;

  // ダミー生活支援情報（後で実データに）
  const lifeSupportDummy = [
    { type: '一時ケア', name: '山田', time: '10:00-11:00', transport: 'あり', staff: '佐藤' },
    { type: 'SS', name: '鈴木', time: '15:00-16:00', transport: 'なし', staff: '高橋' },
  ];

  // 2件以下の場合は3件未満、3件以上の場合は多件
  const lifeSupportVisible = lifeSupportDummy.slice(0, 2);
  const lifeSupportHasMore = lifeSupportDummy.length > 2;

  // 生活支援を2行テキストにまとめる（line-clamp用）
  const lifeSupportLines = lifeSupportVisible.map((it) =>
    `${it.type}：${it.name}(${it.time}) ${it.transport}`
  );
  const lifeSupportText = lifeSupportLines.join('\n');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1} sx={{ pb: 0.5 }}>
        <Typography variant="caption" fontWeight={700} sx={{ opacity: 0.8 }}>
          本日の確認
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          {dateLabel}
        </Typography>
      </Stack>

      <Box
        sx={{
          minHeight: 0,
          overflowX: 'hidden',
          overflowY: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 上段：本日の変更（自然高さ、スクロールなし） */}
        <Box sx={{ flex: '0 0 auto' }}>
          <Typography variant="caption" fontWeight={700} sx={{ opacity: 0.75, display: 'block', mb: 0.5 }}>
            変更
          </Typography>
          {hasAny ? (
            <Stack spacing={0.5}>
              <ChangeSection title="利用者" items={changes.userChanges} />
              <ChangeSection title="職員" items={changes.staffChanges} />
            </Stack>
          ) : (
            <Box sx={{ userSelect: 'none' }}>
              <Typography variant="body2" noWrap sx={{ opacity: 0.85 }}>
                利用者：なし
              </Typography>
              <Typography variant="body2" noWrap sx={{ opacity: 0.85 }}>
                職員：なし
              </Typography>
            </Box>
          )}
        </Box>

        <Divider sx={{ opacity: 0.3, flexShrink: 0 }} />

        {/* 下段：生活支援情報（2行固定表示） */}
        <Box
          sx={{
            flex: '1 0 auto',
            minHeight: 0,
            overflow: 'hidden',
            pb: 1,
          }}
        >
          <Typography variant="caption" fontWeight={700} sx={{ opacity: 0.75, display: 'block', mb: 0.5 }}>
            生活支援
          </Typography>
          {lifeSupportDummy.length > 0 ? (
            <>
              <Typography
                variant="body2"
                sx={{
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  lineHeight: '20px',
                  maxHeight: '48px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'pre-line',
                  opacity: 0.8,
                  pr: 0.5,
                }}
              >
                {lifeSupportText}
              </Typography>
              {lifeSupportHasMore && (
                <Typography variant="caption" sx={{ opacity: 0.6, mt: 0.25 }}>
                  ほか +{lifeSupportDummy.length - 2}件
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              対応なし（✓確認済み）
            </Typography>
          )}
        </Box>

        <span style={{ position: 'absolute', left: -9999, top: -9999 }}>
          本日の確認情報：変更なし、生活支援対応なし
        </span>
      </Box>
    </Box>
  );
}

// ⸻
// Zone 1: 朝30秒判断ゾーン（固定）
// 左：申し送りタイムライン（主役・最大）
// 右：本日の変更HUD（小・補助）
// ⸻
type Zone1_MorningDecisionProps = {
  handoverNode: React.ReactNode;
  dateLabel: string;
  todayChanges: TodayChanges;
};

const Zone1_MorningDecision: React.FC<Zone1_MorningDecisionProps> = ({
  handoverNode,
  dateLabel,
  todayChanges,
}) => {
  return (
    <Box
      data-testid="dashboard-zone-briefing"
      sx={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 2,
        alignItems: 'start',
      }}
    >
      {/* 左（50%）：申し送りタイムライン（主役・最大） */}
      <Box>
        {handoverNode}
      </Box>

      {/* 中（25%）：本日の変更HUD */}
      <Box>
        <TodayChangesCard dateLabel={dateLabel} changes={todayChanges} />
      </Box>
    </Box>
  );
};

// ⸻
// Zone 2-3: スクロール領域（1カラム）
// Zone 2: 今日の予定（主役）
// Zone 3: 集計・作業（補助）
// ⸻
type DashboardZoneLayoutProps = {
  sections: DashboardSection[];
  renderSection: (section: DashboardSection) => React.ReactNode;
  sectionIdByKey: Record<DashboardSectionKey, string>;
  highlightSection?: DashboardSectionKey | null;
  dateLabel: string;
  todayChanges: TodayChanges;
};

const DashboardZoneLayout: React.FC<DashboardZoneLayoutProps> = ({
  sections,
  renderSection,
  sectionIdByKey,
  highlightSection,
  dateLabel,
  todayChanges,
}) => {
  const theme = useTheme();
  const getSection = (key: DashboardSectionKey) => sections.find((s) => s.key === key);
  const renderSectionIfEnabled = (key: DashboardSectionKey) => {
    const section = getSection(key);
    if (!section || section.enabled === false) return null;
    return (
      <Box
        key={section.key}
        id={sectionIdByKey[key]}
        sx={{
          scrollMarginTop: 96,
          transition: 'box-shadow 0.2s ease, outline-color 0.2s ease',
          outline: highlightSection === key ? '2px solid' : '2px solid transparent',
          outlineColor: highlightSection === key ? theme.palette.primary.main : 'transparent',
          borderRadius: highlightSection === key ? 2 : 0,
        }}
      >
        {renderSection(section)}
      </Box>
    );
  };

  const FOOTER_H = 56;

  return (
    <Box
      data-testid={tid(TESTIDS['dashboard-page'])}
      sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* ZONE 1: 朝30秒判断ゾーン（sticky wrapper 分離） */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: 'background.default',
        }}
      >
        {/* 内部コンテンツ（通常レイアウト） */}
        <Box sx={{ pb: 2 }}>
          <Zone1_MorningDecision
            handoverNode={renderSectionIfEnabled('handover')}
            dateLabel={dateLabel}
            todayChanges={todayChanges}
          />
        </Box>
      </Box>

      {/* ZONE 2-3: スクロール領域（1カラム） */}
      <Box
        sx={{
          overflowY: 'auto',
          flex: 1,
          pr: 1,
          pb: `${FOOTER_H}px`,
        }}
      >
        <Stack spacing={3}>
          {/* ZONE 2: 今日の予定（主役） */}
          <Box data-testid="dashboard-zone-today">
            {renderSectionIfEnabled('schedule')}
          </Box>

          {/* ZONE 3: 集計・作業（補助） */}
          <Box data-testid="dashboard-zone-work">
            {renderSectionIfEnabled('safety')}
            {renderSectionIfEnabled('attendance')}
            {renderSectionIfEnabled('daily')}
            {renderSectionIfEnabled('stats')}
            {renderSectionIfEnabled('adminOnly')}
            {renderSectionIfEnabled('staffOnly')}
          </Box>
        </Stack>
      </Box>
    </Box>
  );
};

export const AdminDashboardPage: React.FC = () => <DashboardPage audience="admin" />;
export const StaffDashboardPage: React.FC = () => <DashboardPage audience="staff" />;

export default DashboardPage;
