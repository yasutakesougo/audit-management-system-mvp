import {
    Assignment as AssignmentIcon,
    Psychology as BehaviorIcon,
    ChecklistRtl as ChecklistIcon,
    Dashboard as DashboardIcon,
    Event as EventIcon,
    Forum as ForumIcon,
    LocalHospital as MedicalIcon,
    Person as PersonIcon,
    Restaurant as RestaurantIcon,
    TodayRounded as TodayRoundedIcon,
    TrendingUp as TrendingUpIcon,
    ViewList as ViewListIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    Container,
    Divider,
    FormControlLabel,
    LinearProgress,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListSubheader,
    Paper,
    Stack,
    Switch,
    Tab,
    Tabs,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { PersonDaily, SeizureRecord } from '../domain/daily/types';
import { useTimelineDaySchedules } from '../features/schedule/hooks/useTimelineDaySchedules';
import TimelineDay from '../features/schedule/views/TimelineDay';
import { useUsersDemo } from '../features/users/usersStoreDemo';
import { IUserMaster } from '../sharepoint/fields';

// モック活動日誌データ生成
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

const DashboardPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [viewMode, setViewMode] = useState<'dashboard' | 'meeting'>('dashboard');
  const [handoverView, setHandoverView] = useState<'morning' | 'evening'>('morning');
  const { data: users } = useUsersDemo();

  const todayDate = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);
  const today = useMemo(() => todayDate.toISOString().split('T')[0], [todayDate]);
  const { events, loading, error, reload } = useTimelineDaySchedules(todayDate);

  // 活動日誌データ（モック）
  const activityRecords = useMemo(() =>
  generateMockActivityRecords(users, today),
  [users, today]
  );

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

  type MedicalTimelineItem = {
    time: string;
    sortKey: number;
    personName: string;
    description: string;
    severity?: '緊急' | '注意' | '経過観察';
  };

  type HandoverItem = {
    id: string;
    title: string;
    detail: string;
    reporter: string;
    priority: '要観察' | '完了' | '保留';
    initialPriority: '要観察' | '完了' | '保留';
    completed: boolean;
  };

  type MeetingNote = {
    id: string;
    author: string;
    timestamp: string;
    content: string;
    tags: string[];
    requiresFollowup: boolean;
  };

  const meetingTimeLabel = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return '職員ミーティング（朝礼 9:00）';
    if (hour < 17) return '職員ミーティング（昼会 13:30）';
    return '職員ミーティング（夕礼 17:00）';
  }, []);

  const medicalTimeline = useMemo<MedicalTimelineItem[]>(() => {
    const items: MedicalTimelineItem[] = [];
    const parseTimeToMinutes = (time: string | undefined) => {
      if (!time) return Number.MAX_SAFE_INTEGER;
      const [hh, mm] = time.split(':').map((value) => Number.parseInt(value, 10));
      if (Number.isNaN(hh) || Number.isNaN(mm)) {
        return Number.MAX_SAFE_INTEGER - 1;
      }
      return hh * 60 + mm;
    };

    activityRecords.forEach((record, index) => {
      const seizure = record.data.seizureRecord;
      if (seizure?.occurred) {
        const time = seizure.time || '未記録';
        items.push({
          time,
          sortKey: parseTimeToMinutes(seizure.time),
          personName: record.personName,
          description: `発作を確認。継続時間: ${seizure.duration ?? '不明'} / 重症度: ${seizure.severity ?? '未評価'}`,
          severity: '緊急',
        });
      }

      if (record.data.mealAmount === '少なめ' || record.data.mealAmount === 'なし') {
        const mealTimeMinutes = 12 * 60 + (index % 4) * 15;
        const hours = Math.floor(mealTimeMinutes / 60)
          .toString()
          .padStart(2, '0');
        const minutes = (mealTimeMinutes % 60).toString().padStart(2, '0');
        items.push({
          time: `${hours}:${minutes}`,
          sortKey: mealTimeMinutes,
          personName: record.personName,
          description: `昼食摂取量は「${record.data.mealAmount}」。追加の体調確認が必要です。`,
          severity: '注意',
        });
      }

      if (record.data.specialNotes) {
        const noteTimeMinutes = 15 * index;
        items.push({
          time: `${String(Math.floor(noteTimeMinutes / 60)).padStart(2, '0')}:${String(noteTimeMinutes % 60).padStart(2, '0')}`,
          sortKey: noteTimeMinutes,
          personName: record.personName,
          description: record.data.specialNotes,
          severity: '経過観察',
        });
      }
    });

    return items.sort((a, b) => a.sortKey - b.sortKey);
  }, [activityRecords]);

  const defaultHandoverItems: HandoverItem[] = useMemo(
    () => [
      {
        id: 'handover-1',
        title: 'A様の睡眠状況フォロー',
        detail: '夜勤より、昨晩の中途覚醒が多かったため午前中の体調観察を強化してください。',
        reporter: '夜勤担当：佐藤',
        priority: '要観察',
        initialPriority: '要観察',
        completed: false,
      },
      {
        id: 'handover-2',
        title: 'C様の常備薬補充',
        detail: '本日午後の訪問看護までに薬局へ発注済み。15時に到着予定、受け取り確認を。',
        reporter: '日勤：田中',
        priority: '保留',
        initialPriority: '保留',
        completed: false,
      },
      {
        id: 'handover-3',
        title: 'E様 個別支援計画',
        detail: '保護者との面談日時調整中。夕礼までに候補日3案を決定する必要あり。',
        reporter: 'サービス管理責任者：山本',
        priority: '要観察',
        initialPriority: '要観察',
        completed: false,
      },
    ],
    [],
  );

  const [handoverItems, setHandoverItems] = useState<HandoverItem[]>(() => {
    if (typeof window === 'undefined') {
      return defaultHandoverItems;
    }
    const stored = window.localStorage.getItem('meetingDashboard.handoverItems');
    if (!stored) {
      return defaultHandoverItems;
    }
    try {
      const parsed = JSON.parse(stored) as HandoverItem[];
      if (!Array.isArray(parsed)) {
        return defaultHandoverItems;
      }
      return parsed.map(item => ({
        ...item,
        initialPriority: item.initialPriority ?? item.priority ?? '要観察',
      }));
    } catch {
      return defaultHandoverItems;
    }
  });

  const tagOptions = ['医療', '行動', '連絡', '備品'] as const;

  const defaultMeetingNotes: Record<'morning' | 'evening', MeetingNote[]> = useMemo(
    () => ({
      morning: [
        {
          id: 'note-1',
          author: '日勤リーダー：高橋',
          timestamp: '08:50',
          content: 'B様の通院送迎は11:00出発の予定。車両確認と昼食時間の調整をお願いします。',
          tags: ['医療', '連絡'],
          requiresFollowup: true,
        },
      ],
      evening: [
        {
          id: 'note-2',
          author: '夕勤リーダー：鈴木',
          timestamp: '17:05',
          content: '本日の創作活動で使用した備品の補充を明日午前中に行う必要があります。',
          tags: ['備品'],
          requiresFollowup: false,
        },
      ],
    }),
    [],
  );

  const [meetingNotes, setMeetingNotes] = useState<Record<'morning' | 'evening', MeetingNote[]>>(() => {
    if (typeof window === 'undefined') {
      return defaultMeetingNotes;
    }
    const stored = window.localStorage.getItem('meetingDashboard.meetingNotes');
    if (!stored) {
      return defaultMeetingNotes;
    }
    try {
      const parsed = JSON.parse(stored) as Partial<Record<'morning' | 'evening', MeetingNote[]>>;
      return {
        morning: Array.isArray(parsed?.morning) ? parsed.morning : defaultMeetingNotes.morning,
        evening: Array.isArray(parsed?.evening) ? parsed.evening : defaultMeetingNotes.evening,
      };
    } catch {
      return defaultMeetingNotes;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('meetingDashboard.handoverItems', JSON.stringify(handoverItems));
  }, [handoverItems]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('meetingDashboard.meetingNotes', JSON.stringify(meetingNotes));
  }, [meetingNotes]);

  const [noteDraft, setNoteDraft] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [requiresFollowup, setRequiresFollowup] = useState(false);

  const criticalAlerts = useMemo(() => {
    const alerts: { id: string; message: string; severity: 'error' | 'warning' }[] = [];
    if (stats.problemBehaviorStats.violence > 0) {
      alerts.push({
        id: 'violence',
        message: `暴力行動が${stats.problemBehaviorStats.violence}件発生。環境調整と個別支援の確認が必要です。`,
        severity: 'error',
      });
    }
    if (stats.problemBehaviorStats.selfHarm > 0) {
      alerts.push({
        id: 'self-harm',
        message: `自傷行動が${stats.problemBehaviorStats.selfHarm}件記録されています。担当職員と継続的な観察を共有してください。`,
        severity: 'error',
      });
    }
    if (stats.seizureCount > 0) {
      alerts.push({
        id: 'seizure',
        message: `発作記録が${stats.seizureCount}件あります。対象者の体調確認と医療機関連絡の準備を。`,
        severity: 'warning',
      });
    }
    return alerts;
  }, [stats.problemBehaviorStats, stats.seizureCount]);

  const attentionList = useMemo(() => {
    return activityRecords
      .filter(record => {
        const pb = record.data.problemBehavior;
        const hasProblemBehavior = pb ? Object.values(pb).some(Boolean) : false;
        const lowMeal = record.data.mealAmount === '少なめ' || record.data.mealAmount === 'なし';
        const seizureOccurred = record.data.seizureRecord?.occurred;
        return hasProblemBehavior || lowMeal || seizureOccurred;
      })
      .map(record => ({
        id: record.id,
        personName: record.personName,
        problemBehavior: record.data.problemBehavior,
        mealAmount: record.data.mealAmount,
        seizureRecord: record.data.seizureRecord,
        specialNotes: record.data.specialNotes,
      }));
  }, [activityRecords]);

  const condensedEvents = useMemo(() => {
    if (!Array.isArray(events)) return [];

    const startOfDay = new Date(todayDate);
    const endOfDay = new Date(todayDate);
    endOfDay.setHours(23, 59, 59, 999);

    const mapped = events
      .map((event, index) => {
        const title =
          (event as { title?: string; subject?: string }).title ??
          (event as { subject?: string }).subject ??
          'スケジュールイベント';
        const startValue = (event as { start?: string | Date })?.start;
        const startDate = startValue ? new Date(startValue) : undefined;
        const hasValidDate = startDate && !Number.isNaN(startDate.getTime());
        const withinDay =
          hasValidDate && startDate >= startOfDay && startDate <= endOfDay;
        const isUpcoming = hasValidDate ? startDate >= new Date() : false;

        return {
          id: `event-${index}`,
          title,
          timeLabel: hasValidDate
            ? startDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
            : '時刻未定',
          startDate,
          hasValidDate,
          withinDay,
          sortKey: hasValidDate ? startDate.getTime() : Number.MAX_SAFE_INTEGER - index,
          isUpcoming,
        };
      })
      .filter(event => event.withinDay || !event.hasValidDate);

    const upcoming = mapped
      .filter(event => event.isUpcoming)
      .sort((a, b) => a.sortKey - b.sortKey)
      .slice(0, 5);

    if (upcoming.length >= 5) {
      return upcoming;
    }

    const remainingSlots = 5 - upcoming.length;
    const remaining = mapped
      .filter(event => !event.isUpcoming)
      .sort((a, b) => a.sortKey - b.sortKey)
      .slice(0, remainingSlots);

    return [...upcoming, ...remaining];
  }, [events, todayDate]);

  const handleHandoverToggle = (id: string) => {
    setHandoverItems(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              completed: !item.completed,
              priority: item.completed ? item.initialPriority : '完了',
            }
          : item,
      ),
    );
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(current => current !== tag) : [...prev, tag],
    );
  };

  const handleAddMeetingNote = () => {
    if (!noteDraft.trim()) return;
    const newNote: MeetingNote = {
      id: `note-${Date.now()}`,
      author: '記録者：職員A',
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      content: noteDraft.trim(),
      tags: selectedTags,
      requiresFollowup,
    };
    setMeetingNotes(prev => ({
      ...prev,
      [handoverView]: [newNote, ...prev[handoverView]],
    }));
    setNoteDraft('');
    setSelectedTags([]);
    setRequiresFollowup(false);
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const renderDashboardContent = () => (
    <>
      {/* 基本統計 */}
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

      {/* タブナビゲーション */}
      <Card sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab label="日タイムライン" icon={<TodayRoundedIcon />} iconPosition="start" />
          <Tab label="集団傾向分析" icon={<TrendingUpIcon />} iconPosition="start" />
          <Tab label="問題行動サマリー" icon={<BehaviorIcon />} iconPosition="start" />
          <Tab label="医療・健康情報" icon={<MedicalIcon />} iconPosition="start" />
          <Tab label="個別支援記録" icon={<AssignmentIcon />} iconPosition="start" />
        </Tabs>
      </Card>

      {/* タブコンテンツ */}
      <TabPanel value={tabValue} index={0}>
        <TimelineDay events={events} date={todayDate} onEventCreate={reload} onEventEdit={reload} />
        {loading && <Box sx={{ mt: 2, color: 'text.secondary' }}>読み込み中...</Box>}
        {error && (
          <Box sx={{ mt: 2, color: 'error.main' }}>予定の取得に失敗しました: {error.message}</Box>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Stack spacing={3}>
          <Card>
            <CardContent>
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
            <CardContent>
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
            <Alert severity="success">本日は問題行動の記録がありません。良好な状態が維持されています。</Alert>
          )}

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                問題行動対応履歴
              </Typography>
              <Typography variant="body2" color="text.secondary">
                詳細な対応記録と改善傾向の分析は個別の活動日誌をご確認ください。
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <MedicalIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                健康・医療タイムライン
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                本日の医療関連イベントを時系列で表示します。
              </Typography>
              <Stack spacing={2}>
                {medicalTimeline.length > 0 ? (
                  medicalTimeline.map((event, index) => (
                    <Paper key={`${event.time}-${event.personName}-${index}`} sx={{ p: 2 }}>
                      <Stack spacing={0.5}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label={event.time} size="small" color="primary" />
                          <Typography variant="subtitle2">{event.personName}</Typography>
                        </Stack>
                        <Typography variant="body2">{event.description}</Typography>
                        {event.severity ? (
                          <Chip
                            label={event.severity}
                            size="small"
                            color={
                              event.severity === '緊急'
                                ? 'error'
                                : event.severity === '注意'
                                ? 'warning'
                                : 'default'
                            }
                          />
                        ) : null}
                      </Stack>
                    </Paper>
                  ))
                ) : (
                  <Alert severity="success">本日は医療・健康面で特筆すべきイベントはありません。</Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                健康管理指標
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" gutterBottom>
                    昼食摂取率
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={
                      stats.totalUsers > 0
                        ? ((stats.lunchStats['完食'] || 0) / stats.totalUsers) * 100
                        : 0
                    }
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption">
                    {stats.totalUsers > 0
                      ? `${Math.round(
                          ((stats.lunchStats['完食'] || 0) / stats.totalUsers) * 100,
                        )}% (${stats.lunchStats['完食'] || 0}名/${stats.totalUsers}名)`
                      : 'データなし'}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <Stack spacing={2}>
          <Typography variant="h6" gutterBottom>
            <PersonIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            強度行動障害対象者 支援手順記録
          </Typography>

          {intensiveSupportUsers.map(user => (
            <Card key={user.Id} sx={{ border: '2px solid', borderColor: 'warning.main' }}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 2,
                  }}
                >
                  <Typography variant="h6">{user.FullName}</Typography>
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
                  onClick={() => window.open(`/records/support-procedures/${user.Id}`, '_blank')}
                >
                  詳細記録を確認
                </Button>
              </CardContent>
            </Card>
          ))}

          {intensiveSupportUsers.length === 0 && <Alert severity="info">現在、支援手順記録の対象者はいません。</Alert>}
        </Stack>
      </TabPanel>

      {/* クイックアクション */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
          <Button variant="contained" size="large" onClick={() => window.open('/records/diary', '_blank')}>
            活動日誌入力
          </Button>
          <Button variant="outlined" size="large" onClick={() => window.open('/records/support-procedures', '_blank')}>
            支援手順記録入力
          </Button>
          <Button variant="outlined" size="large" color="secondary">
            月次レポート生成
          </Button>
        </Stack>
      </Box>
    </>
  );

  const renderMeetingModeContent = () => (
    <Stack spacing={3}>
      {/* エリア1：前日からの引継ぎ */}
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <ChecklistIcon sx={{ color: 'warning.main' }} />
            <Typography variant="h6">前日からの確認事項</Typography>
          </Stack>
          <List
            dense
            subheader={<ListSubheader component="div">対応状況を共有し、完了したらチェックを付けてください</ListSubheader>}
          >
            {handoverItems.map(item => (
              <ListItem key={item.id} alignItems="flex-start" disableGutters sx={{ py: 1 }}>
                <ListItemIcon>
                  <Checkbox edge="start" checked={item.completed} onChange={() => handleHandoverToggle(item.id)} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1">{item.title}</Typography>
                      <Chip
                        label={item.priority}
                        color={item.priority === '完了' ? 'success' : item.priority === '要観察' ? 'warning' : 'default'}
                        size="small"
                      />
                    </Stack>
                  }
                  secondary={
                    <>
                      <Typography component="span" variant="body2" color="text.primary">
                        {item.detail}
                      </Typography>
                      <Typography component="span" variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
                        {item.reporter}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* エリア2：本日のハイライト */}
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <EventIcon color="primary" />
            <Typography variant="h6">本日のハイライト</Typography>
          </Stack>

          <Stack spacing={2}>
            {criticalAlerts.length > 0 ? (
              criticalAlerts.map(alert => (
                <Alert key={alert.id} severity={alert.severity}>
                  {alert.message}
                </Alert>
              ))
            ) : (
              <Alert severity="success">緊急性の高いアラートはありません。</Alert>
            )}

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                要注意者リスト
              </Typography>
              <Stack spacing={1.5}>
                {attentionList.length > 0 ? (
                  attentionList.map(record => (
                    <Box key={record.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PersonIcon fontSize="small" color="action" />
                        <Typography variant="body1">{record.personName}</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {record.problemBehavior &&
                          Object.entries(record.problemBehavior)
                            .filter(([, value]) => value === true)
                            .map(([key]) => (
                              <Chip key={key} label={`問題行動: ${key}`} color="error" size="small" />
                            ))}
                        {record.mealAmount &&
                          (record.mealAmount === '少なめ' || record.mealAmount === 'なし') && (
                            <Chip label={`食事量: ${record.mealAmount}`} color="warning" size="small" />
                          )}
                        {record.seizureRecord?.occurred && <Chip label="発作あり" color="error" size="small" />}
                        {record.specialNotes && <Chip label="特記事項あり" color="info" size="small" />}
                      </Stack>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    本日の要注意者は登録されていません。
                  </Typography>
                )}
              </Stack>
            </Paper>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                <Typography variant="subtitle1" gutterBottom>
                  健康状態サマリー
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    発作記録: {stats.seizureCount}件
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    食事摂取（少なめ・なし）: {(stats.lunchStats['少なめ'] || 0) + (stats.lunchStats['なし'] || 0)}名
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    記録完了率: {Math.round(stats.completionRate)}%
                  </Typography>
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                <Typography variant="subtitle1" gutterBottom>
                  特別イベント
                </Typography>
                <Stack spacing={1}>
                  {condensedEvents.length > 0 ? (
                    condensedEvents.map(event => (
                      <Stack key={event.id} direction="row" spacing={1} alignItems="center">
                        <Chip label={event.timeLabel} size="small" color="primary" />
                        <Typography variant="body2">{event.title}</Typography>
                      </Stack>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      特筆すべきスケジュールはありません。
                    </Typography>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* エリア3：申し送り記録 */}
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <ForumIcon color="secondary" />
            <Typography variant="h6">本日の申し送り</Typography>
          </Stack>

          <Tabs
            value={handoverView}
            onChange={(_, value) => {
              if (value) {
                setHandoverView(value);
              }
            }}
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
          >
            <Tab value="morning" label="朝礼" />
            <Tab value="evening" label="夕礼" />
          </Tabs>

          <Stack spacing={2}>
            <TextField
              label="申し送り内容"
              multiline
              minRows={3}
              fullWidth
              value={noteDraft}
              onChange={event => setNoteDraft(event.target.value)}
              placeholder="共有したい内容を入力してください"
            />

            <Stack direction="row" spacing={1} flexWrap="wrap">
              {tagOptions.map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  color={selectedTags.includes(tag) ? 'primary' : 'default'}
                  variant={selectedTags.includes(tag) ? 'filled' : 'outlined'}
                  onClick={() => handleTagToggle(tag)}
                  sx={{ mb: 1 }}
                />
              ))}
            </Stack>

            <FormControlLabel
              control={<Switch checked={requiresFollowup} onChange={event => setRequiresFollowup(event.target.checked)} />}
              label="要確認フラグ（次回ミーティングで確認）"
            />

            <Box sx={{ textAlign: 'right' }}>
              <Button variant="contained" onClick={handleAddMeetingNote}>
                申し送りを記録
              </Button>
            </Box>

            <Divider />

            <Stack spacing={1}>
              {meetingNotes[handoverView].length > 0 ? (
                meetingNotes[handoverView].map(note => (
                  <Paper key={note.id} variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Chip label={note.timestamp} size="small" color="default" />
                      <Typography variant="subtitle2">{note.author}</Typography>
                      {note.requiresFollowup && <Chip label="要確認" color="warning" size="small" />}
                    </Stack>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {note.content}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      {note.tags.map(tag => (
                        <Chip key={`${note.id}-${tag}`} label={tag} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Paper>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  まだ申し送りは登録されていません。
                </Typography>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 3 }}>
        <Box
          sx={{
            mb: 3,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              <DashboardIcon sx={{ verticalAlign: 'middle', mr: 2 }} />
              黒ノート
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {viewMode === 'dashboard'
                ? '黒ノートで全利用者の活動状況と支援記録を統合的に管理・分析'
                : meetingTimeLabel}
            </Typography>
          </Box>

          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => {
              if (newMode) {
                setViewMode(newMode);
              }
            }}
            aria-label="表示モード切替"
            size="small"
          >
            <ToggleButton value="dashboard" aria-label="通常表示">
              <ViewListIcon sx={{ mr: 1 }} />
              通常表示
            </ToggleButton>
            <ToggleButton value="meeting" aria-label="ミーティングモード">
              <ForumIcon sx={{ mr: 1 }} />
              ミーティング
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {viewMode === 'dashboard' ? renderDashboardContent() : renderMeetingModeContent()}
      </Box>
    </Container>
  );
};

export default DashboardPage;
