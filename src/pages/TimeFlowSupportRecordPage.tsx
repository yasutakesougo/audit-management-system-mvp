import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PersonIcon from '@mui/icons-material/Person';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  resolveSupportFlowForUser,
  fallbackSupportActivities,
  SupportActivityTemplate as FlowSupportActivityTemplate,
  SupportPlanDeployment,
  SupportStrategyStage
} from '../features/planDeployment/supportFlow';
import {
  SupportActivityTemplate as MasterSupportActivityTemplate,
  SupportActivityTemplateZ,
  defaultSupportActivities
} from '../domain/support/types';
// 時間フロー支援記録の型定義
interface SupportRecord {
  id: number;
  supportPlanId: string;
  personId: string;
  personName: string;
  date: string;
  timeSlot?: string;
  userActivities: {
    planned: string;
    actual: string;
    notes: string;
  };
  staffActivities: {
    planned: string;
    actual: string;
    notes: string;
  };
  userCondition: {
    mood?: '良好' | '普通' | '不安定';
    behavior: string;
    communication?: string;
    physicalState?: string;
  };
  specialNotes: {
    incidents?: string;
    concerns?: string;
    achievements?: string;
    nextTimeConsiderations?: string;
  };
  reporter: {
    name: string;
    role?: string;
  };
  status: '未記録' | '記録中' | '記録済み';
  createdAt: string;
  updatedAt: string;
  activityKey?: string;
  activityName?: string;
  abc?: {
    antecedent?: string;
    behavior?: string;
    consequence?: string;
    intensity?: '軽度' | '中度' | '重度';
  };
}

interface DailySupportRecord {
  id: number;
  supportPlanId: string;
  personId: string;
  personName: string;
  date: string;
  records: SupportRecord[];
  summary: {
    totalTimeSlots: number;
    recordedTimeSlots: number;
    concerningIncidents: number;
    achievementHighlights: number;
    overallProgress: '良好' | '順調' | '要注意';
  };
  dailyNotes?: string;
  completedBy: string;
  completedAt?: string;
  status: '未作成' | '作成中' | '完了';
}

interface SupportUser {
  id: string;
  name: string;
  planType: string;
  isActive: boolean;
}

const stageLabelMap: Record<SupportStrategyStage, string> = {
  proactive: '予防的支援',
  earlyResponse: '早期対応',
  crisisResponse: '危機対応',
  postCrisis: '事後対応',
};

const stageOrder: SupportStrategyStage[] = ['proactive', 'earlyResponse', 'crisisResponse', 'postCrisis'];

const SUPPORT_ACTIVITY_STORAGE_KEY = 'supportActivityTemplates';

const categoryToStageMap: Record<MasterSupportActivityTemplate['category'], SupportStrategyStage> = {
  '通所・帰宅': 'proactive',
  '朝の準備': 'proactive',
  '健康確認': 'earlyResponse',
  '活動準備': 'proactive',
  'AM活動': 'proactive',
  '昼食準備': 'earlyResponse',
  '昼食': 'earlyResponse',
  '休憩': 'postCrisis',
  'PM活動': 'proactive',
  '終了準備': 'postCrisis',
  '振り返り': 'postCrisis',
  'その他': 'proactive',
};

const buildDefaultMasterTemplates = (): MasterSupportActivityTemplate[] =>
  defaultSupportActivities.map((template, index) => ({
    ...template,
    iconEmoji: template.iconEmoji ?? '📋',
    id: `default-${index + 1}`
  }));

const normalizeTemplateTime = (rawTime: string): string => {
  const trimmed = rawTime?.trim();
  if (!trimmed) {
    return '00:00';
  }

  const match = trimmed.match(/^(\d{1,2})(?:[:：](\d{1,2}))?$/);
  if (!match) {
    return trimmed;
  }

  const hours = Math.min(23, Math.max(0, Number.parseInt(match[1], 10) || 0));
  const minutesValue = match[2] ?? '0';
  const minutes = Math.min(59, Math.max(0, Number.parseInt(minutesValue, 10) || 0));

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const convertMasterTemplates = (
  templates: MasterSupportActivityTemplate[]
): FlowSupportActivityTemplate[] => {
  return templates
    .map((template) => ({
      time: normalizeTemplateTime(template.specificTime),
      title: template.activityName,
      personTodo: template.userExpectedActions,
      supporterTodo: template.staffSupportMethods,
      stage: categoryToStageMap[template.category] ?? 'proactive',
    }))
    .sort((a, b) => a.time.localeCompare(b.time, 'ja'));
};

const DEFAULT_FLOW_MASTER_ACTIVITIES = convertMasterTemplates(buildDefaultMasterTemplates());

const loadMasterSupportActivities = (): FlowSupportActivityTemplate[] => {
  if (typeof window === 'undefined') {
    return DEFAULT_FLOW_MASTER_ACTIVITIES;
  }

  const raw = window.localStorage.getItem(SUPPORT_ACTIVITY_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_FLOW_MASTER_ACTIVITIES;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return DEFAULT_FLOW_MASTER_ACTIVITIES;
    }

    const templates: MasterSupportActivityTemplate[] = parsed.reduce<MasterSupportActivityTemplate[]>((acc, item, index) => {
      const result = SupportActivityTemplateZ.safeParse(item);
      if (result.success) {
        acc.push({
          ...result.data,
          iconEmoji: result.data.iconEmoji ?? '📋',
          id: result.data.id || `restored-${index}`,
        });
      }
      return acc;
    }, []);

    if (templates.length === 0) {
      return DEFAULT_FLOW_MASTER_ACTIVITIES;
    }

    return convertMasterTemplates(templates);
  } catch {
    return DEFAULT_FLOW_MASTER_ACTIVITIES;
  }
};

// モニタリング情報コンポーネント
interface MonitoringInfoProps {
  personName: string;
  currentDate: string;
}

const MonitoringInfo: React.FC<MonitoringInfoProps> = ({ personName, currentDate }) => {
  const currentMonitoringPeriod = useMemo(() => {
    const date = new Date(currentDate);
    const month = date.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    const year = date.getFullYear();
    return `${year}年第${quarter}四半期`;
  }, [currentDate]);

  return (
    <Card sx={{ mb: 3 }} elevation={1}>
      <CardContent>
        <Typography variant="h6" gutterBottom color="primary">
          📊 モニタリング情報
        </Typography>
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
          <Chip label={`対象者: ${personName}`} color="primary" variant="outlined" />
          <Chip label={`記録日: ${currentDate}`} color="info" variant="outlined" />
          <Chip label={`モニタリング周期: ${currentMonitoringPeriod}`} color="secondary" variant="outlined" />
          <Chip label="更新頻度: 三ヶ月ごと" color="default" variant="outlined" />
        </Stack>
      </CardContent>
    </Card>
  );
};

// 時間フロー支援記録リストコンポーネント
interface TimeFlowSupportRecordListProps {
  activities: FlowSupportActivityTemplate[];
  dailyRecord: DailySupportRecord;
  onAddRecord: (record: SupportRecord) => void;
  onUpdateRecord: (record: SupportRecord) => void;
}

const moodOptions = ['落ち着いている', '楽しそう', '集中している', '不安そう', 'イライラ'];

const abcOptionMap: Record<'antecedent' | 'behavior' | 'consequence', string[]> = {
  antecedent: ['課題中', '要求があった', '感覚刺激', '他者との関わり'],
  behavior: ['大声を出す', '物を叩く', '自傷行為', '他害行為'],
  consequence: ['クールダウン', '要求に応えた', '無視(意図的)', '場所移動'],
};

type SlotFormState = {
  mood: string;
  notes: string;
  intensity: '軽度' | '中度' | '重度' | '';
  showABC: boolean;
  abc: {
    antecedent: string;
    behavior: string;
    consequence: string;
  };
  error: string | null;
};

const TimeFlowSupportRecordList: React.FC<TimeFlowSupportRecordListProps> = ({
  activities,
  dailyRecord,
  onAddRecord,
  onUpdateRecord,
}) => {
  const recordsByKey = useMemo(() => {
    const map = new Map<string, SupportRecord>();
    dailyRecord.records.forEach((record) => {
      const key = record.activityKey ?? record.timeSlot?.split(' ')[0];
      if (key) {
        map.set(key, record);
      }
    });
    return map;
  }, [dailyRecord.records]);

  const initialFormState = useMemo(() => {
    return activities.reduce<Record<string, SlotFormState>>((acc, activity) => {
      const record = recordsByKey.get(activity.time);
      acc[activity.time] = {
        mood: record?.userCondition.mood ?? '',
        notes: record?.userActivities.notes ?? '',
        intensity: record?.abc?.intensity ?? '',
        showABC: Boolean(record?.abc),
        abc: {
          antecedent: record?.abc?.antecedent ?? '',
          behavior: record?.abc?.behavior ?? '',
          consequence: record?.abc?.consequence ?? '',
        },
        error: null,
      };
      return acc;
    }, {});
  }, [activities, recordsByKey]);

  const [formState, setFormState] = useState<Record<string, SlotFormState>>(initialFormState);
  const [expanded, setExpanded] = useState<string | false>(false);

  useEffect(() => {
    setFormState(initialFormState);
  }, [initialFormState]);

  const handleAccordionToggle = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const handleMoodSelect = (key: string, mood: string) => {
    setFormState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        mood,
        error: null,
      },
    }));
  };

  const handleNotesChange = (key: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        notes: value,
      },
    }));
  };

  const handleToggleABC = (key: string) => {
    setFormState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        showABC: !prev[key].showABC,
      },
    }));
  };

  const handleABCSelect = (key: string, field: keyof SlotFormState['abc'], value: string) => {
    setFormState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        abc: {
          ...prev[key].abc,
          [field]: value,
        },
      },
    }));
  };

  const handleIntensitySelect = (key: string, intensity: SlotFormState['intensity']) => {
    setFormState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        intensity,
      },
    }));
  };

  const handleSubmit = (activity: FlowSupportActivityTemplate) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const state = formState[activity.time];
    if (!state.mood) {
      setFormState((prev) => ({
        ...prev,
        [activity.time]: {
          ...prev[activity.time],
          error: '「本人の様子」を選択してください。',
        },
      }));
      return;
    }

    const existingRecord = recordsByKey.get(activity.time);
    const timestamp = new Date().toISOString();
    const baseRecord: SupportRecord = existingRecord ?? {
      id: Date.now(),
      supportPlanId: dailyRecord.supportPlanId,
      personId: dailyRecord.personId,
      personName: dailyRecord.personName,
      date: dailyRecord.date,
      timeSlot: '',
      userActivities: { planned: '', actual: '', notes: '' },
      staffActivities: { planned: '', actual: '', notes: '' },
      userCondition: { behavior: '' },
      specialNotes: {},
      reporter: { name: dailyRecord.completedBy, role: undefined },
      status: '記録中',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const hasAbcDetail = state.showABC && (
      state.abc.antecedent ||
      state.abc.behavior ||
      state.abc.consequence ||
      state.intensity
    );

    const updatedRecord: SupportRecord = {
      ...baseRecord,
      timeSlot: `${activity.time} ${activity.title}`,
      activityKey: activity.time,
      activityName: activity.title,
      userActivities: {
        planned: activity.personTodo,
        actual: state.notes ? state.notes : '予定通り実施',
        notes: state.notes,
      },
      staffActivities: {
        planned: activity.supporterTodo,
        actual: activity.supporterTodo,
        notes: '',
      },
      userCondition: {
        mood: state.mood as SupportRecord['userCondition']['mood'],
        behavior: state.notes || '特記事項なし',
        communication: baseRecord.userCondition.communication,
        physicalState: baseRecord.userCondition.physicalState,
      },
      specialNotes: baseRecord.specialNotes ?? {},
      reporter: baseRecord.reporter ?? { name: dailyRecord.completedBy, role: undefined },
      status: '記録済み',
      updatedAt: timestamp,
      abc: hasAbcDetail
        ? {
            antecedent: state.abc.antecedent || undefined,
            behavior: state.abc.behavior || undefined,
            consequence: state.abc.consequence || undefined,
            intensity: state.intensity || undefined,
          }
        : undefined,
    };

    if (!existingRecord) {
      updatedRecord.createdAt = timestamp;
      onAddRecord(updatedRecord);
    } else {
      onUpdateRecord(updatedRecord);
    }

    setFormState((prev) => ({
      ...prev,
      [activity.time]: {
        ...prev[activity.time],
        error: null,
      },
    }));
    setExpanded(false);
  };

  return (
    <Stack spacing={2}>
  {activities.map((activity) => {
        const state = formState[activity.time];
        const record = recordsByKey.get(activity.time);
        const isRecorded = record?.status === '記録済み';

        return (
          <Accordion
            key={activity.time}
            expanded={expanded === activity.time}
            onChange={handleAccordionToggle(activity.time)}
            disableGutters
            sx={{
              borderRadius: 2,
              border: '1px solid',
              borderColor: isRecorded ? 'success.light' : 'divider',
              bgcolor: isRecorded ? 'success.50' : 'background.paper',
              '&::before': { display: 'none' },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ px: 3, py: 2 }}
            >
              <Stack direction="row" spacing={2} alignItems="center" flexGrow={1}>
                <Typography variant="h6" color="primary">
                  {activity.time}
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {activity.title}
                </Typography>
                <Chip
                  label={stageLabelMap[activity.stage]}
                  color="secondary"
                  size="small"
                  variant="outlined"
                />
                {state?.mood && (
                  <Chip
                    label={state.mood}
                    color="primary"
                    size="small"
                    variant="outlined"
                  />
                )}
                {state?.intensity && (
                  <Chip
                    label={`強度: ${state.intensity}`}
                    color={state.intensity === '重度' ? 'warning' : state.intensity === '中度' ? 'secondary' : 'default'}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Stack>
              {isRecorded && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircleIcon fontSize="small" color="success" />
                  <Typography variant="body2" color="success.main">
                    記録済み
                  </Typography>
                </Stack>
              )}
            </AccordionSummary>
            <AccordionDetails sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
              <Stack spacing={3}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" color="success.main" sx={{ fontWeight: 600 }}>
                    👤 本人のやること
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {activity.personTodo}
                  </Typography>
                </Stack>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" color="secondary.main" sx={{ fontWeight: 600 }}>
                    🤝 支援者のやること
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {activity.supporterTodo}
                  </Typography>
                </Stack>
                <Divider />
                <Box component="form" onSubmit={handleSubmit(activity)} noValidate>
                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        本人の様子 *
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
                        {moodOptions.map((option) => (
                          <Chip
                            key={option}
                            label={option}
                            clickable
                            color={state?.mood === option ? 'primary' : 'default'}
                            variant={state?.mood === option ? 'filled' : 'outlined'}
                            onClick={() => handleMoodSelect(activity.time, option)}
                          />
                        ))}
                      </Stack>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        特記事項
                      </Typography>
                      <TextField
                        multiline
                        minRows={3}
                        placeholder="気づいたことや共有したい内容を記入してください"
                        value={state?.notes ?? ''}
                        onChange={(event) => handleNotesChange(activity.time, event.target.value)}
                        fullWidth
                      />
                    </Box>
                    <Box>
                      <Button
                        size="small"
                        variant={state?.showABC ? 'outlined' : 'text'}
                        onClick={() => handleToggleABC(activity.time)}
                        startIcon={<AutoAwesomeIcon fontSize="small" />}
                      >
                        行動をABC分析で詳しく記録する
                      </Button>
                      <Collapse in={Boolean(state?.showABC)} unmountOnExit>
                        <Stack spacing={2} mt={2}>
                          {(Object.keys(abcOptionMap) as Array<keyof typeof abcOptionMap>).map((field) => (
                            <Box key={field}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {field === 'antecedent' && 'A: 先行事象'}
                                {field === 'behavior' && 'B: 行動'}
                                {field === 'consequence' && 'C: 結果'}
                              </Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
                                {abcOptionMap[field].map((option) => (
                                  <Chip
                                    key={option}
                                    label={option}
                                    clickable
                                    color={state?.abc[field] === option ? 'primary' : 'default'}
                                    variant={state?.abc[field] === option ? 'filled' : 'outlined'}
                                    onClick={() => handleABCSelect(activity.time, field, option)}
                                  />
                                ))}
                              </Stack>
                            </Box>
                          ))}
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              行動の強度
                            </Typography>
                            <ToggleButtonGroup
                              value={state?.intensity ?? ''}
                              exclusive
                              onChange={(_event, value: SlotFormState['intensity'] | null) =>
                                handleIntensitySelect(activity.time, value ?? '')
                              }
                              size="small"
                              sx={{ mt: 1, flexWrap: 'wrap' }}
                            >
                              {(['軽度', '中度', '重度'] as const).map((option) => (
                                <ToggleButton key={option} value={option} sx={{ px: 2 }}>
                                  {option}
                                </ToggleButton>
                              ))}
                            </ToggleButtonGroup>
                          </Box>
                        </Stack>
                      </Collapse>
                    </Box>
                    {state?.error && (
                      <Alert severity="warning" onClose={() => handleMoodSelect(activity.time, '')}>
                        {state.error}
                      </Alert>
                    )}
                    <Box display="flex" justifyContent="flex-end">
                      <Button type="submit" variant="contained">
                        この時間の様子を記録する
                      </Button>
                    </Box>
                  </Stack>
                </Box>
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Stack>
  );
};

const RecordSummaryCard: React.FC<{ record: DailySupportRecord; date: string }> = ({ record, date }) => (
  <Card sx={{ mb: 4 }} elevation={2}>
    <CardContent>
      <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
        <AssignmentIcon color="primary" />
        記録サマリー - {record.personName} ({date})
      </Typography>
      <Divider sx={{ my: 2 }} />

      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', mb: 2 }}>
        <Chip
          label={`記録済み活動: ${record.summary.recordedTimeSlots}/${record.summary.totalTimeSlots}`}
          color="info"
        />
        <Chip
          label={`成果のあった活動: ${record.summary.achievementHighlights}`}
          color="success"
        />
        <Chip
          label={`全体的な進捗: ${record.summary.overallProgress}`}
          color={
            record.summary.overallProgress === '良好'
              ? 'success'
              : record.summary.overallProgress === '順調'
                ? 'info'
                : 'warning'
          }
        />
        <Chip
          label={`記録状態: ${record.status}`}
          color={record.status === '完了' ? 'success' : record.status === '作成中' ? 'info' : 'default'}
        />
      </Stack>

      {record.completedAt && (
        <Typography variant="caption" color="text.secondary">
          最終更新: {new Date(record.completedAt).toLocaleString('ja-JP')}
        </Typography>
      )}

      {record.dailyNotes && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <strong>日次コメント:</strong> {record.dailyNotes}
        </Alert>
      )}
    </CardContent>
  </Card>
);

const SupportRecordReviewList: React.FC<{ dailyRecord: DailySupportRecord }> = ({ dailyRecord }) => {
  const recorded = dailyRecord.records.filter((record) => record.status !== '未記録');

  if (recorded.length === 0) {
    return (
      <Alert severity="info">
        まだ記録はありません。タブを「記録入力」に切り替えて記録を追加してください。
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      {recorded.map((record) => (
        <Paper key={record.id} variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {record.timeSlot ?? '時間未設定'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  記録者: {record.reporter.name || '未入力'}
                </Typography>
              </Box>
              <Chip
                label={record.status}
                color={record.status === '記録済み' ? 'success' : 'default'}
                size="small"
              />
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 600 }}>
                👤 本人の様子
              </Typography>
              {record.userCondition.mood && (
                <Chip
                  label={`気分: ${record.userCondition.mood}`}
                  color={record.userCondition.mood === '良好' ? 'success' : 'default'}
                  size="small"
                  sx={{ alignSelf: 'flex-start' }}
                />
              )}
              {record.abc?.intensity && (
                <Chip
                  label={`強度: ${record.abc.intensity}`}
                  color={record.abc.intensity === '重度' ? 'warning' : record.abc.intensity === '中度' ? 'secondary' : 'default'}
                  size="small"
                  variant="outlined"
                  sx={{ alignSelf: 'flex-start' }}
                />
              )}
              <Typography variant="body2">{record.userCondition.behavior || '行動の記録はありません。'}</Typography>
              {record.userCondition.communication && (
                <Typography variant="body2" color="text.secondary">
                  発言: {record.userCondition.communication}
                </Typography>
              )}
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2" color="success.main" sx={{ fontWeight: 600 }}>
                👥 支援者の支援内容
              </Typography>
              <Typography variant="body2">
                {record.staffActivities.actual || '支援内容の記録はありません。'}
              </Typography>
            </Stack>

            {(record.specialNotes.achievements || record.specialNotes.concerns || record.specialNotes.incidents) && (
              <Stack spacing={1}>
                {record.specialNotes.achievements && (
                  <Alert severity="success" variant="outlined">
                    成果: {record.specialNotes.achievements}
                  </Alert>
                )}
                {record.specialNotes.concerns && (
                  <Alert severity="warning" variant="outlined">
                    懸念: {record.specialNotes.concerns}
                  </Alert>
                )}
                {record.specialNotes.incidents && (
                  <Alert severity="info" variant="outlined">
                    出来事: {record.specialNotes.incidents}
                  </Alert>
                )}
              </Stack>
            )}

            {record.specialNotes.nextTimeConsiderations && (
              <Typography variant="body2" color="text.secondary">
                次回に向けた配慮: {record.specialNotes.nextTimeConsiderations}
              </Typography>
            )}

            {record.abc && (
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" color="text.secondary">
                  ABC記録
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  A: {record.abc.antecedent ?? '未入力'} / B: {record.abc.behavior ?? '未入力'} / C: {record.abc.consequence ?? '未入力'}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
};

const QuickActionToolbar: React.FC<{
  pendingCount: number;
  onGenerateSample: () => void;
  onMarkComplete: () => void;
  isComplete: boolean;
}> = ({ pendingCount, onGenerateSample, onMarkComplete, isComplete }) => {
  const helperText = isComplete
    ? '日次記録は完了済みです。必要に応じて記録を更新できます。'
    : pendingCount === 0
      ? '全ての時間帯が記録済みです。内容を確認して完了を確定しましょう。'
      : `未記録の時間帯が ${pendingCount} 件あります。現場状況に合わせて追加入力してください。`;

  return (
    <Card sx={{ mb: 3 }} elevation={2}>
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Stack spacing={0.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              現場ショートカット
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {helperText}
            </Typography>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} width={{ xs: '100%', sm: 'auto' }}>
            <Button
              onClick={onGenerateSample}
              startIcon={<AutoAwesomeIcon />}
              variant="outlined"
              color="secondary"
              fullWidth
            >
              サンプルを再生成
            </Button>
            <Button
              onClick={onMarkComplete}
              startIcon={<CheckCircleIcon />}
              variant="contained"
              color="primary"
              disabled={isComplete || pendingCount > 0}
              fullWidth
            >
              日次記録を完了
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

const DailyInsightsPanel: React.FC<{ dailyRecord: DailySupportRecord }> = ({ dailyRecord }) => {
  const metrics = useMemo(() => {
    const totalSlots = dailyRecord.summary.totalTimeSlots;
    const recorded = dailyRecord.records.filter((record) => record.status === '記録済み').length;
    const completionRate = totalSlots > 0 ? Math.round((recorded / totalSlots) * 100) : 0;
    const moodCount: Record<'良好' | '普通' | '不安定' | '未記録', number> = {
      良好: 0,
      普通: 0,
      不安定: 0,
      未記録: 0,
    };
    const intensityCount: Record<'軽度' | '中度' | '重度', number> = {
      軽度: 0,
      中度: 0,
      重度: 0,
    };

    dailyRecord.records.forEach((record) => {
      const mood = record.userCondition.mood ?? '未記録';
      if (moodCount[mood] !== undefined) {
        moodCount[mood] += 1;
      }

      if (record.abc?.intensity) {
        intensityCount[record.abc.intensity] += 1;
      }
    });

    const abcRecords = dailyRecord.records.filter((record) => Boolean(record.abc));
    const abcCoverage = dailyRecord.records.length > 0
      ? Math.round((abcRecords.length / dailyRecord.records.length) * 100)
      : 0;

    return {
      completionRate,
      moodCount,
      intensityCount,
      abcCoverage,
      incidents: dailyRecord.summary.concerningIncidents,
    };
  }, [dailyRecord]);

  return (
    <Card elevation={1}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            デイリーインサイト
          </Typography>
          <Box>
            <Typography variant="body2" color="text.secondary">
              記録カバー率
            </Typography>
            <LinearProgress
              variant="determinate"
              value={metrics.completionRate}
              sx={{ mt: 1, borderRadius: 999, height: 10 }}
            />
            <Typography variant="caption" color="text.secondary">
              {metrics.completionRate}% （{dailyRecord.summary.recordedTimeSlots}/{dailyRecord.summary.totalTimeSlots}）
            </Typography>
          </Box>

          <Divider />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box flex={1}>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  気分分布
                </Typography>
                {(['良好', '普通', '不安定'] as const).map((label) => (
                  <Stack key={label} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {metrics.moodCount[label]} 件
                    </Typography>
                  </Stack>
                ))}
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">未記録</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {metrics.moodCount['未記録']} 件
                  </Typography>
                </Stack>
              </Stack>
            </Box>
            <Box flex={1}>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  行動強度（ABC）
                </Typography>
                {(['軽度', '中度', '重度'] as const).map((label) => (
                  <Stack key={label} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {metrics.intensityCount[label]} 件
                    </Typography>
                  </Stack>
                ))}
                <Typography variant="caption" color="text.secondary">
                  ABC入力率 {metrics.abcCoverage}%
                </Typography>
              </Stack>
            </Box>
          </Stack>

          {metrics.incidents > 0 && (
            <Alert severity="warning" variant="outlined">
              懸念のある出来事が {metrics.incidents} 件記録されています。振り返り時に共有してください。
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

const SupportPlanQuickView: React.FC<{ dailyRecord: DailySupportRecord; activities: FlowSupportActivityTemplate[] }> = ({ dailyRecord, activities }) => {
  const { pendingActivities, nextActivity } = useMemo(() => {
    const pending = activities.filter((activity) => {
      const record = dailyRecord.records.find((entry) => entry.activityKey === activity.time);
      return !(record && record.status === '記録済み');
    });

    return {
      pendingActivities: pending,
      nextActivity: pending[0],
    };
  }, [activities, dailyRecord]);

  return (
    <Card elevation={1} sx={{ mt: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              支援手順プレビュー
            </Typography>
            <Typography variant="body2" color="text.secondary">
              残り {pendingActivities.length} 件の時間帯が未記録です。
            </Typography>
          </Stack>

          {nextActivity ? (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: '1px dashed', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 600 }}>
                次の候補: {nextActivity.time} {nextActivity.title}
              </Typography>
              <Chip
                label={stageLabelMap[nextActivity.stage]}
                size="small"
                color="success"
                variant="outlined"
              />
              <Typography variant="body2" color="text.secondary">
                本人: {nextActivity.personTodo}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                支援者: {nextActivity.supporterTodo}
              </Typography>
            </Box>
          ) : (
            <Alert severity="success" variant="outlined">
              すべての時間帯が記録済みです。お疲れさまでした！
            </Alert>
          )}

          {pendingActivities.slice(1, 4).map((activity) => (
            <Box key={activity.time} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {activity.time} {activity.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stageLabelMap[activity.stage]}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                本人: {activity.personTodo}
              </Typography>
            </Box>
          ))}

          {pendingActivities.length > 4 && (
            <Typography variant="caption" color="text.secondary">
              他 {pendingActivities.length - 4} 件の未記録があります。
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

const PlanDeploymentSummary: React.FC<{
  deployment: SupportPlanDeployment | null;
  activities: FlowSupportActivityTemplate[];
}> = ({ deployment, activities }) => {
  const stageBreakdown = useMemo(() => {
    return activities.reduce<Record<SupportStrategyStage, number>>((acc, activity) => {
      acc[activity.stage] = (acc[activity.stage] ?? 0) + 1;
      return acc;
    }, {
      proactive: 0,
      earlyResponse: 0,
      crisisResponse: 0,
      postCrisis: 0,
    });
  }, [activities]);

  const severity = deployment ? 'success' : 'warning';

  return (
    <Alert severity={severity} sx={{ mt: 2 }}>
      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {deployment
              ? `連携中の支援計画: ${deployment.planName} (v${deployment.version})`
              : '支援計画との連携がありません（テンプレート利用中）'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {deployment?.summary ?? 'PlanWizard で承認された計画がデプロイされると自動で紐づきます。'}
          </Typography>
          {deployment?.deployedAt && (
            <Typography variant="caption" color="text.secondary">
              デプロイ日時: {new Date(deployment.deployedAt).toLocaleString('ja-JP')}
            </Typography>
          )}
          {deployment?.references && (
            <Stack spacing={0.25}>
              {deployment.references.map((item) => (
                <Typography key={item.label} variant="caption" color="text.secondary">
                  {item.label}: {item.value}
                </Typography>
              ))}
            </Stack>
          )}
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {stageOrder.map((stage) => (
            <Chip
              key={stage}
              label={`${stageLabelMap[stage]}: ${stageBreakdown[stage]}`}
              size="small"
              color={stageBreakdown[stage] > 0 ? 'primary' : 'default'}
              variant="outlined"
            />
          ))}
          <Chip label={`カード数: ${activities.length}`} size="small" color="info" variant="outlined" />
        </Stack>
      </Stack>
    </Alert>
  );
};

const SupportUserPicker: React.FC<{
  users: SupportUser[];
  selectedUserId: string;
  planTypeOptions: Array<{ value: string; count: number }>;
  selectedPlanType: string;
  totalAvailableCount: number;
  onPlanTypeSelect: (planType: string) => void;
  onSelect: (userId: string) => void;
}> = ({ users, selectedUserId, planTypeOptions, selectedPlanType, totalAvailableCount, onPlanTypeSelect, onSelect }) => {
  return (
    <Stack spacing={2} sx={{ mt: 3 }}>
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Chip
          label={`すべて (${totalAvailableCount})`}
          clickable
          color={selectedPlanType === '' ? 'primary' : 'default'}
          variant={selectedPlanType === '' ? 'filled' : 'outlined'}
          onClick={() => onPlanTypeSelect('')}
        />
        {planTypeOptions.map(({ value, count }) => (
          <Chip
            key={value}
            label={`${value} (${count})`}
            clickable
            color={selectedPlanType === value ? 'primary' : 'default'}
            variant={selectedPlanType === value ? 'filled' : 'outlined'}
            onClick={() => onPlanTypeSelect(value)}
          />
        ))}
      </Stack>

      {users.length === 0 ? (
        <Alert severity="info">
          条件に一致する利用者が見つかりません。検索条件やフィルタを調整してください。
        </Alert>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(1, minmax(0, 1fr))',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
            gap: 2,
          }}
        >
          {users.map((user) => {
            const isSelected = user.id === selectedUserId;
            return (
              <Card
                key={user.id}
                variant="outlined"
                sx={{
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  boxShadow: isSelected ? 6 : 1,
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                <CardActionArea onClick={() => onSelect(user.id)} sx={{ p: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {user.name.charAt(0)}
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {user.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {user.planType}
                      </Typography>
                    </Box>
                    {isSelected && (
                      <Chip
                        label="選択中"
                        color="primary"
                        size="small"
                        icon={<CheckCircleIcon fontSize="small" />}
                        sx={{ ml: 'auto' }}
                      />
                    )}
                  </Stack>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      )}
    </Stack>
  );
};

// モックデータ（支援対象者）
const mockSupportUsers: SupportUser[] = [
  { id: '001', name: '田中太郎', planType: '日常生活', isActive: true },
  { id: '005', name: '佐藤花子', planType: '作業活動', isActive: true },
  { id: '012', name: '山田一郎', planType: 'コミュニケーション', isActive: true },
  { id: '018', name: '鈴木美子', planType: '健康管理', isActive: true },
  { id: '023', name: '高橋次郎', planType: '社会生活', isActive: true },
  { id: '030', name: '中村勇気', planType: '作業活動', isActive: true },
  { id: '032', name: '小林さくら', planType: 'コミュニケーション', isActive: true }
];

// モック日次記録生成（時間フロー対応）
const generateMockTimeFlowDailyRecord = (
  user: typeof mockSupportUsers[0],
  date: string,
  activities: FlowSupportActivityTemplate[],
  deployment: SupportPlanDeployment | null
): DailySupportRecord => {
  const moodSamples: Array<SupportRecord['userCondition']['mood']> = ['良好', '普通', '良好', '良好'];
  const behaviorSamples = [
    '朝の会で落ち着いて参加できました',
    '課題に集中し、質問も適切に行えています',
    '好きな音楽を聴きながらリラックスできています',
    '落ち着いた様子で食事を楽しめています',
  ];

  const limitedActivities = activities.slice(0, Math.min(4, activities.length));

  const sampleRecords: SupportRecord[] = limitedActivities.map((activity, index) => {
    const mood = moodSamples[index % moodSamples.length];
    const behavior = behaviorSamples[index % behaviorSamples.length];

    return {
      id: Date.now() + index,
      supportPlanId: deployment?.planId ?? `plan-${user.id}`,
      personId: user.id,
      personName: user.name,
      date,
      timeSlot: `${activity.time} ${activity.title}`,
      activityKey: activity.time,
      activityName: activity.title,
      userActivities: {
        planned: activity.personTodo,
        actual: behavior,
        notes: '',
      },
      staffActivities: {
        planned: activity.supporterTodo,
        actual: activity.supporterTodo,
        notes: '',
      },
      userCondition: {
        mood,
        behavior,
        communication: undefined,
        physicalState: '体調良好',
      },
      specialNotes: {},
      reporter: {
        name: '支援員A',
        role: '生活支援員',
      },
      status: '記録済み',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      abc: index === 1 ? {
        antecedent: '課題中',
        behavior: '質問をする',
        consequence: '一緒に確認して再開',
        intensity: '中度',
      } : undefined,
    } satisfies SupportRecord;
  });

  return {
    id: Date.now(),
    supportPlanId: deployment?.planId ?? `plan-${user.id}`,
    personId: user.id,
    personName: user.name,
    date,
    records: sampleRecords,
    summary: {
      totalTimeSlots: activities.length,
      recordedTimeSlots: sampleRecords.length,
      concerningIncidents: 0,
      achievementHighlights: sampleRecords.length,
      overallProgress: '良好',
    },
    dailyNotes: deployment?.summary
      ? `計画サマリー: ${deployment.summary}`
      : `${user.name}さんは本日、全体的に落ち着いて過ごせており、課題にも意欲的に参加できています。`,
    completedBy: '支援員A',
    completedAt: new Date().toISOString(),
    status: '作成中',
  };
};

const TimeFlowSupportRecordPage: React.FC = () => {
  const [masterSupportActivities, setMasterSupportActivities] = useState<FlowSupportActivityTemplate[]>(DEFAULT_FLOW_MASTER_ACTIVITIES);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPlanType, setSelectedPlanType] = useState<string>('');
  const [dailyRecords, setDailyRecords] = useState<Record<string, DailySupportRecord>>({});
  const [activeTab, setActiveTab] = useState<'input' | 'review'>('input');
  const [selectionClearedNotice, setSelectionClearedNotice] = useState<boolean>(false);
  const recordSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMasterSupportActivities(loadMasterSupportActivities());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStorageUpdate = (event: StorageEvent) => {
      if (event.key === SUPPORT_ACTIVITY_STORAGE_KEY) {
        setMasterSupportActivities(loadMasterSupportActivities());
      }
    };

    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, []);

  const supportDeployment = useMemo<SupportPlanDeployment | null>(() => {
    if (!selectedUser) {
      return null;
    }
    return resolveSupportFlowForUser(selectedUser);
  }, [selectedUser]);

  const supportActivities = useMemo<FlowSupportActivityTemplate[]>(() => {
    if (supportDeployment?.activities && supportDeployment.activities.length > 0) {
      return supportDeployment.activities;
    }

    if (masterSupportActivities.length > 0) {
      return masterSupportActivities;
    }

    return fallbackSupportActivities;
  }, [supportDeployment, masterSupportActivities]);

  const searchMatchedUsers = useMemo<SupportUser[]>(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    return mockSupportUsers.filter((user) =>
      user.isActive &&
      user.name.toLowerCase().includes(normalizedTerm)
    );
  }, [searchTerm]);

  const planTypeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    searchMatchedUsers.forEach((user) => {
      counts.set(user.planType, (counts.get(user.planType) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value, 'ja'));
  }, [searchMatchedUsers]);

  // フィルタリングされたユーザー
  const filteredUsers = useMemo<SupportUser[]>(() => {
    return searchMatchedUsers.filter((user) =>
      selectedPlanType ? user.planType === selectedPlanType : true
    );
  }, [searchMatchedUsers, selectedPlanType]);

  useEffect(() => {
    if (selectedUser && !filteredUsers.some((user) => user.id === selectedUser)) {
      setSelectedUser('');
      setSelectionClearedNotice(true);
    }
  }, [filteredUsers, selectedUser]);

  const handleUserSelect = (userId: string) => {
    setSelectedUser(userId);
    setActiveTab('input');
    setSelectionClearedNotice(false);
  };

  // 現在の日次記録を取得または生成
  const currentDailyRecord = useMemo(() => {
    if (!selectedUser) return null;

    const user = mockSupportUsers.find(u => u.id === selectedUser);
    if (!user) return null;

    const recordKey = `${selectedUser}-${selectedDate}`;

    if (!dailyRecords[recordKey]) {
      // 新しい日次記録を生成
  const newRecord = generateMockTimeFlowDailyRecord(user, selectedDate, supportActivities, supportDeployment);
      setDailyRecords(prev => ({
        ...prev,
        [recordKey]: newRecord
      }));
      return newRecord;
    }

    const existingRecord = dailyRecords[recordKey];
    if (
      existingRecord.summary.totalTimeSlots !== supportActivities.length ||
      (supportDeployment && existingRecord.supportPlanId !== supportDeployment.planId)
    ) {
      const updatedPlanId = supportDeployment?.planId ?? existingRecord.supportPlanId;

      const adjustedRecord: DailySupportRecord = {
        ...existingRecord,
        supportPlanId: updatedPlanId,
        records: supportDeployment && existingRecord.supportPlanId !== updatedPlanId
          ? existingRecord.records.map((record) => ({
              ...record,
              supportPlanId: updatedPlanId,
            }))
          : existingRecord.records,
        summary: {
          ...existingRecord.summary,
          totalTimeSlots: supportActivities.length,
        },
      };

      setDailyRecords(prev => ({
        ...prev,
        [recordKey]: adjustedRecord,
      }));
      return adjustedRecord;
    }

    return existingRecord;
  }, [dailyRecords, selectedDate, selectedUser, supportActivities]);

  const pendingCount = useMemo(() => {
    if (!selectedUser || !currentDailyRecord) {
      return supportActivities.length;
    }

    return supportActivities.filter((activity) => {
      const record = currentDailyRecord.records.find((entry) => entry.activityKey === activity.time);
      return !(record && record.status === '記録済み');
    }).length;
  }, [currentDailyRecord, selectedUser, supportActivities]);

  const isComplete = currentDailyRecord?.status === '完了';

  const handleAddRecord = (record: SupportRecord) => {
    if (!currentDailyRecord) return;

    const recordKey = `${selectedUser}-${selectedDate}`;
    const updatedDailyRecord: DailySupportRecord = {
      ...currentDailyRecord,
      records: [...currentDailyRecord.records, record],
      status: '作成中',
      summary: {
        ...currentDailyRecord.summary,
        totalTimeSlots: supportActivities.length,
        recordedTimeSlots: currentDailyRecord.records.length + 1
      }
    };

    setDailyRecords(prev => ({
      ...prev,
      [recordKey]: updatedDailyRecord
    }));
  };

  const handleUpdateRecord = (updatedRecord: SupportRecord) => {
    if (!currentDailyRecord) return;

    const recordKey = `${selectedUser}-${selectedDate}`;
    const updatedRecords = currentDailyRecord.records.map((record: SupportRecord) =>
      record.id === updatedRecord.id ? updatedRecord : record
    );

    const updatedDailyRecord: DailySupportRecord = {
      ...currentDailyRecord,
      records: updatedRecords,
      summary: {
        ...currentDailyRecord.summary,
        totalTimeSlots: supportActivities.length,
        recordedTimeSlots: updatedRecords.length
      }
    };

    setDailyRecords(prev => ({
      ...prev,
      [recordKey]: updatedDailyRecord
    }));
  };

  const handleMarkComplete = () => {
    if (!selectedUser) return;

    const recordKey = `${selectedUser}-${selectedDate}`;
    setDailyRecords((prev) => {
      const target = prev[recordKey];
      if (!target) {
        return prev;
      }

      const updatedRecord: DailySupportRecord = {
        ...target,
        status: '完了',
        completedAt: new Date().toISOString(),
        summary: {
          ...target.summary,
          totalTimeSlots: supportActivities.length,
          recordedTimeSlots: target.summary.recordedTimeSlots,
        },
      };

      return {
        ...prev,
        [recordKey]: updatedRecord,
      };
    });
  };

  const generateAutoSchedule = () => {
    if (!selectedUser) return;

    const user = mockSupportUsers.find(u => u.id === selectedUser);
    if (!user) return;

    const recordKey = `${selectedUser}-${selectedDate}`;
  const autoRecord = generateMockTimeFlowDailyRecord(user, selectedDate, supportActivities, supportDeployment);

    setDailyRecords(prev => ({
      ...prev,
      [recordKey]: autoRecord
    }));
  };

  const getActiveUsersCount = () => mockSupportUsers.filter(u => u.isActive).length;

  const handleTabChange = (_event: React.SyntheticEvent, value: 'input' | 'review') => {
    setActiveTab(value);
  };

  useEffect(() => {
    if (selectedUser && recordSectionRef.current) {
      recordSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedUser, currentDailyRecord]);

  return (
    <Container maxWidth="lg">
      <Box py={4}>
        {/* ヘッダー */}
        <Paper elevation={3} sx={{ p: 4, mb: 4, bgcolor: 'gradient.primary', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <Box display="flex" alignItems="center" gap={3} mb={3}>
            <Box sx={{
              bgcolor: 'white',
              p: 2,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ScheduleIcon sx={{ fontSize: 48, color: 'primary.main' }} />
            </Box>
            <Box>
              <Typography variant="h3" fontWeight="bold" color="white" gutterBottom>
                支援手順兼記録
              </Typography>
              <Typography variant="h6" color="white" sx={{ opacity: 0.9 }}>
                一日の流れに沿った直感的な支援手順兼記録システム
              </Typography>
              <Typography variant="subtitle1" color="white" sx={{ opacity: 0.8 }}>
                開所時間 9:30-16:00 → 本人のやること・職員のやることをカードで管理
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
            <Chip
              icon={<PersonIcon />}
              label={`対象者: ${getActiveUsersCount()}名`}
              sx={{ bgcolor: 'white', color: 'primary.main' }}
            />
            <Chip
              icon={<AccessTimeIcon />}
              label="具体的時間表示"
              sx={{ bgcolor: 'white', color: 'secondary.main' }}
            />
            <Chip
              icon={<AutoAwesomeIcon />}
              label="直感的カード表示"
              sx={{ bgcolor: 'white', color: 'success.main' }}
            />
            <Chip
              icon={<TrendingUpIcon />}
              label="強度行動障害支援"
              sx={{ bgcolor: 'white', color: 'warning.main' }}
            />
          </Stack>
        </Paper>

        {/* フィルター・検索 */}
        <Card sx={{ mb: 4 }} elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <SearchIcon color="primary" />
              記録対象選択
            </Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
              <TextField
                label="利用者名で検索"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ minWidth: 200 }}
                size="small"
              />

              <TextField
                label="記録日"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 160 }}
                size="small"
              />

              {selectedUser && (
                <Button
                  onClick={generateAutoSchedule}
                  startIcon={<AutoAwesomeIcon />}
                  variant="outlined"
                  color="secondary"
                >
                  サンプル生成
                </Button>
              )}
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              利用者カードをクリックすると対象者が選択されます。検索条件やプラン種別フィルタを切り替えると一覧がリアルタイムに絞り込まれます。
            </Typography>

            <Collapse in={selectionClearedNotice}>
              <Alert severity="info" sx={{ mt: 2 }} onClose={() => setSelectionClearedNotice(false)}>
                絞り込み条件により選択中の利用者が一覧から外れたため、選択を解除しました。
              </Alert>
            </Collapse>

            <SupportUserPicker
              users={filteredUsers}
              selectedUserId={selectedUser}
              planTypeOptions={planTypeOptions}
              selectedPlanType={selectedPlanType}
              totalAvailableCount={searchMatchedUsers.length}
              onPlanTypeSelect={setSelectedPlanType}
              onSelect={handleUserSelect}
            />

            {selectedUser && (
              <PlanDeploymentSummary
                deployment={supportDeployment}
                activities={supportActivities}
              />
            )}
          </CardContent>
        </Card>

        {/* メイン記録エリア */}
        {selectedUser && currentDailyRecord ? (
          <Box ref={recordSectionRef}>
            <QuickActionToolbar
              pendingCount={pendingCount}
              onGenerateSample={generateAutoSchedule}
              onMarkComplete={handleMarkComplete}
              isComplete={Boolean(isComplete)}
            />

            <MonitoringInfo
              personName={currentDailyRecord.personName}
              currentDate={selectedDate}
            />

            <Paper elevation={1} sx={{ mb: 4 }}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                variant="fullWidth"
                aria-label="支援手順兼記録タブ"
              >
                <Tab value="input" label="記録入力" />
                <Tab value="review" label="記録閲覧" />
              </Tabs>

              <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <RecordSummaryCard record={currentDailyRecord} date={selectedDate} />

                {activeTab === 'input' ? (
                  <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="stretch">
                    <Box sx={{ flexGrow: 1 }}>
                      <TimeFlowSupportRecordList
                        activities={supportActivities}
                        dailyRecord={currentDailyRecord}
                        onAddRecord={handleAddRecord}
                        onUpdateRecord={handleUpdateRecord}
                      />
                    </Box>
                    <Stack spacing={3} sx={{ flexBasis: { lg: '32%' }, flexGrow: 1 }}>
                      <DailyInsightsPanel dailyRecord={currentDailyRecord} />
                      <SupportPlanQuickView dailyRecord={currentDailyRecord} activities={supportActivities} />
                    </Stack>
                  </Stack>
                ) : (
                  <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="stretch">
                    <Box sx={{ flexGrow: 1 }}>
                      <SupportRecordReviewList dailyRecord={currentDailyRecord} />
                    </Box>
                    <Stack spacing={3} sx={{ flexBasis: { lg: '32%' }, flexGrow: 1 }}>
                      <DailyInsightsPanel dailyRecord={currentDailyRecord} />
                      <SupportPlanQuickView dailyRecord={currentDailyRecord} activities={supportActivities} />
                    </Stack>
                  </Stack>
                )}
              </Box>
            </Paper>
          </Box>
        ) : (
          <Alert severity="info" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              支援手順兼記録を開始
            </Typography>
            <Typography>
              利用者と記録日を選択して、支援手順兼記録を開始してください。<br />
              <strong>開所時間 9:30-16:00</strong>の具体的な時間と活動内容がカードで表示されます。<br />
              各カードには「本人のやること」「職員のやること」が明確に示され、直感的に記録できます。<br />
              モニタリング周期は<strong>三ヶ月ごと</strong>に設定されています。
            </Typography>
          </Alert>
        )}
      </Box>
    </Container>
  );
};

export default TimeFlowSupportRecordPage;