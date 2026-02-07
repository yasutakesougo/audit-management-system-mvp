import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LockIcon from '@mui/icons-material/Lock';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import SaveIcon from '@mui/icons-material/Save';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BehaviorIntensity, BehaviorMood, BehaviorObservation, MOCK_OBSERVATION_MASTER } from '../../domain/daily/types';
import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';
import type { ScheduleItem } from './ProcedurePanel';

export type RecordPanelLockState = 'unlocked' | 'no-user' | 'unconfirmed';

type InteractiveRecordPanelProps = {
  title?: string;
  lockState: RecordPanelLockState;
  onSubmit: (data: Omit<BehaviorObservation, 'id' | 'userId'>) => Promise<void> | void;
  schedule?: ScheduleItem[];
  selectedSlotKey?: string;
  onSlotChange?: (next: string) => void;
  onAfterSubmit?: (slotKey: string | null) => void;
  recordDate?: Date;
  children?: undefined;
};

type CustomRecordPanelProps = {
  title?: string;
  lockState?: RecordPanelLockState;
  children: ReactNode;
  onSubmit?: never;
};

export type RecordPanelProps = InteractiveRecordPanelProps | CustomRecordPanelProps;

const isInteractiveRecordPanel = (props: RecordPanelProps): props is InteractiveRecordPanelProps =>
  'onSubmit' in props;

const MOOD_OPTIONS: BehaviorMood[] = ['良好', '普通', 'やや不安定', '不安定', '高揚', '疲労'];

export function RecordPanel(props: RecordPanelProps): JSX.Element {
  if (!isInteractiveRecordPanel(props)) {
    const { title, lockState = 'unlocked', children } = props;
    const isLocked = lockState !== 'unlocked';

    return (
      <Card
        variant="outlined"
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
        data-testid="record-panel"
      >
        {isLocked && (
          <Box
            data-testid="record-lock-overlay"
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'rgba(255,255,255,0.85)',
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: 1,
              px: 2
            }}
          >
            {lockState === 'no-user' ? (
              <PersonOffIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
            ) : (
              <LockIcon sx={{ fontSize: 48, color: 'warning.main' }} />
            )}
            <Typography variant="h6" color="text.secondary">
              {lockState === 'no-user' ? '支援対象者を選択してください' : '左のPlanを確認すると入力できます'}
            </Typography>
          </Box>
        )}
        <CardContent sx={{ flex: 1, overflowY: 'auto', p: 2, opacity: isLocked ? 0.5 : 1 }}>
          <Stack spacing={2}>
            <Typography variant="h6" component="h2" fontWeight="bold">
              {title ?? '行動記録 (Do)'}
            </Typography>
            {children}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const { title, lockState, onSubmit, schedule = [], selectedSlotKey: controlledSlotKey, onSlotChange, onAfterSubmit, recordDate } = props;
  const [selectedBehavior, setSelectedBehavior] = useState<string | null>(null);
  const [selectedAntecedent, setSelectedAntecedent] = useState<string | null>(null);
  const [selectedConsequence, setSelectedConsequence] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<BehaviorIntensity>(1);
  const [timestamp] = useState<string>(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [selectedSlotKey, setSelectedSlotKey] = useState('');
  const [actualObservation, setActualObservation] = useState('');
  const [staffResponse, setStaffResponse] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [memo, setMemo] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [userMood, setUserMood] = useState<BehaviorMood | null>(null);
  const observationRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const isControlledSlot = typeof controlledSlotKey === 'string';
  const effectiveSelectedSlotKey = isControlledSlot ? controlledSlotKey : selectedSlotKey;
  const resolvedRecordDate = useMemo(() => recordDate ?? new Date(), [recordDate]);
  const recordDateLabel = useMemo(
    () => resolvedRecordDate.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    [resolvedRecordDate]
  );

  const isLocked = lockState !== 'unlocked';
  const selectedSlot = useMemo(
    () => schedule.find((item) => getScheduleKey(item.time, item.activity) === effectiveSelectedSlotKey) ?? null,
    [schedule, effectiveSelectedSlotKey]
  );
  const observationText = actualObservation.trim();
  const slotSelected = Boolean(selectedSlot);
  const canSubmit =
    !isLocked &&
    ((Boolean(selectedBehavior) && observationText.length > 0) || (slotSelected && observationText.length > 0));
  const chipSize = useMemo(() => ({ py: 1.2, px: 1.5, fontSize: '0.95rem' }), []);

  useEffect(() => {
    if (!schedule.length) {
      if (!isControlledSlot) {
        setSelectedSlotKey('');
      }
      return;
    }
    if (!effectiveSelectedSlotKey) return;
    const stillExists = schedule.some((item) => getScheduleKey(item.time, item.activity) === effectiveSelectedSlotKey);
    if (!stillExists && !isControlledSlot) {
      setSelectedSlotKey('');
    }
  }, [schedule, effectiveSelectedSlotKey, isControlledSlot]);

  useEffect(() => {
    if (isLocked || !effectiveSelectedSlotKey) return;
    observationRef.current?.focus();
  }, [effectiveSelectedSlotKey, isLocked]);

  const handleSlotChange = (next: string) => {
    if (isControlledSlot) {
      onSlotChange?.(next);
      return;
    }
    setSelectedSlotKey(next);
    onSlotChange?.(next);
  };

  const handleSubmit = async () => {
    if (isLocked) return;
    const observation = actualObservation.trim();
    if (!observation) return;
    if (!selectedBehavior && !selectedSlot) return;
    await onSubmit({
      timestamp: new Date().toISOString(),
      behavior: selectedBehavior ?? '日常記録',
      antecedent: selectedAntecedent,
      consequence: selectedConsequence,
      intensity,
      durationMinutes,
      memo: memo.trim() || undefined,
      actualObservation: observation,
      staffResponse: staffResponse.trim() || undefined,
      followUpNote: followUpNote.trim() || undefined,
      timeSlot: selectedSlot?.time,
      plannedActivity: selectedSlot?.activity,
      userMood: userMood ?? undefined
    });
    setSelectedBehavior(null);
    setSelectedAntecedent(null);
    setSelectedConsequence(null);
    setIntensity(1);
    if (!isControlledSlot) {
      setSelectedSlotKey('');
    }
    setActualObservation('');
    setStaffResponse('');
    setFollowUpNote('');
    setMemo('');
    setDurationMinutes(5);
    setUserMood(null);
    onAfterSubmit?.(selectedSlot ? getScheduleKey(selectedSlot.time, selectedSlot.activity) : null);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}
      data-testid="record-panel"
    >
      {isLocked && (
        <Box
          data-testid="record-lock-overlay"
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(255,255,255,0.85)',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 1,
            px: 2
          }}
        >
          {lockState === 'no-user' ? (
            <PersonOffIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
          ) : (
            <LockIcon sx={{ fontSize: 48, color: 'warning.main' }} />
          )}
          <Typography variant="h6" color="text.secondary">
            {lockState === 'no-user' ? '支援対象者を選択してください' : '左のPlanを確認すると入力できます'}
          </Typography>
        </Box>
      )}
      <CardContent sx={{ flex: 1, overflowY: 'auto', p: 2, opacity: isLocked ? 0.5 : 1 }}>
        <Stack spacing={3}>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <Typography variant="h6" component="h2" fontWeight="bold">
              {title ?? '支援・行動記録 (Do)'}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={`記録日 ${recordDateLabel}`} size="small" />
              <Chip icon={<AccessTimeIcon />} label={timestamp} size="small" />
            </Stack>
          </Box>

          {schedule.length ? (
            <Box>
              <Typography variant="caption" color="text.secondary">
                対象の時間帯を選択 (Plan参照)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1, mb: 2 }}>
                {schedule.map((item) => {
                  const key = getScheduleKey(item.time, item.activity);
                  const isSelected = effectiveSelectedSlotKey === key;
                  return (
                    <Chip
                      key={key}
                      label={item.time}
                      color={isSelected ? 'primary' : 'default'}
                      variant={isSelected ? 'filled' : 'outlined'}
                      onClick={() => !isLocked && handleSlotChange(effectiveSelectedSlotKey === key ? '' : key)}
                      disabled={isLocked}
                      sx={{ fontWeight: isSelected ? 'bold' : undefined, minWidth: 72 }}
                    />
                  );
                })}
              </Box>
              {selectedSlot ? (
                <Paper
                  variant="outlined"
                  sx={{ p: 2, bgcolor: 'primary.50', borderColor: 'primary.main', transition: 'background-color 0.2s ease' }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <Box flex={1}>
                      <Typography variant="caption" color="text.secondary" fontWeight="bold">
                        本人のやること (Activity)
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {selectedSlot.activity}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedSlot.time}
                      </Typography>
                    </Box>
                    <Box flex={1}>
                      <Typography variant="caption" color="text.secondary" fontWeight="bold">
                        支援者のやること (Instruction)
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {selectedSlot.instruction}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              ) : (
                <Alert severity="info" sx={{ py: 0 }}>
                  時間帯を選択すると、支援内容(Plan)が表示されます
                </Alert>
              )}
            </Box>
          ) : (
            <Alert severity="info">
              ProcedurePanel 未選択のため時間割とリンクしていません。通常の行動記録が行えます。
            </Alert>
          )}

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              本人の様子・実施記録
            </Typography>
            <TextField
              label={selectedBehavior ? '行動の詳細状況' : '本人の様子・活動の記録'}
              placeholder={selectedSlot
                ? `例: ${selectedSlot.activity}に取り組めた。落ち着いていた。`
                : '例: 穏やかに過ごしている。'}
              value={actualObservation}
              onChange={(event) => setActualObservation(event.target.value)}
              multiline
              minRows={2}
              disabled={isLocked}
              required={!selectedBehavior}
              inputRef={observationRef}
              fullWidth
              sx={{ mb: 2 }}
            />
            <Typography variant="caption" color="text.secondary">
              状態 (Mood)
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap' }}
              value={userMood ?? ''}
              onChange={(_, value) => setUserMood(value || null)}
              disabled={isLocked}
            >
              {MOOD_OPTIONS.map((mood) => (
                <ToggleButton key={mood} value={mood} sx={{ flexGrow: 1 }}>
                  {mood}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Box mt={2}>
              <Typography variant="caption" color="text.secondary">
                持続時間 (分)
              </Typography>
              <Slider
                value={durationMinutes}
                min={1}
                max={60}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 15, label: '15' },
                  { value: 30, label: '30' },
                  { value: 60, label: '60' },
                ]}
                valueLabelDisplay="auto"
                onChange={(_, value) => setDurationMinutes(value as number)}
                disabled={isLocked}
                sx={{ mt: 1 }}
              />
            </Box>
          </Box>

          <TextField
            label="スタッフ対応"
            placeholder="例: 刺激遮断のため席を移動し、視覚スケジュールを再提示"
            value={staffResponse}
            onChange={(event) => setStaffResponse(event.target.value)}
            multiline
            minRows={2}
            disabled={isLocked}
          />

          <TextField
            label="フォローアップ / 申し送り"
            placeholder="次のシフトへの申し送りや追加ケアの予定"
            value={followUpNote}
            onChange={(event) => setFollowUpNote(event.target.value)}
            multiline
            minRows={2}
            disabled={isLocked}
          />

          <TextField
            label="メモ"
            placeholder="その他の補足情報"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            multiline
            minRows={2}
            disabled={isLocked}
          />

          <Divider>
            <Chip label="問題行動があった場合のみ入力" size="small" />
          </Divider>

          <Box>
            <Typography variant="caption" color="text.secondary">
              特異行動・インシデント (ABC記録)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {MOCK_OBSERVATION_MASTER.behaviors.map((behavior) => {
                const isSelected = selectedBehavior === behavior;
                return (
                  <Chip
                    key={behavior}
                    label={behavior}
                    color={isSelected ? 'error' : 'default'}
                    variant={isSelected ? 'filled' : 'outlined'}
                    onClick={() => !isLocked && setSelectedBehavior((prev) => (prev === behavior ? null : behavior))}
                    sx={chipSize}
                    disabled={isLocked}
                  />
                );
              })}
            </Box>
          </Box>

          {selectedBehavior && (
            <Box sx={{ animation: 'fadeIn 0.3s ease', pl: 2, borderLeft: '4px solid', borderColor: 'error.light' }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    強度 (Intensity)
                  </Typography>
                  <Slider
                    value={intensity}
                    min={1}
                    max={5}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                    onChange={(_, value) => setIntensity(value as BehaviorIntensity)}
                    sx={{ color: 'error.main' }}
                    data-testid="behavior-intensity-slider"
                    disabled={isLocked}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    直前の状況 (Antecedent)
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {MOCK_OBSERVATION_MASTER.antecedents.map((antecedent) => (
                      <Chip
                        key={antecedent}
                        label={antecedent}
                        size="small"
                        color={selectedAntecedent === antecedent ? 'primary' : 'default'}
                        onClick={() =>
                          setSelectedAntecedent((prev) => (prev === antecedent ? null : antecedent))
                        }
                        disabled={isLocked}
                      />
                    ))}
                  </Box>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    対応・結果 (Consequence)
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {MOCK_OBSERVATION_MASTER.consequences.map((consequence) => (
                      <Chip
                        key={consequence}
                        label={consequence}
                        size="small"
                        color={selectedConsequence === consequence ? 'success' : 'default'}
                        onClick={() =>
                          setSelectedConsequence((prev) => (prev === consequence ? null : consequence))
                        }
                        disabled={isLocked}
                      />
                    ))}
                  </Box>
                </Box>
              </Stack>
            </Box>
          )}
        </Stack>
      </CardContent>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button
          fullWidth
          variant="contained"
          size="large"
          color={selectedBehavior ? 'error' : 'primary'}
          disabled={!canSubmit}
          startIcon={<SaveIcon />}
          onClick={handleSubmit}
          sx={{ height: 56, fontWeight: 'bold' }}
          data-testid="behavior-submit-button"
        >
          {selectedBehavior ? '行動記録を保存' : '支援記録を保存'}
        </Button>
      </Box>
    </Card>
  );
}

export default RecordPanel;
