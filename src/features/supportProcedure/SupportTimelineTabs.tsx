import type { SupportActivityTemplate, SupportStrategyStage } from '@/features/planDeployment/supportFlow';
import {
  useSupportProcedureStore,
  type SupportProcedureRecord,
} from '@/features/supportProcedure/store';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import Diversity3RoundedIcon from '@mui/icons-material/Diversity3Rounded';
import HealingRoundedIcon from '@mui/icons-material/HealingRounded';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { demoSupportActivities } from './demoSupportActivities';

// ===== Types & constants =====

type AbcField = 'antecedent' | 'behavior' | 'consequence';

type ActivityFormState = {
  mood: string;
  notes: string;
  includeAbc: boolean;
  abc: {
    antecedent: string;
    behavior: string;
    consequence: string;
  };
  recordedAt: string | null;
};

const abcOptionMap: Record<AbcField, string[]> = {
  antecedent: ['課題中', '要求があった', '感覚刺激', '他者との関わり'],
  behavior: ['大声を出す', '物を叩く', '自傷行為', '他害行為'],
  consequence: ['クールダウン', '要求に応えた', '無視(意図的)', '場所移動'],
};

const createInitialState = (): ActivityFormState => ({
  mood: '',
  notes: '',
  includeAbc: false,
  abc: {
    antecedent: '',
    behavior: '',
    consequence: '',
  },
  recordedAt: null,
});

const stageOrder: SupportStrategyStage[] = ['proactive', 'earlyResponse', 'crisisResponse', 'postCrisis'];

const stageLabelMap: Record<SupportStrategyStage, string> = {
  proactive: '予防的支援',
  earlyResponse: '早期対応',
  crisisResponse: '危機対応',
  postCrisis: '事後対応',
};

const stageIconMap: Record<SupportStrategyStage, React.ReactElement> = {
  proactive: <Diversity3RoundedIcon fontSize="small" />,
  earlyResponse: <HealingRoundedIcon fontSize="small" />,
  crisisResponse: <LocalFireDepartmentRoundedIcon fontSize="small" />,
  postCrisis: <ReplayRoundedIcon fontSize="small" />,
};

const moodOptions = ['落ち着いている', '楽しそう', '集中している', '不安そう', 'イライラ'];

// ===== Props =====

type SupportTimelineTabsProps = {
  userId: string;
  date: string;
  activities: SupportActivityTemplate[];
};

// ===== helpers =====

const buildRecordLookup = (
  records: Record<string, SupportProcedureRecord>,
  userId: string,
  date: string,
): Record<string, SupportProcedureRecord> => {
  const map: Record<string, SupportProcedureRecord> = {};
  Object.values(records).forEach((r) => {
    if (r.userId === userId && r.date === date) {
      map[r.activityTime] = r;
    }
  });
  return map;
};

// ===== component =====

export const SupportTimelineTabs: React.FC<SupportTimelineTabsProps> = ({ userId, date, activities }) => {
  // デモ用支援手順を fallback として利用
  const effectiveActivities = activities && activities.length > 0 ? activities : demoSupportActivities;
  const theme = useTheme();
  const [{ records, upsertRecord, clearRecord, version }] = useSupportProcedureStore(
    (state) => [
      {
        records: state.records,
        upsertRecord: state.upsertRecord,
        clearRecord: state.clearRecord,
        version: state.version,
      },
    ],
    shallow,
  );

  const [activeStage, setActiveStage] = useState<SupportStrategyStage>('proactive');
  const [formState, setFormState] = useState<Record<string, ActivityFormState>>({});
  const contextRef = useRef<string>('');

  // refs for auto-scroll
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const savedRecords = useMemo(() => buildRecordLookup(records, userId, date), [records, userId, date]);

  const groupedActivities = useMemo(() => {
    return stageOrder.reduce<Record<SupportStrategyStage, SupportActivityTemplate[]>>(
      (acc, stage) => {
        acc[stage] = effectiveActivities
          .filter((a) => a.stage === stage)
          .sort((a, b) => a.time.localeCompare(b.time, 'ja'));
        return acc;
      },
      { proactive: [], earlyResponse: [], crisisResponse: [], postCrisis: [] },
    );
  }, [effectiveActivities]);

  const colorByStage = useMemo<Record<SupportStrategyStage, string>>(
    () => ({
      proactive: theme.palette.success.light,
      earlyResponse: theme.palette.info.light,
      crisisResponse: theme.palette.warning.light,
      postCrisis: theme.palette.secondary.light,
    }),
    [theme.palette.info.light, theme.palette.secondary.light, theme.palette.success.light, theme.palette.warning.light],
  );

  useEffect(() => {
    if (!userId || !date) {
      setFormState({});
      contextRef.current = '';
      return;
    }
    const contextKey = `${userId}|${date}|${effectiveActivities.length}`;
    setFormState((prev) => {
      const next: Record<string, ActivityFormState> = {};
      effectiveActivities.forEach((activity) => {
        const saved = savedRecords[activity.time];
        if (saved) {
          next[activity.time] = {
            mood: saved.mood,
            notes: saved.notes,
            includeAbc: saved.includeAbc,
            abc: {
              antecedent: saved.abc?.antecedent ?? '',
              behavior: saved.abc?.behavior ?? '',
              consequence: saved.abc?.consequence ?? '',
            },
            recordedAt: saved.recordedAt,
          };
        } else if (contextRef.current !== contextKey) {
          next[activity.time] = createInitialState();
        } else {
          next[activity.time] = prev[activity.time] ?? createInitialState();
        }
      });
      return next;
    });
    contextRef.current = contextKey;
  }, [effectiveActivities, date, savedRecords, userId, version]);

  // Auto-scroll to first unrecorded card when user/date/activities change
  useEffect(() => {
    if (!userId || !date) return;
    const unrecorded = effectiveActivities.find((activity) => {
      const state = formState[activity.time] ?? createInitialState();
      return !state.recordedAt;
    });
    if (unrecorded && cardRefs.current[unrecorded.time]) {
      cardRefs.current[unrecorded.time]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [userId, date, effectiveActivities, formState]);

  const updateForm = (time: string, updater: (prev: ActivityFormState) => ActivityFormState) => {
    setFormState((prev) => ({
      ...prev,
      [time]: updater(prev[time] ?? createInitialState()),
    }));
  };

  const handleTabChange = (_e: React.SyntheticEvent, next: SupportStrategyStage) => setActiveStage(next);

  const handleRecord = (activity: SupportActivityTemplate, state: ActivityFormState) => {
    if (!userId || !date) return;
    const recordedAt = new Date().toISOString();
    upsertRecord({
      userId,
      date,
      activityTime: activity.time,
      activityTitle: activity.title,
      stage: activity.stage,
      mood: state.mood,
      notes: state.notes,
      includeAbc: state.includeAbc,
      abc: state.includeAbc
        ? {
            antecedent: state.abc.antecedent || undefined,
            behavior: state.abc.behavior || undefined,
            consequence: state.abc.consequence || undefined,
          }
        : undefined,
      recordedAt,
    });
    updateForm(activity.time, () => ({ ...state, recordedAt }));
  };

  const handleReset = (activityTime: string) => {
    if (userId && date) clearRecord(userId, date, activityTime);
    updateForm(activityTime, () => createInitialState());
  };

  const renderLegend = () => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {stageOrder.map((stage) => (
        <Chip
          key={`legend-${stage}`}
          size="small"
          label={stageLabelMap[stage]}
          icon={stageIconMap[stage]}
          sx={{ backgroundColor: colorByStage[stage], '& .MuiChip-label': { fontWeight: 500 } }}
        />
      ))}
    </Box>
  );

  const renderActivityCard = (activity: SupportActivityTemplate) => {
    const state = formState[activity.time] ?? createInitialState();
    const saved = savedRecords[activity.time];
    const isRecorded = Boolean(state.recordedAt);
    const hasChanges =
      !saved ||
      state.mood !== saved.mood ||
      state.notes !== saved.notes ||
      state.includeAbc !== saved.includeAbc ||
      (state.includeAbc && (
        (!!state.abc.antecedent !== !!saved.abc?.antecedent ||
          !!state.abc.behavior !== !!saved.abc?.behavior ||
          !!state.abc.consequence !== !!saved.abc?.consequence ||
          state.abc.antecedent !== (saved.abc?.antecedent ?? '') ||
          state.abc.behavior !== (saved.abc?.behavior ?? '') ||
          state.abc.consequence !== (saved.abc?.consequence ?? '')
        )
      ));

    const canRecord = Boolean(state.mood) && hasChanges;

    const handleClear = () => {
      if (saved) {
        updateForm(activity.time, () => ({
          mood: saved.mood,
          notes: saved.notes,
          includeAbc: saved.includeAbc,
          abc: {
            antecedent: saved.abc?.antecedent ?? '',
            behavior: saved.abc?.behavior ?? '',
            consequence: saved.abc?.consequence ?? '',
          },
          recordedAt: saved.recordedAt,
        }));
      } else {
        handleReset(activity.time);
      }
    };

    return (
      <div ref={el => { cardRefs.current[activity.time] = el; }}>
        <Card key={`${activity.stage}-${activity.time}-${activity.title}`} variant="outlined">
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<AccessTimeRoundedIcon fontSize="small" />}
              size="small"
              label={activity.time}
              sx={{ backgroundColor: colorByStage[activity.stage], fontWeight: 600 }}
            />
            <Typography variant="subtitle1">{activity.title}</Typography>
            <Chip
              size="small"
              label={isRecorded ? '記録済み' : '未記録'}
              color={isRecorded ? 'success' : 'default'}
              variant={isRecorded ? 'filled' : 'outlined'}
            />
          </Box>

          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {activity.personTodo}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
            支援者の関わり: {activity.supporterTodo}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id={`mood-select-${activity.time}`}>本人の様子</InputLabel>
              <Select
                labelId={`mood-select-${activity.time}`}
                value={state.mood}
                label="本人の様子"
                onChange={(e) =>
                  updateForm(activity.time, (prev) => ({
                    ...prev,
                    mood: (e.target as HTMLSelectElement).value,
                  }))
                }
              >
                <MenuItem value="">
                  <em>未選択</em>
                </MenuItem>
                {moodOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={state.includeAbc}
                  onChange={(_, checked) =>
                    updateForm(activity.time, (prev) => ({
                      ...prev,
                      includeAbc: checked,
                      abc: checked ? prev.abc : { antecedent: '', behavior: '', consequence: '' },
                    }))
                  }
                />
              }
              label="ABC詳細も記録"
            />
          </Box>

          <TextField
            label="現場メモ"
            value={state.notes}
            onChange={(e) =>
              updateForm(activity.time, (prev) => ({
                ...prev,
                notes: (e.target as HTMLInputElement).value,
              }))
            }
            multiline
            minRows={2}
            fullWidth
          />

          <Collapse in={state.includeAbc}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
              {(Object.keys(abcOptionMap) as AbcField[]).map((field) => (
                <FormControl key={field} size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id={`${activity.time}-${field}`}>{field.toUpperCase()}</InputLabel>
                  <Select
                    labelId={`${activity.time}-${field}`}
                    label={field.toUpperCase()}
                    value={state.abc[field]}
                    onChange={(e) =>
                      updateForm(activity.time, (prev) => ({
                        ...prev,
                        abc: { ...prev.abc, [field]: (e.target as HTMLSelectElement).value },
                      }))
                    }
                  >
                    <MenuItem value="">
                      <em>未選択</em>
                    </MenuItem>
                    {abcOptionMap[field].map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ))}
            </Box>
          </Collapse>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleClear}
              disabled={!state.mood && !state.notes && !state.includeAbc && !state.recordedAt}
            >
              {saved ? '保存済みに戻す' : 'クリア'}
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => handleRecord(activity, state)}
              disabled={!canRecord}
            >
              {saved ? '更新する' : '記録する'}
            </Button>
          </Box>

          <Collapse in={Boolean(state.recordedAt)}>
            <Alert
              severity="success"
              sx={{ mt: 1 }}
              icon={<CheckCircleRoundedIcon fontSize="small" />}
              action={<Button size="small" color="inherit" onClick={() => handleReset(activity.time)}>再入力</Button>}
            >
              {state.recordedAt
                ? `記録済み：${new Date(state.recordedAt).toLocaleTimeString('ja-JP')}`
                : '記録しました'}
            </Alert>
          </Collapse>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Guards
  if (!userId) return <Alert severity="info">利用者を選択してください。</Alert>;
  if (!date) return <Alert severity="info">記録日を選択してください。</Alert>;

  // Main render
  return (
    <Box>
      {renderLegend()}
      <Tabs
        value={activeStage}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="支援戦略ステージ切り替え"
      >
        {stageOrder.map((stage) => (
          <Tab
            key={stage}
            value={stage}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {stageIconMap[stage]}
                <span>{stageLabelMap[stage]}</span>
                <Chip size="small" label={`${groupedActivities[stage].length}`} />
              </Box>
            }
          />
        ))}
      </Tabs>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {groupedActivities[activeStage].length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            デモ支援手順を表示しています。
          </Typography>
        ) : (
          groupedActivities[activeStage].map((activity) => renderActivityCard(activity))
        )}
      </Box>
    </Box>
  );
};

SupportTimelineTabs.displayName = 'SupportTimelineTabs';