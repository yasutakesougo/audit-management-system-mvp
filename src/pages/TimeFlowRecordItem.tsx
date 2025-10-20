import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Button, Chip, Stack, Typography } from '@mui/material';
import React from 'react';

export type MoodOption = '良好' | '落ち着いている' | '不安' | '怒り' | '悲しみ';

export interface TimeFlowRecordItemProps {
  activity: {
    time: string;
    title: string;
    personTodo: string;
    supporterTodo: string;
    stage: string;
  };
  state: {
    mood: MoodOption;
    notes: string;
    abc: {
      antecedent?: string;
      behavior?: string;
      consequence?: string;
      intensity?: string;
    };
    showABC: boolean;
    error?: string | null;
    loading?: boolean;
    execution: {
      client: { performed: boolean; memo?: string };
      supporter: { performed: boolean; memo?: string };
      followUp?: {
        improvementMemo?: string;
        nextAttention?: string;
      };
    };
  };
  expanded: boolean;
  autoFocusKey?: string;
  onAccordionToggle: () => void;
  onMoodSelect: (key: string, mood: MoodOption) => void;
  onNotesChange: (key: string, notes: string) => void;
  onExecutionToggle: (key: string, role: 'client' | 'supporter') => void;
  onExecutionMemoChange: (key: string, role: 'client' | 'supporter') => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onFollowUpChange: (key: string, field: 'improvementMemo' | 'nextAttention') => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onToggleABC: (key: string) => void;
  onABCSelect: (key: string, field: keyof TimeFlowRecordItemProps['state']['abc'], value: string) => void;
  onIntensitySelect: (key: string, intensity: string) => void;
  onSubmit: (activity: {
    time: string;
    title: string;
    personTodo: string;
    supporterTodo: string;
    stage: string;
  }) => (e: React.FormEvent<HTMLFormElement>) => void;
}

const moodOptions: MoodOption[] = ['良好', '落ち着いている', '不安', '怒り', '悲しみ'];
const intensityOptions = ['軽度', '中度', '重度'];
const abcOptionMap = {
  antecedent: ['課題中', '要求があった', '感覚刺激', '他者との関わり'],
  behavior: ['大声を出す', '物を叩く', '自傷行為', '他害行為'],
  consequence: ['クールダウン', '要求に応えた', '無視(意図的)', '場所移動'],
};

export const TimeFlowRecordItem: React.FC<TimeFlowRecordItemProps> = ({
  activity,
  state,
  expanded,
  onAccordionToggle,
  onMoodSelect,
  onNotesChange,
  onToggleABC,
  onABCSelect,
  onIntensitySelect,
  onSubmit,
}) => {
  return (
    <Accordion expanded={expanded} onChange={onAccordionToggle} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center" flexGrow={1}>
          <Typography variant="h6" color="primary">
            {activity.time}
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {activity.title}
          </Typography>
          {state.mood && (
            <Chip
              label={state.mood}
              color="primary"
              size="small"
              variant="outlined"
            />
          )}
          {state.abc.intensity && (
            <Chip
              label={`強度: ${state.abc.intensity}`}
              color={state.abc.intensity === '重度' ? 'warning' : state.abc.intensity === '中度' ? 'secondary' : 'default'}
              size="small"
              variant="outlined"
            />
          )}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
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
          <form onSubmit={onSubmit(activity)} noValidate>
            <Stack spacing={3}>
              <Stack direction="row" spacing={1} alignItems="center">
                {moodOptions.map((option) => (
                  <Chip
                    key={option}
                    label={option}
                    clickable
                    color={state.mood === option ? 'primary' : 'default'}
                    variant={state.mood === option ? 'filled' : 'outlined'}
                    onClick={() => onMoodSelect(activity.time, option)}
                  />
                ))}
              </Stack>
              <Button type="submit" variant="contained" color="success" size="small">
                予定通り完了
              </Button>
              <Stack spacing={1} mt={1.5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  特記事項
                </Typography>
                <textarea
                  value={state.notes}
                  onChange={(e) => onNotesChange(activity.time, e.target.value)}
                  rows={2}
                  style={{ width: '100%' }}
                  placeholder="気づいたことや共有したい内容を記入してください"
                />
              </Stack>
              <Button
                size="small"
                variant={state.showABC ? 'outlined' : 'text'}
                onClick={() => onToggleABC(activity.time)}
              >
                行動をABC分析で詳しく記録する
              </Button>
              {state.showABC && (
                <Stack spacing={2} mt={2}>
                  {(Object.keys(abcOptionMap) as Array<keyof typeof abcOptionMap>).map((field) => (
                    <Stack key={field} spacing={1}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {field === 'antecedent' && 'A: 先行事象'}
                        {field === 'behavior' && 'B: 行動'}
                        {field === 'consequence' && 'C: 結果'}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {abcOptionMap[field].map((option) => (
                          <Chip
                            key={option}
                            label={option}
                            clickable
                            color={state.abc[field] === option ? 'primary' : 'default'}
                            variant={state.abc[field] === option ? 'filled' : 'outlined'}
                            onClick={() => onABCSelect(activity.time, field, option)}
                          />
                        ))}
                      </Stack>
                    </Stack>
                  ))}
                  <Stack spacing={1}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      行動の強度
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {intensityOptions.map((option) => (
                        <Chip
                          key={option}
                          label={option}
                          clickable
                          color={state.abc.intensity === option ? 'primary' : 'default'}
                          variant={state.abc.intensity === option ? 'filled' : 'outlined'}
                          onClick={() => onIntensitySelect(activity.time, option)}
                        />
                      ))}
                    </Stack>
                  </Stack>
                </Stack>
              )}
              {state.error && (
                <Typography color="error" variant="body2">
                  {state.error}
                </Typography>
              )}
            </Stack>
          </form>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
