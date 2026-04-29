import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';
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
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { type BehaviorIntensity, type BehaviorMood, type ABCRecord } from '@/domain/behavior';
import AbcRecordSection from './AbcRecordSection';
import PlanSlotSelector from './PlanSlotSelector';
import type { ScheduleItem } from './ProcedurePanel';
import { formatDateYmd } from '@/lib/dateFormat';

export type RecordPanelLockState = 'unlocked' | 'no-user' | 'unconfirmed';

type InteractiveRecordPanelProps = {
  title?: string;
  lockState: RecordPanelLockState;
  onSubmit: (data: Omit<ABCRecord, 'id' | 'userId'>) => Promise<void> | void;
  schedule?: ScheduleItem[];
  selectedSlotKey?: string;
  onSlotChange?: (next: string) => void;
  onAfterSubmit?: (slotKey: string | null) => void;
  recordDate?: Date;
  /** コンパクトモード: タイトル行非表示、余白縮小 (ウィザード用) */
  compact?: boolean;
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
          position: 'relative',
          transition: 'none',
          // hover/focus でピクつきやすい MUI の定番クラスだけ止める
          '& .MuiButtonBase-root, & .MuiChip-root, & .MuiToggleButton-root, & .MuiIconButton-root': {
            transition: 'none !important',
          },
          // 文字の色/opacity 変化（hover, disabled, selected）で残像化するのを止める
          '& .MuiTypography-root, & .MuiSvgIcon-root': {
            transition: 'none !important',
          },
          // outline/box-shadow の瞬間変化を抑制
          '& .MuiButtonBase-root:focus-visible': {
            outline: 'none',
          }
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

  const { title, lockState, onSubmit, schedule = [], selectedSlotKey: controlledSlotKey, onSlotChange, onAfterSubmit, recordDate, compact = false } = props;
  const [selectedBehavior, setSelectedBehavior] = useState<string | null>(null);
  const [selectedAntecedent, setSelectedAntecedent] = useState<string | null>(null);
  const [selectedConsequence, setSelectedConsequence] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<BehaviorIntensity>(1);
  const [timestamp] = useState<string>(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [selectedSlotKey, setSelectedSlotKey] = useState(controlledSlotKey ?? '');
  const [actualObservation, setActualObservation] = useState('');
  const [staffResponse, setStaffResponse] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [memo, setMemo] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [userMood, setUserMood] = useState<BehaviorMood | null>(null);
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);
  const observationRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const selectedActivityRef = useRef<HTMLDivElement>(null);

  const isControlledSlot = typeof controlledSlotKey === 'string';
  const effectiveSelectedSlotKey = isControlledSlot ? controlledSlotKey : selectedSlotKey;
  const resolvedRecordDate = useMemo(() => recordDate ?? new Date(), [recordDate]);
  const recordDateLabel = useMemo(
    () => formatDateYmd(resolvedRecordDate),
    [resolvedRecordDate]
  );

  const isLocked = lockState !== 'unlocked';

  // Sticky selection: keep last valid selection via ref (updated synchronously on event)
  const stickySlotRef = useRef<ScheduleItem | null>(null);
  const hasEverSelectedRef = useRef(false);

  // Current slot lookup (may be null when '' is passed)
  const currentSelectedSlot = useMemo(
    () => schedule.find((item) => getScheduleKey(item.time, item.activity) === effectiveSelectedSlotKey) ?? null,
    [schedule, effectiveSelectedSlotKey]
  );

  // Fallback to sticky when current is null
  const selectedSlot = currentSelectedSlot ?? stickySlotRef.current;

  // Track if ever selected (for initial empty state)
  if (selectedSlot) {
    hasEverSelectedRef.current = true;
  }

  const showEmptyState = !hasEverSelectedRef.current;

  const observationText = actualObservation.trim();
  const slotSelected = Boolean(selectedSlot);
  const requiresPlanSlot = schedule.length > 0;
  const hasObservation = observationText.length > 0;
  const canSubmit =
    !isLocked &&
    hasObservation &&
    (!requiresPlanSlot || slotSelected);
  const debugAttrs = import.meta.env.DEV
    ? {
        'data-can-submit': String(canSubmit),
        'data-slot-selected': String(slotSelected),
        'data-has-observation': String(hasObservation),
        'data-selected-behavior': String(Boolean(selectedBehavior)),
        'data-locked': String(isLocked),
      }
    : {};

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
    if (isControlledSlot && controlledSlotKey !== selectedSlotKey) {
      setSelectedSlotKey(controlledSlotKey ?? '');
    }
  }, [controlledSlotKey, isControlledSlot, selectedSlotKey]);

  useEffect(() => {
    if (isLocked || !effectiveSelectedSlotKey) return;
    observationRef.current?.focus({ preventScroll: true });
  }, [effectiveSelectedSlotKey, isLocked]);

  const handleSlotChange = (next: string) => {
    // Prevent toggle deselection (null/'' state) to avoid empty frame flicker
    const normalized = next && next.trim() !== '' ? next : '';
    if (!normalized) return; // ← Block deselection completely

    // Synchronously update sticky ref when valid slot is selected (before state update)
    const validSlot = schedule.find((item) => getScheduleKey(item.time, item.activity) === normalized);
    if (validSlot) {
      stickySlotRef.current = validSlot;
    }

    if (isControlledSlot) {
      onSlotChange?.(next);
      return;
    }
    setSelectedSlotKey(next);
    onSlotChange?.(next);
  };

  const handleSubmit = async () => {
    if (import.meta.env.DEV) {
      console.info('[daily/support] submit attempt', {
        isLocked,
        selectedBehavior,
        selectedSlotKey: effectiveSelectedSlotKey,
        observationLength: observationText.length,
      });
    }
    if (isLocked) {
      setSubmitFeedback('入力ロック中です。対象者と手順を確認してください。');
      return;
    }
    const observation = actualObservation.trim();
    if (!observation) {
      setSubmitFeedback('「本人の様子・実施記録」を入力してください。');
      return;
    }
    if (requiresPlanSlot && !selectedSlot) {
      setSubmitFeedback('上部の時間帯チップを選択してから保存してください。');
      return;
    }
    try {
      setSubmitFeedback(null);
      await onSubmit({
        recordedAt: new Date().toISOString(),
        planSlotKey: selectedSlot ? getScheduleKey(selectedSlot.time, selectedSlot.activity) : undefined,
        behavior: selectedBehavior ?? '日常記録',
        antecedent: selectedAntecedent ?? '',
        antecedentTags: [],
        consequence: selectedConsequence ?? '',
        intensity,
        durationMinutes,
        actualObservation: observation,
        staffResponse: staffResponse.trim() || undefined,
        followUpNote: followUpNote.trim() || memo.trim() || undefined,
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
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存に失敗しました。';
      setSubmitFeedback(message);
      console.debug('[RecordPanel.handleSubmit] submit failed:', err);
    }
  };

  return (
    <Card
      variant={compact ? 'elevation' : 'outlined'}
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'none',
        ...(compact && { border: 'none', borderRadius: 0 }),
        // hover/focus でピクつきやすい MUI の定番クラスだけ止める
        '& .MuiButtonBase-root, & .MuiChip-root, & .MuiToggleButton-root, & .MuiIconButton-root': {
          transition: 'none !important',
        },
        // 文字の色/opacity 変化（hover, disabled, selected）で残像化するのを止める
        '& .MuiTypography-root, & .MuiSvgIcon-root': {
          transition: 'none !important',
        },
        // outline/box-shadow の瞬間変化を抑制
        '& .MuiButtonBase-root:focus-visible': {
          outline: 'none',
        }
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
      <CardContent sx={{ flex: 1, overflowY: 'auto', p: compact ? 1 : 2, opacity: isLocked ? 0.5 : 1 }}>
        <Stack spacing={compact ? 1.5 : 3}>
          {!compact && (
            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
              <Typography variant="h6" component="h2" fontWeight="bold">
                {title ?? '支援・行動記録 (Do)'}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={`記録日 ${recordDateLabel}`} size="small" />
                <Chip icon={<AccessTimeIcon />} label={timestamp} size="small" />
              </Stack>
            </Box>
          )}

          <PlanSlotSelector
            schedule={schedule}
            effectiveSelectedSlotKey={effectiveSelectedSlotKey}
            selectedSlot={selectedSlot}
            showEmptyState={showEmptyState}
            slotSelected={slotSelected}
            isLocked={isLocked}
            selectedActivityRef={selectedActivityRef}
            onSlotChange={handleSlotChange}
          />

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

          <AbcRecordSection
            selectedBehavior={selectedBehavior}
            selectedAntecedent={selectedAntecedent}
            selectedConsequence={selectedConsequence}
            intensity={intensity}
            isLocked={isLocked}
            onBehaviorChange={setSelectedBehavior}
            onAntecedentChange={setSelectedAntecedent}
            onConsequenceChange={setSelectedConsequence}
            onIntensityChange={setIntensity}
          />
        </Stack>
      </CardContent>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        {submitFeedback ? (
          <Alert severity="warning" sx={{ mb: 1 }}>
            {submitFeedback}
          </Alert>
        ) : null}
        <Button
          fullWidth
          variant="contained"
          size="large"
          color={selectedBehavior ? 'error' : 'primary'}
          disabled={!canSubmit}
          startIcon={<SaveIcon />}
          onClick={handleSubmit}
          sx={{
            height: 48,
            fontWeight: 'bold',
            '&.Mui-disabled': {
              bgcolor: 'grey.100',
              color: 'text.disabled',
              border: '1px solid',
              borderColor: 'grey.300',
            },
          }}
          data-testid="behavior-submit-button"
          {...debugAttrs}
        >
          {selectedBehavior ? '行動記録を保存' : '支援記録を保存'}
        </Button>
      </Box>
    </Card>
  );
}

export default memo(RecordPanel);
