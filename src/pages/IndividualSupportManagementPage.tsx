import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FavoriteIcon from '@mui/icons-material/Favorite';
import HealthIcon from '@mui/icons-material/HealthAndSafety';
import InfoIcon from '@mui/icons-material/Info';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SupportIcon from '@mui/icons-material/Support';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';

type TabValue = 'plan' | 'records';

interface SupportSection {
  id: string;
  title: string;
  description: string[];
  color: string;
  icon: React.ReactNode;
}

interface ScheduleSlot {
  id: string;
  time: string;
  activity: string;
  selfTasks: string[];
  supporterTasks: string[];
  isRecorded: boolean;
}

interface ABCSelection {
  antecedent: string;
  behavior: string;
  consequence: string;
}

interface SlotFormState {
  mood: string;
  note: string;
  showABC: boolean;
  abc: ABCSelection;
  error: string | null;
}

interface TimelineEntry {
  id: string;
  time: string;
  activity: string;
  mood: string;
  note: string;
  abc?: ABCSelection;
  recordedAt: string;
}

const targetName = '山田 太郎 様';

const supportSections: SupportSection[] = [
  {
    id: 'prevention',
    title: '予防的対応（落ち着いている時）',
    description: [
      '朝の挨拶では必ず視線を合わせ、落ち着いた声で伝えます。',
      '活動の切り替え前に「あと5分で次の活動です」と予告します。',
      '安心して過ごせるよう、好きな音楽をバックグラウンドで流します。',
    ],
    color: 'info.light',
    icon: <HealthIcon fontSize="small" sx={{ mr: 1 }} />,
  },
  {
    id: 'skills',
    title: 'スキル獲得支援（行動の置き換え）',
    description: [
      '選択肢を2つ提示し、自分で選べたことを褒めます。',
      '感情カードを使って気持ちを言葉で表現する練習をします。',
      '成功体験を振り返り、自信を高める声掛けを行います。',
    ],
    color: 'success.light',
    icon: <PsychologyIcon fontSize="small" sx={{ mr: 1 }} />,
  },
  {
    id: 'crisis',
    title: '緊急時対応（強いこだわり・パニックの兆候）',
    description: [
      '深呼吸の誘導と静かな声掛けで状況を受け止めます。',
      '安全を確保し、余分な刺激（音・光）を減らします。',
      '落ち着いたら「どうしたかった？」と確認し、再発予防の手立てを検討します。',
    ],
    color: 'warning.light',
    icon: <InfoIcon fontSize="small" sx={{ mr: 1 }} />,
  },
];

const initialSchedule: ScheduleSlot[] = [
  {
    id: 'slot-0900',
    time: '09:00',
    activity: '朝の会',
    selfTasks: ['朝の挨拶をする', '今日の予定を一緒に確認する'],
    supporterTasks: ['視覚支援ボードを提示する', '落ち着いたトーンで進行をサポートする'],
    isRecorded: false,
  },
  {
    id: 'slot-1000',
    time: '10:00',
    activity: '感覚統合活動',
    selfTasks: ['ボールプールで体を動かす', '5分間のスイングを楽しむ'],
    supporterTasks: ['安全な範囲での動きを見守る', '手順の切り替えを予告する'],
    isRecorded: false,
  },
  {
    id: 'slot-1200',
    time: '12:00',
    activity: '昼食',
    selfTasks: ['自分の席に座り、手を合わせて挨拶する', '好きなおかずから食べ始める'],
    supporterTasks: ['食具の配置を整える', '落ち着いたペースで食べられるよう声掛けする'],
    isRecorded: false,
  },
  {
    id: 'slot-1500',
    time: '15:00',
    activity: '帰りの支度',
    selfTasks: ['持ち物チェックリストを確認する', 'スタッフに今日楽しかったことを伝える'],
    supporterTasks: ['チェックリストを一緒に指差し確認する', '達成したことを振り返りながら褒める'],
    isRecorded: false,
  },
];

const moodOptions = ['落ち着いている', '楽しそう', '不安そう', '疲れている', 'サインが出ている'];

const abcOptionMap: Record<keyof ABCSelection, string[]> = {
  antecedent: ['要求が通らない', '活動の切り替え', '感覚刺激が強い', '周囲が騒がしい'],
  behavior: ['手を叩く', '大きな声を出す', 'その場を離れる', '泣く / 叫ぶ'],
  consequence: ['支援者が近づく', '活動から離れる', '要求が受け入れられる', '時間を置いて再開する'],
};

const buildInitialFormState = (schedule: ScheduleSlot[]): Record<string, SlotFormState> => {
  return schedule.reduce<Record<string, SlotFormState>>((acc, slot) => {
    acc[slot.id] = {
      mood: '',
      note: '',
      showABC: false,
      abc: {
        antecedent: '',
        behavior: '',
        consequence: '',
      },
      error: null,
    };
    return acc;
  }, {});
};

const IndividualSupportManagementPage: React.FC = () => {
  const [tab, setTab] = useState<TabValue>('plan');
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>(initialSchedule);
  const [formState, setFormState] = useState<Record<string, SlotFormState>>(() => buildInitialFormState(initialSchedule));
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' },
  );

  const recordedCount = useMemo(() => scheduleSlots.filter((slot) => slot.isRecorded).length, [scheduleSlots]);

  const handleTabChange = (_event: React.SyntheticEvent, value: TabValue) => {
    setTab(value);
  };

  const handleMoodSelect = (slotId: string, mood: string) => {
    setFormState((prev) => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        mood,
        error: null,
      },
    }));
  };

  const handleNoteChange = (slotId: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        note: value,
      },
    }));
  };

  const handleToggleABC = (slotId: string) => {
    setFormState((prev) => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        showABC: !prev[slotId].showABC,
      },
    }));
  };

  const handleABCSelect = (slotId: string, key: keyof ABCSelection, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        abc: {
          ...prev[slotId].abc,
          [key]: value,
        },
      },
    }));
  };

  const handleRecord = (slot: ScheduleSlot) => {
    const currentState = formState[slot.id];

    if (!currentState.mood) {
      setFormState((prev) => ({
        ...prev,
        [slot.id]: {
          ...prev[slot.id],
          error: '「本人の様子」を選択してください。',
        },
      }));
      setSnackbar({ open: true, message: '記録に必要な項目が未入力です。', severity: 'error' });
      return;
    }

    const abcIncluded = currentState.showABC && (currentState.abc.antecedent || currentState.abc.behavior || currentState.abc.consequence);
    const entry: TimelineEntry = {
      id: `${slot.id}-${Date.now()}`,
      time: slot.time,
      activity: slot.activity,
      mood: currentState.mood,
      note: currentState.note.trim(),
      abc: abcIncluded ? currentState.abc : undefined,
      recordedAt: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    };

    setTimeline((prev) => [entry, ...prev]);
    setScheduleSlots((prev) => prev.map((item) => (item.id === slot.id ? { ...item, isRecorded: true } : item)));
    setFormState((prev) => ({
      ...prev,
      [slot.id]: {
        mood: '',
        note: '',
        showABC: prev[slot.id].showABC,
        abc: {
          antecedent: '',
          behavior: '',
          consequence: '',
        },
        error: null,
      },
    }));
    setSnackbar({ open: true, message: `${slot.time}「${slot.activity}」を記録しました。`, severity: 'success' });
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper elevation={1} sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <SupportIcon color="primary" />
          <Typography variant="overline" color="text.secondary">
            強度行動障害支援ツール
          </Typography>
        </Stack>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          {targetName} の支援手順記録
        </Typography>
        <Typography variant="body1" color="text.secondary">
          支援計画の確認と日々の記録をワンページで管理できます。記録済み {recordedCount}/{scheduleSlots.length}
        </Typography>
      </Paper>

      <Paper elevation={1}>
        <Tabs
          value={tab}
          onChange={handleTabChange}
          aria-label="支援計画と日々の記録タブ"
          variant="fullWidth"
        >
          <Tab
            value="plan"
            label="支援計画書"
            icon={<FavoriteIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            value="records"
            label="日々の記録"
            icon={<ScheduleIcon fontSize="small" />}
            iconPosition="start"
          />
        </Tabs>

        {tab === 'plan' && (
          <Box sx={{ p: { xs: 2, md: 3 }, display: 'grid', gap: 2 }}>
            {supportSections.map((section) => (
              <Paper
                key={section.id}
                elevation={2}
                sx={{
                  borderLeft: 6,
                  borderColor: section.color,
                  p: 3,
                  backgroundColor: `${section.color}20`,
                }}
              >
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', fontWeight: 600, mb: 1 }}>
                  {section.icon}
                  {section.title}
                </Typography>
                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  {section.description.map((item, index) => (
                    <li key={index}>
                      <Typography variant="body2" color="text.secondary">
                        {item}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </Paper>
            ))}
          </Box>
        )}

        {tab === 'records' && (
          <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              時系列の記録リスト
            </Typography>
            <Stack spacing={2}>
              {scheduleSlots.map((slot) => {
                const state = formState[slot.id];
                const hasError = Boolean(state?.error);

                return (
                  <Accordion key={slot.id} disableGutters>
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        bgcolor: slot.isRecorded ? 'success.light' : 'background.default',
                        '& .MuiAccordionSummary-content': {
                          alignItems: 'center',
                          gap: 2,
                        },
                      }}
                    >
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography sx={{ fontWeight: 600 }}>{slot.time}・{slot.activity}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {slot.isRecorded ? '記録済み' : '未記録'}
                        </Typography>
                      </Box>
                      {slot.isRecorded && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <CheckCircleIcon fontSize="small" color="success" />
                          <Typography variant="body2" color="success.main">
                            記録済み
                          </Typography>
                        </Stack>
                      )}
                    </AccordionSummary>
                    <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>本人のやること</Typography>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                          {slot.selfTasks.map((task, index) => (
                            <li key={index}>
                              <Typography variant="body2" color="text.secondary">{task}</Typography>
                            </li>
                          ))}
                        </ul>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>支援者のやること</Typography>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                          {slot.supporterTasks.map((task, index) => (
                            <li key={index}>
                              <Typography variant="body2" color="text.secondary">{task}</Typography>
                            </li>
                          ))}
                        </ul>
                      </Box>

                      <Divider flexItem />

                      <Stack spacing={1}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>本人の様子 *</Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {moodOptions.map((option) => (
                            <Chip
                              key={option}
                              label={option}
                              color={state?.mood === option ? 'primary' : 'default'}
                              variant={state?.mood === option ? 'filled' : 'outlined'}
                              onClick={() => handleMoodSelect(slot.id, option)}
                            />
                          ))}
                        </Stack>
                      </Stack>

                      <Stack spacing={1}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>特記事項</Typography>
                        <TextField
                          value={state?.note ?? ''}
                          multiline
                          minRows={3}
                          placeholder="気づいたことや共有したいことを記載してください"
                          onChange={(event) => handleNoteChange(slot.id, event.target.value)}
                        />
                      </Stack>

                      <Box>
                        <Button
                          size="small"
                          variant={state?.showABC ? 'outlined' : 'text'}
                          onClick={() => handleToggleABC(slot.id)}
                        >
                          行動をABC分析で詳しく記録する
                        </Button>
                        <Collapse in={Boolean(state?.showABC)}>
                          <Stack spacing={2} mt={2}>
                            {(['antecedent', 'behavior', 'consequence'] as (keyof ABCSelection)[]).map((key) => (
                              <Box key={key}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                  {key === 'antecedent' && 'A: 先行事象'}
                                  {key === 'behavior' && 'B: 行動'}
                                  {key === 'consequence' && 'C: 結果'}
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                  {abcOptionMap[key].map((option) => (
                                    <Chip
                                      key={option}
                                      label={option}
                                      color={state?.abc[key] === option ? 'primary' : 'default'}
                                      variant={state?.abc[key] === option ? 'filled' : 'outlined'}
                                      onClick={() => handleABCSelect(slot.id, key, option)}
                                    />
                                  ))}
                                </Stack>
                              </Box>
                            ))}
                          </Stack>
                        </Collapse>
                      </Box>

                      {hasError && (
                        <Alert severity="warning" onClose={() => handleMoodSelect(slot.id, '')}>
                          {state?.error}
                        </Alert>
                      )}

                      <Box display="flex" justifyContent="flex-end">
                        <Button
                          variant="contained"
                          onClick={() => handleRecord(slot)}
                        >
                          記録する
                        </Button>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Stack>

            <Divider />

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                記録タイムライン
              </Typography>
              {timeline.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                  まだ記録はありません。上部の活動から記録を開始してください。
                </Paper>
              ) : (
                <Stack spacing={2}>
                  {timeline.map((entry) => (
                    <Paper key={entry.id} variant="outlined" sx={{ p: 2.5 }}>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography sx={{ fontWeight: 600 }}>
                            {entry.time}・{entry.activity}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            記録: {entry.recordedAt}
                          </Typography>
                        </Stack>
                        <Typography variant="body2">本人の様子: {entry.mood}</Typography>
                        {entry.note && (
                          <Typography variant="body2">
                            特記事項: {entry.note}
                          </Typography>
                        )}
                        {entry.abc && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>ABC分析</Typography>
                            <Typography variant="body2">A: {entry.abc.antecedent || '―'}</Typography>
                            <Typography variant="body2">B: {entry.abc.behavior || '―'}</Typography>
                            <Typography variant="body2">C: {entry.abc.consequence || '―'}</Typography>
                          </Box>
                        )}
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>
          </Box>
        )}
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default IndividualSupportManagementPage;