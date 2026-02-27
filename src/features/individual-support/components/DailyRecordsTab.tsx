// ---------------------------------------------------------------------------
// DailyRecordsTab — 「日々の記録」タブ
// ---------------------------------------------------------------------------
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
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';

import {
    type ABCSelection,
    type ScheduleSlot,
    type SlotFormState,
    type TimelineEntry,
    abcOptionMap,
    moodOptions,
} from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DailyRecordsTabProps {
  slots: ScheduleSlot[];
  formState: Record<string, SlotFormState>;
  timeline: TimelineEntry[];
  showOnlyUnrecorded: boolean;
  onMoodSelect: (slotId: string, mood: string) => void;
  onNoteChange: (slotId: string, value: string) => void;
  onToggleABC: (slotId: string) => void;
  onABCSelect: (slotId: string, key: keyof ABCSelection, value: string) => void;
  onRecord: (slot: ScheduleSlot) => void;
  onToggleUnrecorded: (checked: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DailyRecordsTab: React.FC<DailyRecordsTabProps> = ({
  slots,
  formState,
  timeline,
  showOnlyUnrecorded,
  onMoodSelect,
  onNoteChange,
  onToggleABC,
  onABCSelect,
  onRecord,
  onToggleUnrecorded,
}) => {
  const visibleSlots = useMemo(
    () => (showOnlyUnrecorded ? slots.filter((s) => !s.isRecorded) : slots),
    [showOnlyUnrecorded, slots],
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        時系列の記録リスト
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <FormControlLabel
          control={
            <Switch
              checked={showOnlyUnrecorded}
              onChange={(_event, checked) => onToggleUnrecorded(checked)}
            />
          }
          label="未記録のみ表示"
        />
      </Box>

      <Stack spacing={2}>
        {visibleSlots.map((slot) => {
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
                        onClick={() => onMoodSelect(slot.id, option)}
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
                    onChange={(event) => onNoteChange(slot.id, event.target.value)}
                  />
                </Stack>

                <Box>
                  <Button
                    size="small"
                    variant={state?.showABC ? 'outlined' : 'text'}
                    onClick={() => onToggleABC(slot.id)}
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
                                onClick={() => onABCSelect(slot.id, key, option)}
                              />
                            ))}
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  </Collapse>
                </Box>

                {hasError && (
                  <Alert severity="warning" onClose={() => onMoodSelect(slot.id, '')}>
                    {state?.error}
                  </Alert>
                )}

                <Box display="flex" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    onClick={() => onRecord(slot)}
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
  );
};
