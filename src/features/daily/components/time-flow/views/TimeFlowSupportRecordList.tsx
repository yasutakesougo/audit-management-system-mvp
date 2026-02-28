// ---------------------------------------------------------------------------
// TimeFlowSupportRecordList — 時間帯別ABC入力アコーディオン
// ---------------------------------------------------------------------------

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import React, { useEffect, useMemo, useState } from 'react';

import { abcOptionMap, moodOptions, stageLabelMap } from '../timeFlowConstants';
import type { DailySupportRecord, SlotFormState, SupportRecord } from '../timeFlowTypes';
import type { FlowSupportActivityTemplate } from '../timeFlowUtils';

interface TimeFlowSupportRecordListProps {
  activities: FlowSupportActivityTemplate[];
  dailyRecord: DailySupportRecord;
  onAddRecord: (record: SupportRecord) => void;
  onUpdateRecord: (record: SupportRecord) => void;
}

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

export default TimeFlowSupportRecordList;
