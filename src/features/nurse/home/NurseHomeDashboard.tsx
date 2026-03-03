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

import { INITIAL_UNREAD, INSTRUCTION_DIFFS, INTEGRATION_STATUS, TASK_SEED, TIMELINE } from './nurseDemoData';
import type { PriorityFilter, RecipientFilter, TaskState } from './nurseHomeTypes';
import { formatDueLabel, priorityMeta, severityBackground, severityColor } from './nurseHomeTypes';


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
