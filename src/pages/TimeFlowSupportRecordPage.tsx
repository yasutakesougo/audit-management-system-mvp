// モックデータ（支援対象者）
const mockSupportUsers: SupportUser[] = [
  { id: '001', name: '田中太郎', planType: '日常生活',       isActive: true },
  { id: '005', name: '佐藤花子', planType: '作業活動',       isActive: true },
  { id: '012', name: '山田一郎', planType: 'コミュニケーション', isActive: true },
  { id: '018', name: '鈴木美子', planType: '健康管理',       isActive: true },
  { id: '023', name: '高橋次郎', planType: '社会生活',       isActive: true },
  { id: '030', name: '中村勇気', planType: '作業活動',       isActive: true },
  { id: '032', name: '小林さくら', planType: 'コミュニケーション', isActive: true },
];
import { TESTIDS } from '../testing/testids';
import { useUsersStore } from '@/features/users/store';
import {
  AccessTime as AccessTimeIcon,
  Assignment as AssignmentIcon,
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Checkbox,
  Collapse,
  Container,
  Divider,
  FormControlLabel,
  FormGroup,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Button,
} from '@mui/material';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { MoodId } from '../config/master';
import {
  abcOptionMap as abcCatalog,
  coerceMoodId,
  moodOptions as moodCatalog,
  moodsById,
} from '../config/master';
import {
  defaultSupportActivities,
  SupportActivityTemplate as MasterSupportActivityTemplate,
  SupportActivityTemplateZ
} from '../domain/support/types';
import {
  fallbackSupportActivities,
  SupportActivityTemplate as FlowSupportActivityTemplate,
  resolveSupportFlowForUser,
  SupportPlanDeployment,
  SupportStrategyStage
} from '../features/planDeployment/supportFlow';
import UserSideNav, { type UserProgressInfo } from './UserSideNav';
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
    mood?: string;
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
  personTaskCompleted?: boolean;
  supporterTaskCompleted?: boolean;
  moodMemo?: string;
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

import type { SupportUser } from '@/types/support';

const stageLabelMap: Record<SupportStrategyStage, string> = {
  proactive: '予防的支援',
  earlyResponse: '早期対応',
  crisisResponse: '危機対応',
  postCrisis: '事後対応',
};

const stageOrder: SupportStrategyStage[] = ['proactive', 'earlyResponse', 'crisisResponse', 'postCrisis'];

const SUPPORT_ACTIVITY_STORAGE_KEY = 'supportActivityTemplates';
const DAILY_RECORD_STORAGE_PREFIX = 'support.daily.v1'; // 保存フォーマットのバージョン管理に利用

const makeDailyKey = (userId: string, date: string) =>
  `${DAILY_RECORD_STORAGE_PREFIX}:${userId}:${date}`;

const loadDailyRecord = (userId: string, date: string): DailySupportRecord | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(makeDailyKey(userId, date));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailySupportRecord;
    // ざっくり型ガード（必要十分の最小チェック）
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.records)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveDailyRecord = (record: DailySupportRecord) => {
  if (typeof window === 'undefined') return;
  try {
    const key = makeDailyKey(record.personId, record.date);
    window.localStorage.setItem(key, JSON.stringify(record));
  } catch {
    // 保存失敗は握りつぶし（容量超など）
  }
};

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

const countRecordedTimeSlots = (records: SupportRecord[]): number =>
  records.reduce(
    (count, record) => count + (record.status === '記録済み' ? 1 : 0),
    0
  );

const ensureSummarySlotCounts = (
  summary: DailySupportRecord['summary'],
  records: SupportRecord[],
  totalSlots: number
): DailySupportRecord['summary'] => {
  const recordedCount = countRecordedTimeSlots(records);

  if (
    summary.totalTimeSlots === totalSlots &&
    summary.recordedTimeSlots === recordedCount
  ) {
    return summary;
  }

  return {
    ...summary,
    totalTimeSlots: totalSlots,
    recordedTimeSlots: recordedCount,
  };
};

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
  testId?: string;
  focusActivityKey?: string | null;
  listRef?: React.MutableRefObject<HTMLDivElement | null>;
}

type SlotFormState = {
  mood: MoodId | '';
  moodMemo: string;
  notes: string;
  intensity: '軽度' | '中度' | '重度' | '';
  showABC: boolean;
  abc: {
    antecedent: string;
    behavior: string;
    consequence: string;
  };
  personTaskCompleted: boolean;
  supporterTaskCompleted: boolean;
  error: string | null;
};

const TimeFlowSupportRecordList: React.FC<TimeFlowSupportRecordListProps> = ({
  activities,
  dailyRecord,
  onAddRecord,
  onUpdateRecord,
  testId,
  focusActivityKey,
  listRef,
}) => {
  const internalListRef = useRef<HTMLDivElement | null>(null);
  const resolvedListRef = listRef ?? internalListRef;
  const assignResolvedListRef = useCallback(
    (node: HTMLDivElement | null) => {
      resolvedListRef.current = node;
    },
    [resolvedListRef],
  );
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
      const moodId = coerceMoodId(record?.userCondition.mood);
      acc[activity.time] = {
        mood: moodId ?? '',
        moodMemo: record?.moodMemo ?? '',
        notes: record?.userActivities.notes ?? '',
        intensity: record?.abc?.intensity ?? '',
        showABC: Boolean(record?.abc),
        abc: {
          antecedent: record?.abc?.antecedent ?? '',
          behavior: record?.abc?.behavior ?? '',
          consequence: record?.abc?.consequence ?? '',
        },
        personTaskCompleted: Boolean(record?.personTaskCompleted ?? false),
        supporterTaskCompleted: Boolean(record?.supporterTaskCompleted ?? false),
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

  useEffect(() => {
    if (!focusActivityKey) {
      return;
    }
    setExpanded(focusActivityKey);
    const root = resolvedListRef.current;
    if (!root) {
      return;
    }
    const target = root.querySelector<HTMLElement>(
      `[data-accordion-key="${focusActivityKey}"]`
    );
    if (!target) {
      return;
    }
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const focusElement = () => {
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(focusElement);
    } else {
      focusElement();
    }
  }, [focusActivityKey, resolvedListRef]);

  const handleAccordionToggle = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const handleMoodSelect = (key: string, mood: MoodId | '') => {
    setFormState((prev) => {
      const current = prev[key];
      const nextMood =
        mood === '' ? '' : current?.mood === mood ? '' : mood;
      return {
        ...prev,
        [key]: {
          ...current,
          mood: nextMood,
          error: null,
        },
      };
    });
  };

  const handleMoodMemoChange = (key: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        moodMemo: value,
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

  const handleTaskCompletionToggle = (
    key: string,
    target: 'personTaskCompleted' | 'supporterTaskCompleted',
  ) => (_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setFormState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [target]: checked,
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
    const moodId = coerceMoodId(state.mood);
    if (!moodId) {
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
    const moodLabel = moodsById[moodId]?.label ?? state.mood;

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
        mood: moodLabel,
        behavior: state.notes || '特記事項なし',
        communication: baseRecord.userCondition.communication,
        physicalState: baseRecord.userCondition.physicalState,
      },
      personTaskCompleted: state.personTaskCompleted,
      supporterTaskCompleted: state.supporterTaskCompleted,
      moodMemo: state.moodMemo || undefined,
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
    <Stack spacing={2} ref={assignResolvedListRef} data-testid={testId}>
      {activities.map((activity) => {
        const state = formState[activity.time];
        const record = recordsByKey.get(activity.time);
        const isRecorded = record?.status === '記録済み';
        const selectedMoodLabel =
          state?.mood ? moodsById[state.mood as MoodId]?.label ?? '' : '';

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
              id={`${activity.time}-summary`}
              aria-controls={`${activity.time}-panel`}
              sx={{ px: 3, py: 2 }}
              data-accordion-key={activity.time}
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
                {state?.personTaskCompleted && (
                  <Chip label="本人手順完了" color="success" size="small" variant="outlined" />
                )}
                {state?.supporterTaskCompleted && (
                  <Chip label="支援手順完了" color="success" size="small" variant="outlined" />
                )}
                {selectedMoodLabel && (
                  <Chip
                    label={selectedMoodLabel}
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
            <AccordionDetails
              id={`${activity.time}-panel`}
              aria-labelledby={`${activity.time}-summary`}
              sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}
            >
              <Stack spacing={3}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" color="success.main" sx={{ fontWeight: 600 }}>
                    👤 本人のやること
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {activity.personTodo}
                  </Typography>
                  <FormGroup row sx={{ pl: 0.5 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={Boolean(state?.personTaskCompleted)}
                          onChange={handleTaskCompletionToggle(activity.time, 'personTaskCompleted')}
                        />
                      }
                      label="予定通り実施を確認"
                    />
                  </FormGroup>
                </Stack>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" color="secondary.main" sx={{ fontWeight: 600 }}>
                    🤝 支援者のやること
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {activity.supporterTodo}
                  </Typography>
                  <FormGroup row sx={{ pl: 0.5 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={Boolean(state?.supporterTaskCompleted)}
                          onChange={handleTaskCompletionToggle(activity.time, 'supporterTaskCompleted')}
                        />
                      }
                      label="支援手順どおり実施"
                    />
                  </FormGroup>
                </Stack>
                <Divider />
                <Box component="form" onSubmit={handleSubmit(activity)} noValidate>
                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        本人の様子 *
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
                        {moodCatalog.map((option) => (
                          <Chip
                            key={option.id}
                            label={option.label}
                            clickable
                            color={state?.mood === option.id ? 'primary' : 'default'}
                            variant={state?.mood === option.id ? 'filled' : 'outlined'}
                            onClick={() => handleMoodSelect(activity.time, option.id)}
                          />
                        ))}
                      </Stack>
                      <TextField
                        label="様子メモ"
                        placeholder="本人の様子について補足があれば入力してください"
                        value={state?.moodMemo ?? ''}
                        onChange={(event) => handleMoodMemoChange(activity.time, event.target.value)}
                        fullWidth
                        sx={{ mt: 2 }}
                        multiline
                        minRows={2}
                      />
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
                        aria-expanded={state?.showABC || false}
                        aria-controls={`${activity.time}-abc`}
                      >
                        行動をABC分析で詳しく記録する
                      </Button>
                      <Collapse
                        in={Boolean(state?.showABC)}
                        unmountOnExit
                        id={`${activity.time}-abc`}
                      >
                        <Stack spacing={2} mt={2}>
                          {(Object.keys(abcCatalog) as Array<keyof typeof abcCatalog>).map((field) => (
                            <Box key={field}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {field === 'antecedent' && 'A: 先行事象'}
                                {field === 'behavior' && 'B: 行動'}
                                {field === 'consequence' && 'C: 結果'}
                              </Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
                                {abcCatalog[field].map((option) => (
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
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      gap={2}
                    >
                      {!state?.mood && (
                        <Typography variant="caption" color="text.secondary">
                          「本人の様子」を選ぶと記録できます
                        </Typography>
                      )}
                      <Button type="submit" variant="contained" disabled={!state?.mood} data-testid={TESTIDS.supportProcedures.form.save}>
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

const SupportRecordReviewList: React.FC<{ dailyRecord: DailySupportRecord; testId?: string }> = ({ dailyRecord, testId }) => {
  const recorded = dailyRecord.records.filter((record) => record.status !== '未記録');

  if (recorded.length === 0) {
    return (
      <Alert severity="info">
        まだ記録はありません。タブを「記録入力」に切り替えて記録を追加してください。
      </Alert>
    );
  }

  return (
    <Stack spacing={2} data-testid={testId}>
      {recorded.map((record) => {
        const recordMoodId = coerceMoodId(record.userCondition.mood);
        const recordMoodLabel = recordMoodId
          ? moodsById[recordMoodId]?.label ?? ''
          : (record.userCondition.mood ?? '');

        return (
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
              {recordMoodLabel && (
                <Chip
                  label={`気分: ${recordMoodLabel}`}
                  color={recordMoodId === 'calm' ? 'success' : recordMoodId === 'happy' ? 'info' : 'default'}
                  size="small"
                  sx={{ alignSelf: 'flex-start' }}
                />
              )}
              {record.moodMemo && (
                <Typography variant="body2" color="text.secondary">
                  メモ: {record.moodMemo}
                </Typography>
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
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  label={record.personTaskCompleted ? '本人の手順: 実施' : '本人の手順: 未確認'}
                  size="small"
                  color={record.personTaskCompleted ? 'success' : 'default'}
                  variant={record.personTaskCompleted ? 'filled' : 'outlined'}
                />
                <Chip
                  label={record.supporterTaskCompleted ? '支援者の手順: 実施' : '支援者の手順: 未確認'}
                  size="small"
                  color={record.supporterTaskCompleted ? 'success' : 'default'}
                  variant={record.supporterTaskCompleted ? 'filled' : 'outlined'}
                />
              </Stack>
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
        );
      })}
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
    const moodCount = Object.fromEntries(
      moodCatalog.map((option) => [option.id, 0]),
    ) as Record<MoodId, number>;
    let unknownMoodCount = 0;
    const intensityCount: Record<'軽度' | '中度' | '重度', number> = {
      軽度: 0,
      中度: 0,
      重度: 0,
    };

    dailyRecord.records.forEach((record) => {
      const moodId = coerceMoodId(record.userCondition.mood);
      if (moodId) {
        moodCount[moodId] = (moodCount[moodId] ?? 0) + 1;
      } else {
        unknownMoodCount += 1;
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
      unknownMoodCount,
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
                {moodCatalog.map((option) => (
                  <Stack key={option.id} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{option.label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {metrics.moodCount[option.id]} 件
                    </Typography>
                  </Stack>
                ))}
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">未記録</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {metrics.unknownMoodCount} 件
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

const SupportPlanQuickView: React.FC<{
  dailyRecord: DailySupportRecord;
  activities: FlowSupportActivityTemplate[];
  onSelectActivity: (activity: FlowSupportActivityTemplate) => void;
}> = ({ dailyRecord, activities, onSelectActivity }) => {
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
            <CardActionArea
              onClick={() => onSelectActivity(nextActivity)}
              component="div"
              title={`「${nextActivity.title}」の入力ステップを開く`}
            >
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
            </CardActionArea>
          ) : (
            <Alert severity="success" variant="outlined">
              すべての時間帯が記録済みです。お疲れさまでした！
            </Alert>
          )}

          {pendingActivities.slice(1, 4).map((activity) => (
            <CardActionArea
              key={activity.time}
              onClick={() => onSelectActivity(activity)}
              component="div"
              title={`「${activity.title}」の入力ステップを開く`}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {activity.time} {activity.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stageLabelMap[activity.stage]}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                本人: {activity.personTodo}
              </Typography>
            </CardActionArea>
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

// モックデータ（支援対象者）
// モック日次記録生成（時間フロー対応）
const generateMockTimeFlowDailyRecord = (
  user: SupportUser,
  date: string,
  activities: FlowSupportActivityTemplate[],
  deployment: SupportPlanDeployment | null
): DailySupportRecord => {
  const moodSamples: string[] = moodCatalog.length > 0
    ? moodCatalog.map((option) => option.label)
    : ['落ち着いている'];
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
      personTaskCompleted: true,
      supporterTaskCompleted: true,
      moodMemo: '安定して過ごせていました',
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
  // ステッパー用 state (for main stepper UI)
  const [stepIndex, setStepIndex] = useState(0);
  const handlePrevStep = () => setStepIndex(i => Math.max(i - 1, 0));
  const handleNextStep = () => setStepIndex(i => Math.min(i + 1, supportActivities.length - 1));
  const [masterSupportActivities, setMasterSupportActivities] = useState<FlowSupportActivityTemplate[]>(DEFAULT_FLOW_MASTER_ACTIVITIES);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  // 対策: 初期値を空文字にリセット
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPlanType, setSelectedPlanType] = useState<string>('');
  // 対策: 検索語句・プラン種別フィルタをリセットする関数
  useEffect(() => {
    setSearchTerm('');
    setSelectedPlanType('');
  }, []);
  const [dailyRecords, setDailyRecords] = useState<Record<string, DailySupportRecord>>({});
  const [activeTab, setActiveTab] = useState<'input' | 'review'>('input');
  const [selectionClearedNotice, setSelectionClearedNotice] = useState<boolean>(false);
  const recordSectionRef = useRef<HTMLDivElement | null>(null);
  const recordListRef = useRef<HTMLDivElement | null>(null);
  const [focusActivityKey, setFocusActivityKey] = useState<string | null>(null);
  const lastFocusedUserRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const { data: masterUsers = [] } = useUsersStore();
  // 開発環境（SharePointモック時）は必ずmockSupportUsersを利用
  const supportUsers = useMemo<SupportUser[]>(() => {
    if (masterUsers.length === 0) {
      // fallback: mockSupportUsers
      return mockSupportUsers;
    }
    return (masterUsers ?? [])
      .filter((user) => user && user.IsActive !== false && user.IsSupportProcedureTarget === true)
      .map((user) => {
        const baseName = user.FullName?.trim() || user.UserID?.trim() || `ID:${user.Id}`;
        return {
          id: String(user.Id),
          name: baseName,
          planType: '個別',
          isActive: user.IsActive !== false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [masterUsers]);
  const baseRoute = '/records/support-procedures';

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


  const planTypeOptions = useMemo(() => {
    const map = new Map<string, number>();
    mockSupportUsers.forEach((u) => {
      map.set(u.planType, (map.get(u.planType) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'ja'))
      .map(([value, count]) => ({ value, count }));
  }, []);

  // フィルタリングされたユーザー
  const filteredUsers = useMemo<SupportUser[]>(() => {
    const term = searchTerm.trim().toLowerCase();
    return supportUsers
      .filter((u) => (selectedPlanType ? u.planType === selectedPlanType : true))
      .filter((u) => (term ? u.name.toLowerCase().includes(term) : true));
  }, [selectedPlanType, searchTerm, supportUsers]);

  const userProgressInfo = useMemo<Record<string, UserProgressInfo>>(() => {
    return supportUsers.reduce<Record<string, UserProgressInfo>>((acc, user) => {
      const recordKey = `${user.id}-${selectedDate}`;
      const record = dailyRecords[recordKey];
      const total =
        record?.summary.totalTimeSlots ??
        supportActivities.length;
      const safeTotal = Math.max(total, supportActivities.length || 1);
      const completed = record
        ? Math.min(
            record.records.filter((entry) => entry.status === '記録済み').length,
            safeTotal
          )
        : 0;
      acc[user.id] = {
        completed,
        total: safeTotal,
      };
      return acc;
    }, {});
  }, [dailyRecords, selectedDate, supportActivities.length, supportUsers]);

  useEffect(() => {
    if (selectedUser && !filteredUsers.some((user) => user.id === selectedUser)) {
      setSelectedUser('');
      setSelectionClearedNotice(true);
      setFocusActivityKey(null);
      navigate(baseRoute, { replace: true });
    }
  }, [filteredUsers, selectedUser, navigate, baseRoute]);

  const handleUserSelect = (userId: string) => {
    setFocusActivityKey(null);
    setSelectedUser(userId);
    setActiveTab('input');
    setSelectionClearedNotice(false);
    if (routeUserId !== userId) {
      navigate(`${baseRoute}/${userId}`, { replace: false });
    }
  };

  useEffect(() => {
    if (!routeUserId) {
      if (selectedUser) {
        setSelectedUser('');
        setSelectionClearedNotice(false);
        setFocusActivityKey(null);
      }
      return;
    }

    if (supportUsers.length === 0) {
      return;
    }

    const match = supportUsers.find((user) => user.id === routeUserId);
    if (match) {
      if (selectedUser !== match.id) {
        setSelectedUser(match.id);
        setSelectionClearedNotice(false);
      }
      return;
    }

    setSelectedUser('');
    setSelectionClearedNotice(true);
    setFocusActivityKey(null);
    navigate(baseRoute, { replace: true });
  }, [routeUserId, supportUsers, selectedUser, navigate, baseRoute]);

  const recordKey = selectedUser ? `${selectedUser}-${selectedDate}` : null;

  const currentDailyRecord = recordKey ? dailyRecords[recordKey] ?? null : null;

  useEffect(() => {
    if (!recordKey || !selectedUser) {
      return;
    }

    const user = supportUsers.find((candidate) => candidate.id === selectedUser);
    if (!user) {
      return;
    }

    setDailyRecords((prev) => {
      const existing = prev[recordKey];
      const totalSlots = supportActivities.length;
      const desiredPlanId =
        supportDeployment?.planId ?? existing?.supportPlanId ?? `plan-${selectedUser}`;

      // 1) 既存 state がなければ localStorage を先に探す
      if (!existing) {
        const restored = loadDailyRecord(user.id, selectedDate);
        if (restored) {
          // 計画IDとサマリーの整合をとってから採用
          const withPlan: DailySupportRecord = {
            ...restored,
            supportPlanId: desiredPlanId,
            records: restored.records.map((r) => ({ ...r, supportPlanId: desiredPlanId })),
          };
          const summary = ensureSummarySlotCounts(
            withPlan.summary,
            withPlan.records,
            totalSlots
          );
          return { ...prev, [recordKey]: { ...withPlan, summary } };
        }
        // 見つからなければ従来どおりモック生成
        const newRecord = generateMockTimeFlowDailyRecord(
          user,
          selectedDate,
          supportActivities,
          supportDeployment
        );
        const summary = ensureSummarySlotCounts(newRecord.summary, newRecord.records, totalSlots);
        return { ...prev, [recordKey]: { ...newRecord, summary } };
      }

      // 2) 既存あり → 計画ID・サマリーの整合だけ取る
      let nextRecord = existing;
      let changed = false;

      if (existing.supportPlanId !== desiredPlanId) {
        nextRecord = {
          ...nextRecord,
          supportPlanId: desiredPlanId,
          records: nextRecord.records.map((record) => ({
            ...record,
            supportPlanId: desiredPlanId,
          })),
        };
        changed = true;
      }

      const updatedSummary = ensureSummarySlotCounts(
        nextRecord.summary,
        nextRecord.records,
        totalSlots
      );

      if (updatedSummary !== nextRecord.summary) {
        nextRecord = { ...nextRecord, summary: updatedSummary };
        changed = true;
      }

      if (!changed) return prev;
      return { ...prev, [recordKey]: nextRecord };
    });
  }, [recordKey, selectedUser, selectedDate, supportActivities, supportDeployment, supportUsers]);

  // currentDailyRecord が更新されたら localStorage に保存
  useEffect(() => {
    if (!currentDailyRecord || !selectedUser) return;
    saveDailyRecord(currentDailyRecord);
  }, [currentDailyRecord, selectedUser]);

  // 他タブの更新を取り込む（storage イベント）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (!selectedUser) return;
      if (!e.key || !e.newValue) return;
      const keyPrefix = makeDailyKey(selectedUser, selectedDate);
      if (e.key !== keyPrefix) return;
      try {
        const parsed = JSON.parse(e.newValue) as DailySupportRecord;
        if (!parsed || !Array.isArray(parsed.records)) return;
        setDailyRecords((prev) => ({
          ...prev,
          [`${selectedUser}-${selectedDate}`]: parsed,
        }));
      } catch {
        // 破損データは無視
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [selectedUser, selectedDate]);

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
    const nextRecords = [...currentDailyRecord.records, record];
    const updatedDailyRecord: DailySupportRecord = {
      ...currentDailyRecord,
      records: nextRecords,
      status: '作成中',
      summary: ensureSummarySlotCounts(
        currentDailyRecord.summary,
        nextRecords,
        supportActivities.length
      ),
    };

    setDailyRecords(prev => ({
      ...prev,
      [recordKey]: updatedDailyRecord
    }));
    // 保存は上の useEffect（currentDailyRecord 依存）が面倒を見る
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
      summary: ensureSummarySlotCounts(
        currentDailyRecord.summary,
        updatedRecords,
        supportActivities.length
      ),
    };

    setDailyRecords(prev => ({
      ...prev,
      [recordKey]: updatedDailyRecord
    }));
    // 保存は上の useEffect が面倒を見る
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
        summary: ensureSummarySlotCounts(
          target.summary,
          target.records,
          supportActivities.length
        ),
      };

      return {
        ...prev,
        [recordKey]: updatedRecord,
      };
    });
    // 保存は上の useEffect が面倒を見る
  };

  const handleQuickViewSelect = (activity: FlowSupportActivityTemplate) => {
    setActiveTab('input');
    setFocusActivityKey(activity.time);
    const target = recordListRef.current ?? recordSectionRef.current;
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (activeTab !== 'input') {
      setFocusActivityKey(null);
    }
  }, [activeTab]);

  useEffect(() => {
    setFocusActivityKey(null);
  }, [selectedDate]);

  useEffect(() => {
    if (!selectedUser || !currentDailyRecord || supportActivities.length === 0) {
      return;
    }
    if (lastFocusedUserRef.current === selectedUser) {
      return;
    }
    lastFocusedUserRef.current = selectedUser;
    const pendingActivity =
      supportActivities.find((activity) => {
        const record = currentDailyRecord.records.find(
          (entry) => entry.activityKey === activity.time
        );
        return !(record && record.status === '記録済み');
      }) ?? supportActivities[0];

    if (pendingActivity) {
      setFocusActivityKey(pendingActivity.time);
    }
    if (recordSectionRef.current) {
      recordSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedUser, currentDailyRecord, supportActivities]);

  const generateAutoSchedule = () => {
    if (!selectedUser) return;

    const user = supportUsers.find((u) => u.id === selectedUser);
    if (!user) return;

    const recordKey = `${selectedUser}-${selectedDate}`;
    const autoRecord = generateMockTimeFlowDailyRecord(
      user,
      selectedDate,
      supportActivities,
      supportDeployment
    );
    const summary = ensureSummarySlotCounts(
      autoRecord.summary,
      autoRecord.records,
      supportActivities.length
    );

    setDailyRecords(prev => ({
      ...prev,
      [recordKey]: {
        ...autoRecord,
        summary,
      }
    }));
  };

  const getActiveUsersCount = () => supportUsers.filter((u) => u.isActive).length;

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
            <Box sx={{ flexGrow: 1 }}>
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

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} alignItems="flex-start">
          <Stack
            component="aside"
            spacing={2}
            sx={{
              width: '100%',
              flexBasis: { md: '32%' },
              maxWidth: { md: 360 },
              position: { md: 'sticky' },
              top: { md: 32 },
            }}
          >
            <UserSideNav
              users={filteredUsers}
              userProgress={userProgressInfo}
              selectedUserId={selectedUser}
              selectedDate={selectedDate}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              planTypeOptions={planTypeOptions}
              selectedPlanType={selectedPlanType}
              onPlanTypeSelect={setSelectedPlanType}
              onSelectUser={handleUserSelect}
              onDateChange={setSelectedDate}
              selectionClearedNotice={selectionClearedNotice}
              onDismissClearedNotice={() => setSelectionClearedNotice(false)}
            />
            {selectedUser && (
              <PlanDeploymentSummary
                deployment={supportDeployment}
                activities={supportActivities}
              />
            )}
          </Stack>
          <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
            {selectedUser && currentDailyRecord ? (
              <Box ref={recordSectionRef}>
                <Stack spacing={3}>
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

                  <Paper elevation={1} data-testid={TESTIDS.supportProcedures.form.root}>
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
                              testId={TESTIDS.supportProcedures.table.root}
                              activities={supportActivities}
                              dailyRecord={currentDailyRecord}
                              onAddRecord={handleAddRecord}
                              onUpdateRecord={handleUpdateRecord}
                              focusActivityKey={focusActivityKey}
                              listRef={recordListRef}
                            />
                          </Box>
                          <Stack spacing={3} sx={{ flexBasis: { lg: '35%' }, flexGrow: 1 }}>
                            <DailyInsightsPanel dailyRecord={currentDailyRecord} />
                            <SupportPlanQuickView
                              dailyRecord={currentDailyRecord}
                              activities={supportActivities}
                              onSelectActivity={handleQuickViewSelect}
                            />
                          </Stack>
                        </Stack>
                      ) : (
                        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="stretch">
                          <Box sx={{ flexGrow: 1 }}>
                            <SupportRecordReviewList dailyRecord={currentDailyRecord} testId={TESTIDS.supportProcedures.table.root} />
                          </Box>
                          <Stack spacing={3} sx={{ flexBasis: { lg: '35%' }, flexGrow: 1 }}>
                            <DailyInsightsPanel dailyRecord={currentDailyRecord} />
                            <SupportPlanQuickView
                              dailyRecord={currentDailyRecord}
                              activities={supportActivities}
                              onSelectActivity={handleQuickViewSelect}
                            />
                          </Stack>
                        </Stack>
                      )}
                    </Box>
                  </Paper>

                  {activeTab === 'input' && currentDailyRecord && supportActivities.length > 0 && (
                    <Paper sx={{ p: 2, mt: 2 }}>
                      <Typography variant="h6" sx={{ mb: 2 }}>支援手順入力</Typography>
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          {stepIndex + 1} / {supportActivities.length} 件
                        </Typography>
                        <Button size="small" onClick={handlePrevStep} disabled={stepIndex === 0}>前へ</Button>
                        <Button size="small" onClick={handleNextStep} disabled={stepIndex === supportActivities.length - 1}>次へ</Button>
                      </Stack>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {supportActivities[stepIndex].time} {supportActivities[stepIndex].title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            本人: {supportActivities[stepIndex].personTodo}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            支援者: {supportActivities[stepIndex].supporterTodo}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Paper>
                  )}
                </Stack>
                {/* Save Button and Toast patch: Assume save button and toast are rendered in this component or its children. If not, user will adjust. */}
                {/* Example: */}
                {/* <Button data-testid={TESTID.SUPPORT_PROCEDURE_SAVE_BUTTON}>保存</Button> */}
                {/* <Snackbar open={saveSuccess} data-testid={TESTID.SUPPORT_PROCEDURE_TOAST}>保存しました</Snackbar> */}
              </Box>
            ) : (
              <Paper sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <Typography variant="h6" color="text.secondary">
                  左のリストから記録する利用者を選択してください。
                </Typography>
              </Paper>
            )}
          </Box>
        </Stack>
      </Box>
    </Container>
  );
};

export default TimeFlowSupportRecordPage;