import { TESTIDS, tidWithSuffix } from '@/testids';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';

type Priority = 'high' | 'medium' | 'low';
type RecipientTag = '@次回自分' | '@生活支援員' | '@管理者';
type RecipientFilter = RecipientTag | 'all';
type PriorityFilter = Priority | 'all';

type TaskSeed = {
  id: string;
  resident: string;
  summary: string;
  tags: string[];
  priority: Priority;
  dueMinutes: number;
  recipient: RecipientTag;
  timelineRef: string;
};

type TaskState = TaskSeed & {
  unread: boolean;
  resolved: boolean;
};

type TimelineEntry = {
  id: string;
  phase: string;
  time: string;
  supportLog: string;
  nurseFocus: string;
  severity: 'danger' | 'warn' | 'info';
  taskId?: string;
  tag?: RecipientTag;
};

type InstructionDiff = {
  id: string;
  item: string;
  previous: string;
  updated: string;
  effective: string;
  note: string;
  priority: Priority;
};

type IntegrationStatus = {
  id: string;
  label: string;
  detail: string;
  status: 'ok' | 'pending';
};

const priorityMeta: Record<Priority, { label: string; color: string; bg: string }> = {
  high: { label: '高', color: '#B91C1C', bg: 'rgba(239,68,68,0.12)' },
  medium: { label: '中', color: '#B45309', bg: 'rgba(245,158,11,0.12)' },
  low: { label: '低', color: '#0F766E', bg: 'rgba(15,118,110,0.12)' },
};

const TASK_SEED: TaskSeed[] = [
  {
    id: 'task-spo2',
    resident: 'I022 中村 裕樹',
    summary: 'SpO2再測定と在宅酸素流量チェック（生活支援員同行）',
    tags: ['バイタル', '酸素療法'],
    priority: 'high',
    dueMinutes: 45,
    recipient: '@生活支援員',
  timelineRef: '09:15 朝の発作記録 / 生活支援員Aと再測定予定',
  },
  {
    id: 'task-med',
    resident: 'I031 佐々木 花',
    summary: '昼食後の服薬確認と嚥下状態の記録を15:00までに共有',
    tags: ['服薬', '申し送り'],
    priority: 'medium',
    dueMinutes: 180,
    recipient: '@次回自分',
    timelineRef: '12:30 服薬 / 生活支援員Bが実施予定',
  },
  {
    id: 'task-wound',
    resident: 'I015 山田 太郎',
    summary: '右足踵の発赤写真を管理者レビュー用にアップロード',
    tags: ['創部観察', '管理者連携'],
    priority: 'medium',
    dueMinutes: 240,
    recipient: '@管理者',
    timelineRef: '14:00 創部処置 / 看護師が対応、管理者レビュー待ち',
  },
  {
    id: 'task-follow',
    resident: 'I022 中村 裕樹',
    summary: '夜間尿量の記録を次回勤務時に確認し、下剤調整結果を判定',
    tags: ['フォローアップ', '生活支援情報'],
    priority: 'low',
    dueMinutes: 720,
    recipient: '@次回自分',
    timelineRef: '20:00 夜間記録 / 生活支援員より共有予定',
  },
];

const INITIAL_UNREAD: Record<string, boolean> = {
  'task-spo2': true,
  'task-med': true,
  'task-wound': true,
  'task-follow': false,
};

const TIMELINE: TimelineEntry[] = [
  {
    id: 'timeline-prep',
    phase: '出勤前準備',
    time: '08:20',
    supportLog: '生活支援員A: 排泄介助で便秘訴えを記録',
    nurseFocus: '下剤調整後初日の経過。夜間尿量の共有を@次回自分タグで依頼中。',
    severity: 'warn',
    taskId: 'task-follow',
    tag: '@次回自分',
  },
  {
    id: 'timeline-start',
    phase: '受け持ち開始',
    time: '09:15',
  supportLog: '事業所時間割: 朝の発作記録 (SpO2 89%)',
    nurseFocus: '酸素流量調整を即時確認。生活支援員と再測定タスクを連携。',
    severity: 'danger',
    taskId: 'task-spo2',
    tag: '@生活支援員',
  },
  {
    id: 'timeline-mid',
    phase: 'ケア実施中',
    time: '12:30',
    supportLog: '服薬 (メトグルコ) が未完了ステータス',
    nurseFocus: '嚥下状態ヒアリングをタスク化し、15:00までに共有。',
    severity: 'warn',
    taskId: 'task-med',
    tag: '@次回自分',
  },
  {
    id: 'timeline-handoff',
    phase: '申し送りと退勤',
    time: '14:40',
    supportLog: '創部処置を実施。写真アップロードが保留。',
    nurseFocus: '管理者レビュー用にファイル添付を残タスク化。',
    severity: 'info',
    taskId: 'task-wound',
    tag: '@管理者',
  },
];

const INSTRUCTION_DIFFS: InstructionDiff[] = [
  {
    id: 'diff-oxygen',
    item: '在宅酸素指示',
    previous: '2L/分 常時',
    updated: '活動時のみ3L/分、安静時は2L/分',
    effective: '本日 10:00',
    note: 'SpO2低下時の再測定結果に応じて流量を調整。',
    priority: 'high',
  },
  {
    id: 'diff-med',
    item: '糖尿病食 + メトグルコ',
    previous: '昼食前に投与',
    updated: '昼食後に変更し、低血糖リスクを軽減',
    effective: '本日 昼食後',
    note: '嚥下状態と血糖推移を15:00までに記録。',
    priority: 'medium',
  },
];

const INTEGRATION_STATUS: IntegrationStatus[] = [
  {
    id: 'integration-timeline',
    label: '時間割記録リンク',
  detail: '09:15 朝の発作記録 / 生活支援員A のログを参照できます。',
    status: 'ok',
  },
  {
    id: 'integration-followup',
    label: 'フォローアップタスク共有',
    detail: '生活支援員ダッシュボードに2件同期済み。',
    status: 'ok',
  },
  {
    id: 'integration-template',
    label: '医療的ケアテンプレート更新',
    detail: '在宅酸素テンプレートを新指示へ更新待ち。',
    status: 'pending',
  },
  {
    id: 'integration-report',
    label: '終礼レポート転記',
    detail: '高優先タスクが日次終礼レポートに反映済み。',
    status: 'ok',
  },
];

const formatDueLabel = (minutes: number) => {
  if (minutes <= 0) return '期限超過';
  if (minutes < 60) return `あと${minutes}分`;
  if (minutes < 180) return `あと${Math.round(minutes / 60)}時間以内`;
  if (minutes < 1440) return `今日中 (${Math.floor(minutes / 60)}h)`;
  return '明日以降';
};

const severityColor = (severity: TimelineEntry['severity']) => {
  if (severity === 'danger') return '#EF4444';
  if (severity === 'warn') return '#F59E0B';
  return '#2563EB';
};

const severityBackground = (severity: TimelineEntry['severity']) => {
  if (severity === 'danger') return 'rgba(239,68,68,0.08)';
  if (severity === 'warn') return 'rgba(245,158,11,0.08)';
  return 'rgba(37,99,235,0.08)';
};

const NurseHomeDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<TaskState[]>(() =>
    TASK_SEED.map((task) => ({
      ...task,
      unread: INITIAL_UNREAD[task.id] ?? true,
      resolved: false,
    }))
  );
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(true);
  const [hideResolved, setHideResolved] = useState(true);

  const metrics = useMemo(() => {
    const unread = tasks.filter((task) => task.unread).length;
    const open = tasks.filter((task) => !task.resolved).length;
    const urgent = tasks.filter((task) => !task.resolved && task.priority === 'high').length;
    const dueSoon = tasks.filter((task) => !task.resolved && task.dueMinutes <= 60).length;
    const completion = tasks.length === 0 ? 100 : Math.round(((tasks.length - open) / tasks.length) * 100);
    return { unread, open, urgent, dueSoon, completion };
  }, [tasks]);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (hideResolved && task.resolved) return false;
        if (showUnreadOnly && !task.unread) return false;
        if (recipientFilter !== 'all' && task.recipient !== recipientFilter) return false;
        if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
        return true;
      }),
    [tasks, hideResolved, showUnreadOnly, recipientFilter, priorityFilter]
  );

  const integrationCompletion = useMemo(() => {
    if (!INTEGRATION_STATUS.length) return 0;
    const completed = INTEGRATION_STATUS.filter((item) => item.status === 'ok').length;
    return Math.round((completed / INTEGRATION_STATUS.length) * 100);
  }, []);

  const nextCritical = useMemo(() => {
    const entry = TIMELINE.find((item) => item.severity === 'danger');
    if (!entry) return null;
    const linkedTask = tasks.find((task) => task.id === entry.taskId);
    return { entry, linkedTask };
  }, [tasks]);

  const toggleResolved = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              resolved: !task.resolved,
              unread: task.resolved ? task.unread : false,
            }
          : task
      )
    );
  };

  const markRead = (taskId: string) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, unread: false } : task)));
  };

  const markAllRead = () => {
    setTasks((prev) => prev.map((task) => ({ ...task, unread: false })));
  };

  return (
    <Box data-testid={TESTIDS.NURSE_HOME_PAGE}>
      <Stack spacing={3}>
        <Stack spacing={2} direction={{ xs: 'column', md: 'row' }}>
          <Card variant="outlined" sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                申し送りサマリ
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                未完了 {metrics.open} 件
              </Typography>
              <Typography variant="body2" color="text.secondary">
                完了率 {metrics.completion}%
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
                <Chip
                  label={`未読 ${metrics.unread}`}
                  color="primary"
                  variant={metrics.unread ? 'filled' : 'outlined'}
                  size="small"
                />
                <Chip
                  label={`高優先 ${metrics.urgent}`}
                  size="small"
                  sx={{ bgcolor: priorityMeta.high.bg, color: priorityMeta.high.color, fontWeight: 600 }}
                />
                <Chip
                  label={`1時間以内 ${metrics.dueSoon}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: '#B45309', fontWeight: 600 }}
                />
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                直近の重要イベント
              </Typography>
              {nextCritical ? (
                <Stack spacing={1}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {nextCritical.entry.time} {nextCritical.entry.supportLog}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {nextCritical.entry.nurseFocus}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
                    <Chip label={nextCritical.entry.phase} size="small" />
                    {nextCritical.entry.tag ? (
                      <Chip label={nextCritical.entry.tag} size="small" color="primary" />
                    ) : null}
                    {nextCritical.linkedTask?.unread ? (
                      <Chip label="未読タスク" size="small" color="secondary" />
                    ) : null}
                    {nextCritical.linkedTask?.resolved ? (
                      <Chip label="解決済" size="small" color="success" />
                    ) : null}
                  </Stack>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => nextCritical.linkedTask && markRead(nextCritical.linkedTask.id)}
                    disabled={!nextCritical.linkedTask || !nextCritical.linkedTask.unread}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    タスクを既読にする
                  </Button>
                </Stack>
              ) : (
                <Typography variant="body2">重要イベントはありません。</Typography>
              )}
            </CardContent>
          </Card>
        </Stack>

        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch">
          <Card variant="outlined" sx={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
                    宛先タグ付きフォローアップ
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <ToggleButtonGroup
                      size="small"
                      value={recipientFilter}
                      exclusive
                      onChange={(_, value) => {
                        if (value !== null) setRecipientFilter(value as RecipientFilter);
                      }}
                    >
                      <ToggleButton value="all">全宛先</ToggleButton>
                      <ToggleButton value="@次回自分">@次回自分</ToggleButton>
                      <ToggleButton value="@生活支援員">@生活支援員</ToggleButton>
                      <ToggleButton value="@管理者">@管理者</ToggleButton>
                    </ToggleButtonGroup>
                    <ToggleButtonGroup
                      size="small"
                      value={priorityFilter}
                      exclusive
                      onChange={(_, value) => {
                        if (value !== null) setPriorityFilter(value as PriorityFilter);
                      }}
                    >
                      <ToggleButton value="all">全優先度</ToggleButton>
                      <ToggleButton value="high">高</ToggleButton>
                      <ToggleButton value="medium">中</ToggleButton>
                      <ToggleButton value="low">低</ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>
                </Stack>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={showUnreadOnly}
                        onChange={(event) => setShowUnreadOnly(event.target.checked)}
                      />
                    }
                    label="未読のみ"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={hideResolved}
                        onChange={(event) => setHideResolved(event.target.checked)}
                      />
                    }
                    label="完了済みを隠す"
                  />
                  <Button variant="text" size="small" onClick={markAllRead} sx={{ ml: { sm: 'auto' } }}>
                    全件を既読にする
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
            <Divider />
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {filteredTasks.length ? (
                <List>
                  {filteredTasks.map((task) => {
                    const priority = priorityMeta[task.priority];
                    return (
                      <ListItem
                        key={task.id}
                        alignItems="flex-start"
                        divider
                        {...tidWithSuffix(TESTIDS.NURSE_HOME_TASK_ITEM, `.${task.id}`)}
                      >
                        <Stack direction="row" spacing={2} sx={{ width: '100%' }} alignItems="flex-start">
                          <Checkbox
                            checked={task.resolved}
                            onChange={() => toggleResolved(task.id)}
                            inputProps={{ 'aria-label': '完了' }}
                          />
                          <Box sx={{ flexGrow: 1 }}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={1}>
                              <Typography sx={{ fontWeight: 700 }}>{task.resident}</Typography>
                              {task.unread ? <Chip label="未読" size="small" color="secondary" /> : null}
                              <Chip
                                label={`優先度 ${priority.label}`}
                                size="small"
                                sx={{ bgcolor: priority.bg, color: priority.color, fontWeight: 600 }}
                              />
                              <Chip
                                label={formatDueLabel(task.dueMinutes)}
                                size="small"
                                sx={{ bgcolor: 'rgba(15,118,110,0.12)', color: '#0F766E', fontWeight: 600 }}
                              />
                            </Stack>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              {task.summary}
                            </Typography>
                            <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.75 }}>
                              {task.tags.map((tag) => (
                                <Chip key={tag} label={tag} size="small" variant="outlined" />
                              ))}
                              <Chip label={task.recipient} size="small" color="primary" variant="outlined" />
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                              {task.timelineRef}
                            </Typography>
                          </Box>
                          <Button size="small" onClick={() => markRead(task.id)} disabled={!task.unread}>
                            既読
                          </Button>
                        </Stack>
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Box sx={{ p: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    表示条件に一致するフォローアップはありません。
                  </Typography>
                </Box>
              )}
            </Box>
          </Card>

          <Stack spacing={2} sx={{ flex: 1 }}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    タイムライン連携
                  </Typography>
                  <Stack spacing={1.5}>
                    {TIMELINE.map((entry) => {
                      const linkedTask = tasks.find((task) => task.id === entry.taskId);
                      const color = severityColor(entry.severity);
                      return (
                        <Box
                          key={entry.id}
                          sx={{
                            borderLeft: `4px solid ${color}`,
                            bgcolor: severityBackground(entry.severity),
                            borderRadius: 2,
                            p: 1.5,
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={1}>
                            <Chip label={entry.phase} size="small" />
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {entry.time}
                            </Typography>
                            {entry.tag ? <Chip label={entry.tag} size="small" color="primary" /> : null}
                            {linkedTask?.unread ? <Chip label="未読タスク" size="small" color="secondary" /> : null}
                            {linkedTask?.resolved ? <Chip label="解決済" size="small" color="success" /> : null}
                          </Stack>
                          <Typography sx={{ fontWeight: 600, mt: 1 }}>{entry.supportLog}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {entry.nurseFocus}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    医師指示・ケア差分
                  </Typography>
                  <Alert severity="info" variant="outlined">
                    指示変更は時間割テンプレートと連携します。確認後に関連タスクの優先度を見直してください。
                  </Alert>
                  <Stack spacing={1.5}>
                    {INSTRUCTION_DIFFS.map((diff) => {
                      const priority = priorityMeta[diff.priority];
                      return (
                        <Box
                          key={diff.id}
                          sx={{
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            p: 1.5,
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={1}>
                            <Typography sx={{ fontWeight: 700 }}>{diff.item}</Typography>
                            <Chip
                              label={`優先度 ${priority.label}`}
                              size="small"
                              sx={{ bgcolor: priority.bg, color: priority.color, fontWeight: 600 }}
                            />
                            <Chip label={diff.effective} size="small" />
                          </Stack>
                          <Stack spacing={0.5} sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              変更前: {diff.previous}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              変更後: {diff.updated}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              メモ: {diff.note}
                            </Typography>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Stack>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'flex-start', md: 'center' }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
                  連携チェックリスト
                </Typography>
                <Box sx={{ minWidth: 160 }}>
                  <Typography variant="caption" color="text.secondary">
                    連携達成率
                  </Typography>
                  <LinearProgress
                    value={integrationCompletion}
                    variant="determinate"
                    sx={{ mt: 0.5, borderRadius: 999 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {integrationCompletion}%
                  </Typography>
                </Box>
              </Stack>
              <List>
                {INTEGRATION_STATUS.map((item) => (
                  <ListItem key={item.id} divider disableGutters>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={1}>
                          <Typography sx={{ fontWeight: 600 }}>{item.label}</Typography>
                          <Chip
                            label={item.status === 'ok' ? '連携済' : '要確認'}
                            size="small"
                            color={item.status === 'ok' ? 'success' : 'warning'}
                          />
                        </Stack>
                      }
                      secondary={item.detail}
                      secondaryTypographyProps={{ variant: 'body2', color: 'text.secondary', sx: { mt: 0.5 } }}
                    />
                  </ListItem>
                ))}
              </List>
              {INTEGRATION_STATUS.some((item) => item.status === 'pending') ? (
                <Alert severity="warning" variant="outlined">
                  医療的ケアテンプレートの更新が保留です。完了後に生活支援員ダッシュボードへ反映されます。
                </Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

export default NurseHomeDashboard;
