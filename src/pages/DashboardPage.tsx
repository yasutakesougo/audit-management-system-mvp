import { useFeatureFlags } from '@/config/featureFlags';
import type { DashboardAudience } from '@/features/auth/store';
import { HYDRATION_FEATURES, estimatePayloadSize, startFeatureSpan } from '@/hydration/features';
import { TESTIDS, tid } from '@/testids';
import type { Schedule } from '@/lib/mappers';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import MedicalIcon from '@mui/icons-material/LocalHospital';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import PersonIcon from '@mui/icons-material/Person';
import BehaviorIcon from '@mui/icons-material/Psychology';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningIcon from '@mui/icons-material/Warning';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { alpha } from '@mui/material/styles';
import { Link, useNavigate } from 'react-router-dom';
import { PersonDaily, SeizureRecord } from '../domain/daily/types';
import DashboardSafetyHUD from '@/features/dashboard/DashboardSafetyHUD';
import { useDashboardViewModel, type DashboardSection } from '@/features/dashboard/useDashboardViewModel';
import { useAttendanceStore } from '@/features/attendance/store';
import { useStaffStore } from '@/features/staff/store';
import HandoffSummaryForMeeting from '../features/handoff/HandoffSummaryForMeeting';
import type { HandoffDayScope } from '../features/handoff/handoffTypes';
import { useHandoffSummary } from '../features/handoff/useHandoffSummary';
import UsageStatusDashboard from '../features/users/UsageStatusDashboard.v2';
import { calculateUsageFromDailyRecords } from '../features/users/userMasterDashboardUtils';
import { useUsersDemo } from '../features/users/usersStoreDemo';
import type { AttendanceCounts } from '@/features/staff/attendance/port';
import { getStaffAttendancePort } from '@/features/staff/attendance/storage';
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
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ paddingTop: '16px' }}>
    {value === index && children}
  </div>
);

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
  const { schedules: schedulesEnabled } = useFeatureFlags();
  const [tabValue, setTabValue] = useState(0);
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

  // 支援記録（ケース記録）データ（モック）
  // TODO: 実データ接続時は SharePoint / PersonDaily 由来の記録で置き換える
  const activityRecords = useMemo(() => {
    const span = startFeatureSpan(HYDRATION_FEATURES.dashboard.activityModel, {
      status: 'pending',
      users: users.length,
    });
    try {
      const records = generateMockActivityRecords(users, today);
      span({
        meta: {
          status: 'ok',
          recordCount: records.length,
          bytes: estimatePayloadSize(records),
        },
      });
      return records;
    } catch (error) {
      span({
        meta: { status: 'error' },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [users, today]);

  // 支援記録（activityRecords）が保持する日付・利用者IDから月次利用実績を集計（完了記録のみカウント）
  const usageMap = useMemo(() => {
    const span = startFeatureSpan(HYDRATION_FEATURES.dashboard.usageAggregation, {
      status: 'pending',
      month: currentMonth,
    });
    try {
      const map = calculateUsageFromDailyRecords(activityRecords, users, currentMonth, {
        userKey: (record) => String(record.personId ?? ''),
        dateKey: (record) => record.date ?? '',
        countRule: (record) => record.status === '完了',
      });
      const entryCount = map && typeof map === 'object'
        ? Object.keys(map as Record<string, unknown>).length
        : 0;
      span({
        meta: {
          status: 'ok',
          entries: entryCount,
          bytes: estimatePayloadSize(map),
        },
      });
      return map;
    } catch (error) {
      span({
        meta: { status: 'error' },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [activityRecords, users, currentMonth]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug('[usageMap]', currentMonth, usageMap);
    }
  }, [usageMap, currentMonth]);

  // 強度行動障害対象者
  const intensiveSupportUsers = users.filter(user => user.IsSupportProcedureTarget);

  // 統計計算
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const recordedUsers = activityRecords.filter(r => r.status === '完了').length;
    const completionRate = totalUsers > 0 ? (recordedUsers / totalUsers) * 100 : 0;

    // 問題行動統計
    const problemBehaviorStats = activityRecords.reduce((acc, record) => {
      const pb = record.data.problemBehavior;
      if (pb) {
        if (pb.selfHarm) acc.selfHarm++;
        if (pb.violence) acc.violence++;
        if (pb.loudVoice) acc.loudVoice++;
        if (pb.pica) acc.pica++;
        if (pb.other) acc.other++;
      }
      return acc;
    }, { selfHarm: 0, violence: 0, loudVoice: 0, pica: 0, other: 0 });

    // 発作統計
    const seizureCount = activityRecords.filter(r =>
      r.data.seizureRecord && r.data.seizureRecord.occurred
    ).length;

    // 昼食摂取統計
    const lunchStats = activityRecords.reduce((acc, record) => {
      const amount = record.data.mealAmount || 'なし';
      acc[amount] = (acc[amount] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUsers,
      recordedUsers,
      completionRate,
      problemBehaviorStats,
      seizureCount,
      lunchStats
    };
  }, [users, activityRecords]);

  const attendanceCounts = useAttendanceCounts(today);

  const attendanceSummary = useMemo(() => {
    const visitList = Object.values(visits);
    const userCodeMap = new Map<string, string>();

    users.forEach((user, index) => {
      const userCode = (user.UserID ?? '').trim() || `U${String(user.Id ?? index + 1).padStart(3, '0')}`;
      const displayName = user.FullName ?? `利用者${index + 1}`;
      userCodeMap.set(userCode, displayName);
    });

    const facilityAttendees = visitList.filter(
      (visit) => visit.status === '通所中' || visit.status === '退所済'
    ).length;

    const lateOrEarlyLeave = visitList.filter((visit) => visit.isEarlyLeave === true).length;
    const absenceVisits = visitList.filter((visit) => visit.status === '当日欠席' || visit.status === '事前欠席');
    const absenceNames = Array.from(
      new Set(
        absenceVisits
          .map((visit) => userCodeMap.get(visit.userCode))
          .filter((name): name is string => Boolean(name))
      )
    );
    const absenceCount = absenceVisits.length;

    // Get actual staff attendance via port (Phase 3.1-C)
    const onDutyStaff = attendanceCounts.onDuty;

    // Fallback to demo data if no attendance records yet
    const staffCount = staff.length || 0;
    const estimatedOnDutyStaff = Math.max(0, Math.round(staffCount * 0.6));
    const finalOnDutyStaff = onDutyStaff > 0 ? onDutyStaff : estimatedOnDutyStaff;

    const lateOrShiftAdjust = Math.max(0, Math.round(finalOnDutyStaff * 0.15));
    const outStaff = Math.max(0, Math.round(finalOnDutyStaff * 0.2));

    return {
      facilityAttendees,
      lateOrEarlyLeave,
      absenceCount,
      absenceNames,
      onDutyStaff: finalOnDutyStaff,
      lateOrShiftAdjust,
      outStaff,
    };
  }, [attendanceCounts.onDuty, staff.length, users, visits]);

  const dailyRecordStatus = useMemo(() => {
    const total = users.length;
    const completed = activityRecords.filter((record) => record.status === '完了').length;
    const inProgress = activityRecords.filter((record) => record.status === '作成中').length;
    const pending = Math.max(total - completed - inProgress, 0);

    return {
      total,
      pending,
      inProgress,
      completed,
    };
  }, [activityRecords, users.length]);

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
    },
  });

  type ScheduleItem = {
    id: string;
    time: string;
    title: string;
    location?: string;
    owner?: string;
  };

  const [scheduleLanesToday, scheduleLanesTomorrow] = useMemo<[
    { userLane: ScheduleItem[]; staffLane: ScheduleItem[]; organizationLane: ScheduleItem[] },
    { userLane: ScheduleItem[]; staffLane: ScheduleItem[]; organizationLane: ScheduleItem[] },
  ]>(() => {
    const baseUserLane = users.slice(0, 3).map((user, index) => ({
      id: `user-${index}`,
      time: `${(9 + index).toString().padStart(2, '0')}:00`,
      title: `${user.FullName ?? `利用者${index + 1}`} ${['作業プログラム', '個別支援', 'リハビリ'][index % 3]}`,
      location: ['作業室A', '相談室1', '療育室'][index % 3],
    }));
    const baseStaffLane = [
      { id: 'staff-1', time: '08:45', title: '職員朝会 / 申し送り確認', owner: '生活支援課' },
      { id: 'staff-2', time: '11:30', title: '通所記録レビュー', owner: '管理責任者' },
      { id: 'staff-3', time: '15:30', title: '支援手順フィードバック会議', owner: '専門職チーム' },
    ];
    const baseOrganizationLane: ScheduleItem[] = [
      { id: 'org-1', time: '10:00', title: '自治体監査ヒアリング', owner: '法人本部' },
      { id: 'org-2', time: '13:30', title: '家族向け連絡会資料確認', owner: '連携推進室' },
      { id: 'org-3', time: '16:00', title: '設備点検結果共有', owner: '施設管理' },
    ];

    const today = {
      userLane: baseUserLane,
      staffLane: baseStaffLane,
      organizationLane: baseOrganizationLane,
    };

    const tomorrow = {
      userLane: baseUserLane,
      staffLane: baseStaffLane,
      organizationLane: baseOrganizationLane,
    };

    return [today, tomorrow];
  }, [users]);

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
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
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

  const prioritizedUsers = useMemo(() => intensiveSupportUsers.slice(0, 3), [intensiveSupportUsers]);

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
    if (vm.role !== 'admin') return;
    const maxIndex = ADMIN_TABS.length - 1;
    if (tabValue > maxIndex) {
      setTabValue(0);
    }
  }, [vm.role, tabValue]);

  const assertNever = (value: never): never => {
    throw new Error(`Unhandled dashboard section key: ${String(value)}`);
  };

  const renderSection = useCallback((section: DashboardSection) => {
    switch (section.key) {
      case 'safety':
        return <DashboardSafetyHUD />;
      case 'attendance':
        return (
          <Paper elevation={3} sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              justifyContent="space-between"
              sx={{ mb: 2 }}
            >
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" lineHeight={1.2} sx={{ fontWeight: 700 }}>
                  {section.title ?? '今日の通所 / 出勤状況'}
                </Typography>
                <Typography variant="caption" lineHeight={1.3} color="text.secondary">
                  利用者と職員の通所・出勤の状況をまとめて確認できます。
                </Typography>
              </Stack>
              <Stack
                spacing={0.75}
                alignItems={{ xs: 'flex-start', md: 'flex-end' }}
                sx={{ width: { xs: '100%', md: 'auto' }, minWidth: 180 }}
              >
                <Stack direction="row" spacing={1} flexWrap="nowrap" useFlexGap>
                  <Button variant="contained" size="small" component={Link} to="/daily/attendance">
                    通所入力
                  </Button>
                  <Button variant="outlined" size="small" component={Link} to="/staff/attendance">
                    職員出勤
                  </Button>
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="nowrap" useFlexGap>
                  <Button variant="text" size="small" component={Link} to="/daily/activity">
                    支援記録
                  </Button>
                  <Button variant="text" size="small" component={Link} to="/handoff-timeline">
                    申し送り
                  </Button>
                </Stack>
              </Stack>
            </Stack>
            <Grid container spacing={{ xs: 2, sm: 2, md: 3 }} sx={{ mt: 2 }}>
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <Typography variant="h4" color="primary" sx={{ fontWeight: 800 }}>
                  {attendanceSummary.facilityAttendees}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  施設通所
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <Typography variant="h4" color="success.main" sx={{ fontWeight: 800 }}>
                  {attendanceSummary.lateOrEarlyLeave}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  遅刻・早退
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <Tooltip
                  title={(
                    <Stack spacing={0.5} sx={{ p: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        欠席者
                      </Typography>
                      {attendanceSummary.absenceNames?.length ? (
                        <>
                          {attendanceSummary.absenceNames.slice(0, 6).map((name) => (
                            <Typography key={name} variant="caption">
                              {name}
                            </Typography>
                          ))}
                          {attendanceSummary.absenceNames.length > 6 && (
                            <Typography variant="caption" color="text.secondary">
                              他{attendanceSummary.absenceNames.length - 6}名
                            </Typography>
                          )}
                        </>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          該当者なし
                        </Typography>
                      )}
                    </Stack>
                  )}
                  arrow
                  placement="top"
                  disableHoverListener={!attendanceSummary.absenceNames?.length}
                >
                  <Box sx={{ cursor: attendanceSummary.absenceNames?.length ? 'pointer' : 'default' }}>
                    <Typography variant="h4" color="warning.main" sx={{ fontWeight: 800 }}>
                      {attendanceSummary.absenceCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      欠席
                    </Typography>
                  </Box>
                </Tooltip>
              </Grid>
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <Typography variant="h4" color="text.primary" sx={{ fontWeight: 800 }}>
                  {attendanceSummary.onDutyStaff}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  出勤職員
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <Typography variant="h4" color="secondary.main" sx={{ fontWeight: 800 }}>
                  {attendanceSummary.lateOrShiftAdjust}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  シフト調整
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <Typography variant="h4" color="info.main" sx={{ fontWeight: 800 }}>
                  {attendanceSummary.outStaff}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  外出スタッフ
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        );
      case 'daily':
        return (
          <Paper elevation={3} sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              justifyContent="space-between"
              sx={{ mb: 2 }}
            >
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" lineHeight={1.2} sx={{ fontWeight: 700 }}>
                  ケース記録：未入力があります
                </Typography>
                <Typography variant="caption" lineHeight={1.3} color="text.secondary">
                  未入力を優先して、入力と確認を進められます。
                </Typography>
              </Stack>
              <Stack
                spacing={0.75}
                alignItems={{ xs: 'flex-start', md: 'flex-end' }}
                sx={{ width: { xs: '100%', md: 'auto' }, minWidth: 180 }}
              >
                <Stack direction="row" spacing={1} flexWrap="nowrap" useFlexGap>
                  <Button
                    variant="contained"
                    size="small"
                    component={Link}
                    to="/daily/activity"
                    disabled={dailyRecordStatus.pending === 0}
                  >
                    未入力を入力する
                  </Button>
                  <Button variant="text" size="small" component={Link} to="/daily/table">
                    一覧を見る
                  </Button>
                </Stack>
              </Stack>
            </Stack>
            <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mt: 1 }}>
              {dailyStatusCards.map(({ label, value, helper, color, emphasize }) => {
                return (
                  <Grid key={label} size={{ xs: 12, md: 4 }}>
                    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, height: '100%' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {label}
                      </Typography>
                      <Typography
                        variant="h4"
                        sx={{ fontWeight: emphasize ? 800 : 700, color, mt: 1 }}
                      >
                        {value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {helper}
                      </Typography>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </Paper>
        );
      case 'schedule':
        return (
          <Paper elevation={3} sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              justifyContent="space-between"
              sx={{ mb: 1.5 }}
            >
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {section.title ?? '今日の予定'}
              </Typography>
              {schedulesEnabled && (
                <Button
                  variant="outlined"
                  startIcon={<EventAvailableRoundedIcon />}
                  component={Link}
                  to="/schedules/week"
                  sx={{ alignSelf: { xs: 'stretch', sm: 'auto' } }}
                >
                  マスタースケジュールを開く
                </Button>
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              レーンごとの進行状況を確認できます。
            </Typography>
            <Grid container spacing={2}>
              {[
                { label: '利用者レーン', items: scheduleLanesToday.userLane },
                { label: '職員レーン', items: scheduleLanesToday.staffLane },
                { label: '組織レーン', items: scheduleLanesToday.organizationLane },
              ].map(({ label, items }) => (
                <Grid key={label} size={{ xs: 12, md: 4 }}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                      {label}
                    </Typography>
                    <List dense>
                      {items.map((item) => (
                        <ListItem key={item.id} disableGutters alignItems="flex-start" sx={{ py: 0.5 }}>
                          <ListItemText
                            primary={`${item.time} ${item.title}`}
                            secondary={item.location ? `場所: ${item.location}` : item.owner ? `担当: ${item.owner}` : undefined}
                            primaryTypographyProps={{ fontWeight: 600 }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        );
      case 'handover':
        return (
          <Paper elevation={3} sx={{ p: 3 }} {...tid(TESTIDS['dashboard-handoff-summary'])}>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
              >
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="subtitle2" lineHeight={1.2} sx={{ fontWeight: 700 }}>
                      {section.title ?? '申し送りタイムライン'}
                    </Typography>
                    {handoffCritical > 0 && (
                      <Chip
                        size="small"
                        color="error"
                        variant="filled"
                        label={`重要・未完了 ${handoffCritical}件`}
                      />
                    )}
                  </Stack>
                  <Typography variant="caption" lineHeight={1.3} color="text.secondary">
                    今日の申し送り状況を把握して、必要に応じて詳細を確認してください。
                  </Typography>
                </Stack>
                <Stack
                  spacing={0.75}
                  alignItems={{ xs: 'flex-start', md: 'flex-end' }}
                  sx={{ width: { xs: '100%', md: 'auto' }, minWidth: 180 }}
                >
                  <Stack direction="row" spacing={1} flexWrap="nowrap" useFlexGap>
                    <Button
                      variant="contained"
                      startIcon={<AccessTimeIcon />}
                      onClick={() => openTimeline('today')}
                      size="small"
                    >
                      タイムラインを開く
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="nowrap" useFlexGap>
                    <Button variant="text" size="small" onClick={() => openTimeline('yesterday')}>
                      前日の申し送り
                    </Button>
                    <Button variant="text" size="small" component={Link} to="/handoff-timeline">
                      一覧を見る
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
              {handoffTotal > 0 ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    color="warning"
                    variant={handoffStatus['未対応'] > 0 ? 'filled' : 'outlined'}
                    label={`未対応 ${handoffStatus['未対応']}件`}
                    {...tid(TESTIDS['dashboard-handoff-summary-alert'])}
                  />
                  <Chip
                    size="small"
                    color="info"
                    variant={handoffStatus['対応中'] > 0 ? 'filled' : 'outlined'}
                    label={`対応中 ${handoffStatus['対応中']}件`}
                    {...tid(TESTIDS['dashboard-handoff-summary-action'])}
                  />
                  <Chip
                    size="small"
                    color="success"
                    variant={handoffStatus['対応済'] > 0 ? 'filled' : 'outlined'}
                    label={`対応済 ${handoffStatus['対応済']}件`}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`合計 ${handoffTotal}件`}
                    {...tid(TESTIDS['dashboard-handoff-summary-total'])}
                  />
                </Stack>
              ) : (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  まだ今日の申し送りは登録されていません。気づいたことがあれば /handoff-timeline から追加できます。
                </Alert>
              )}
            </Stack>
          </Paper>
        );
      case 'stats':
        return (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
              <Typography variant="h4" color="primary">
                {stats.totalUsers}名
              </Typography>
              <Typography variant="body2" color="text.secondary">
                総利用者数
              </Typography>
            </Paper>

            <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
              <Typography variant="h4" color="success.main">
                {stats.recordedUsers}名
              </Typography>
              <Typography variant="body2" color="text.secondary">
                本日記録完了
              </Typography>
              <Box sx={{ mt: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={stats.completionRate}
                  sx={{ height: 6, borderRadius: 3 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {Math.round(stats.completionRate)}%
                </Typography>
              </Box>
            </Paper>

            <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
              <Typography variant="h4" color="secondary.main">
                {intensiveSupportUsers.length}名
              </Typography>
              <Typography variant="body2" color="text.secondary">
                強度行動障害対象者
              </Typography>
            </Paper>

            <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
              <Typography variant="h4" color={stats.seizureCount > 0 ? 'error.main' : 'success.main'}>
                {stats.seizureCount}件
              </Typography>
              <Typography variant="body2" color="text.secondary">
                本日発作記録
              </Typography>
            </Paper>
          </Stack>
        );
      case 'adminOnly':
        return vm.role === 'admin' ? (
          <>
            {/* タブナビゲーション */}
            <Card sx={{ mb: 3 }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
              >
                {ADMIN_TABS.map((tab) => (
                  <Tab
                    key={tab.label}
                    label={tab.label}
                    icon={tab.icon}
                    iconPosition="start"
                  />
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
                        label={`暴力: ${stats.problemBehaviorStats.violence}件`}
                        color={stats.problemBehaviorStats.violence > 0 ? 'error' : 'default'}
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

            {/* 利用状況 */}
            <TabPanel value={tabValue} index={1}>
              <UsageStatusDashboard
                users={users.filter(user => user.UsageStatus === '利用中')}
                usageMap={usageMap}
              />
            </TabPanel>

            {/* 問題行動サマリー */}
            <TabPanel value={tabValue} index={2}>
              <Stack spacing={2}>
                {stats.problemBehaviorStats.selfHarm > 0 && (
                  <Alert severity="error" icon={<WarningIcon />}>
                    本日、自傷行動が{stats.problemBehaviorStats.selfHarm}件発生しています。該当者の個別対応を確認してください。
                  </Alert>
                )}
                {stats.problemBehaviorStats.violence > 0 && (
                  <Alert severity="error" icon={<WarningIcon />}>
                    本日、暴力行動が{stats.problemBehaviorStats.violence}件発生しています。環境調整・支援方法の見直しを検討してください。
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
                      詳細な対応記録と改善傾向の分析は個別の支援記録（ケース記録）をご確認ください。
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
                  強度行動障害対象者 支援手順記録
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
                          <Chip label="支援手順記録対象" color="info" size="small" />
                        </Stack>
                      </Box>

                      <Divider sx={{ my: 2 }} />

                      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                        <Paper sx={{ p: 1, textAlign: 'center', flex: 1 }}>
                          <Typography variant="h6" color="primary">
                            {Math.floor(Math.random() * 15) + 10}/19
                          </Typography>
                          <Typography variant="caption">支援手順実施</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, textAlign: 'center', flex: 1 }}>
                          <Typography variant="h6" color="success.main">
                            {Math.floor(Math.random() * 3) + 8}
                          </Typography>
                          <Typography variant="caption">効果的手順</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, textAlign: 'center', flex: 1 }}>
                          <Typography variant="h6" color="warning.main">
                            {Math.floor(Math.random() * 3) + 1}
                          </Typography>
                          <Typography variant="caption">要改善手順</Typography>
                        </Paper>
                      </Stack>

                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => window.open(`/daily/support?user=${user.UserID}`, '_blank')}
                      >
                        詳細記録を確認
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                {intensiveSupportUsers.length === 0 && (
                  <Alert severity="info">
                    現在、支援手順記録の対象者はいません。
                  </Alert>
                )}
              </Stack>
            </TabPanel>
          </>
        ) : null;
      case 'staffOnly':
        return vm.role === 'staff' ? (
          <Stack spacing={3}>
            {/* 🌅 朝会カード */}
            <Card
              elevation={3}
              sx={{
                borderWidth: 2,
                borderStyle: 'solid',
                borderColor: isMorningTime ? 'primary.main' : 'divider',
              }}
            >
              <CardHeader
                title="🌅 朝会情報（9:00）"
                titleTypographyProps={{ variant: 'h5', fontWeight: 600 }}
                sx={{
                  bgcolor: (theme) => (isMorningTime ? alpha(theme.palette.primary.main, 0.08) : 'transparent'),
                }}
              />
              <CardContent sx={{ py: 1.25, px: 1.5 }}>
                <Stack spacing={3}>
                  <HandoffSummaryForMeeting
                    dayScope="yesterday"
                    title="前日からの申し送り引き継ぎ"
                    description="朝会では前日までの申し送りを確認し、優先対応が必要な案件をタイムラインからピックアップします。"
                    actionLabel="タイムラインを開く"
                    onOpenTimeline={() => openTimeline('yesterday')}
                  />

                  <Card>
                    <CardContent sx={{ py: 1.25, px: 1.5 }}>
                      <Typography variant="h6" gutterBottom>
                        重点フォロー利用者
                      </Typography>
                      {prioritizedUsers.length > 0 ? (
                        <List dense>
                          {prioritizedUsers.map((user) => (
                            <ListItem key={user.Id} disableGutters>
                              <ListItemAvatar>
                                <Avatar>{user.FullName?.charAt(0) ?? '利'}</Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={user.FullName ?? '利用者'}
                                secondary="支援手順記録の確認をお願いします"
                              />
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Alert severity="success">現在フォロー対象の利用者はありません。</Alert>
                      )}
                    </CardContent>
                  </Card>

                  {renderScheduleLanes('今日の予定', scheduleLanesToday)}
                </Stack>
              </CardContent>
            </Card>

            {/* 🌆 夕会カード */}
            <Card
              elevation={3}
              sx={{
                borderWidth: 2,
                borderStyle: 'solid',
                borderColor: isEveningTime ? 'secondary.main' : 'divider',
              }}
            >
              <CardHeader
                title="🌆 夕会情報（17:15）"
                titleTypographyProps={{ variant: 'h5', fontWeight: 600 }}
                sx={{
                  bgcolor: (theme) => (isEveningTime ? alpha(theme.palette.secondary.main, 0.08) : 'transparent'),
                }}
              />
              <CardContent sx={{ py: 1.25, px: 1.5 }}>
                <Stack spacing={3}>
                  <Card>
                    <CardContent sx={{ py: 1.25, px: 1.5 }}>
                      <Typography variant="h6" gutterBottom>
                        本日の振り返り
                      </Typography>
                      <Stack spacing={2}>
                        {dailyStatusCards.map(({ label, value, helper, color, emphasize }) => (
                          <Paper key={label} variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {label}
                            </Typography>
                            <Typography
                              variant="h5"
                              sx={{ fontWeight: emphasize ? 800 : 700, color, mt: 0.5 }}
                            >
                              {value}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {helper}
                            </Typography>
                          </Paper>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent sx={{ py: 1.25, px: 1.5 }}>
                      <Typography variant="h6" gutterBottom>
                        健康・行動トピック
                      </Typography>
                      <Stack spacing={2}>
                        {stats.seizureCount > 0 ? (
                          <Alert severity="warning">本日 {stats.seizureCount} 件の発作対応がありました。詳細記録を確認してください。</Alert>
                        ) : (
                          <Alert severity="success">発作対応はありませんでした。</Alert>
                        )}
                        {Object.values(stats.problemBehaviorStats).some((count) => count > 0) ? (
                          <Alert severity="error">
                            問題行動が記録されています。対応履歴と支援手順の見直しを検討してください。
                          </Alert>
                        ) : (
                          <Alert severity="info">問題行動の記録はありません。</Alert>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>

                  <HandoffSummaryForMeeting
                    dayScope="today"
                    title="明日への申し送り候補"
                    description="夕会では今日の申し送りを最終確認し、重要なトピックをタイムラインに集約して明日へ引き継ぎます。"
                    actionLabel="タイムラインで確認"
                    onOpenTimeline={() => openTimeline('today')}
                  />

                  {renderScheduleLanes('明日の予定', scheduleLanesTomorrow)}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        ) : null;
      default:
        return assertNever(section.key);
    }
  }, [
    attendanceSummary,
    dailyStatusCards,
    handoffCritical,
    handoffStatus,
    handoffTotal,
    intensiveSupportUsers,
    isEveningTime,
    isMorningTime,
    openTimeline,
    prioritizedUsers,
    renderScheduleLanes,
    scheduleLanesToday.organizationLane,
    scheduleLanesToday.staffLane,
    scheduleLanesToday.userLane,
    scheduleLanesTomorrow.organizationLane,
    scheduleLanesTomorrow.staffLane,
    scheduleLanesTomorrow.userLane,
    schedulesEnabled,
    stats,
    tabValue,
    usageMap,
    users,
    vm.role,
  ]);

  return (
    <Container maxWidth="lg" data-testid="dashboard-page">
      <Box sx={{ py: { xs: 1.5, sm: 2, md: 2.5 } }}>
        {/* ヘッダー */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                <DashboardIcon sx={{ verticalAlign: 'middle', mr: 2 }} />
                黒ノート
              </Typography>
              <Typography variant="body1" color="text.secondary">
                全利用者の活動状況と支援記録の統合的な管理・分析
              </Typography>
            </Box>

            {/* 朝会・夕会情報ボタン */}
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<AccessTimeIcon />}
                component={Link}
                to="/dashboard/briefing"
                size="small"
                color="primary"
              >
                朝会・夕会情報
              </Button>
            </Stack>
          </Box>
        </Box>

        <Stack spacing={{ xs: 2, sm: 3, md: 4 }} sx={{ mb: { xs: 2, sm: 3 } }}>
          {vm.sections.map((section) => (
            <React.Fragment key={section.key}>
              {section.enabled === false ? null : renderSection(section)}
            </React.Fragment>
          ))}
        </Stack>

      </Box>

    </Container>
  );
};

export const AdminDashboardPage: React.FC = () => <DashboardPage audience="admin" />;
export const StaffDashboardPage: React.FC = () => <DashboardPage audience="staff" />;

export default DashboardPage;