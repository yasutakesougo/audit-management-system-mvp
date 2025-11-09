import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Grid from '@mui/material/PigmentGrid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Slider, { type SliderProps } from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';
import {
  antecedentValues,
  behaviorValues,
  consequenceValues,
  createEmptyIncidentDraft,
  deriveSuggestedFunction,
  functionValues,
  highRiskIncidentDraftSchema,
  severityValues,
  type ConsequenceValue,
  type FunctionValue,
  type HighRiskIncidentDraft,
} from '@/domain/support/highRiskIncident';
import { TESTIDS, tid } from '../../testids';

const steps = [
  '行動の特定 (B)',
  '先行事象 (A)',
  '結果事象 (C)',
  '機能の仮説 (F)',
] as const;

const intensityMarks: NonNullable<SliderProps['marks']> = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
];

const severityColors: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
  '低': 'default',
  '中': 'info',
  '高': 'warning',
  '重大インシデント': 'error',
};

type IntensityLevel = HighRiskIncidentDraft['behavior']['intensityScale'];

type ConfidenceLevel = HighRiskIncidentDraft['hypothesis']['confidenceLevel'];

const toLocalInputValue = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromLocalInputValue = (value: string, fallback: string) => {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

interface HighRiskIncidentDialogProps {
  open: boolean;
  initialDraft: HighRiskIncidentDraft;
  onClose: () => void;
  onSubmit: (draft: HighRiskIncidentDraft) => Promise<void> | void;
  isSubmitting?: boolean;
  onRequestIcebergFactors?: (draft: HighRiskIncidentDraft) => void;
  allowTimestampOverride?: boolean;
}

export const HighRiskIncidentDialog: React.FC<HighRiskIncidentDialogProps> = ({
  open,
  initialDraft,
  onClose,
  onSubmit,
  isSubmitting = false,
  onRequestIcebergFactors,
  allowTimestampOverride = false,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [draft, setDraft] = useState<HighRiskIncidentDraft>(initialDraft);
  const [overrideTimestamp, setOverrideTimestamp] = useState(false);
  const [customTimestamp, setCustomTimestamp] = useState(initialDraft.incidentTimestamp);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initialDraft);
      setActiveStep(0);
      setSubmissionError(null);
      setOverrideTimestamp(false);
      setCustomTimestamp(initialDraft.incidentTimestamp);
    }
  }, [initialDraft, open]);

  const suggestedFunction = useMemo<FunctionValue>(() => {
    return deriveSuggestedFunction(
      draft.antecedent.antecedentType,
      draft.consequence.consequenceReceived,
    );
  }, [draft.antecedent.antecedentType, draft.consequence.consequenceReceived]);

  const suggestedDiffers =
    suggestedFunction !== '特定不能' && draft.hypothesis.hypothesizedFunction !== suggestedFunction;

  const handleBehaviorChange = <K extends keyof HighRiskIncidentDraft['behavior']>(
    key: K,
    value: HighRiskIncidentDraft['behavior'][K],
  ) => {
    setDraft(prev => ({
      ...prev,
      behavior: {
        ...prev.behavior,
        [key]: value,
      },
    }));
  };

  const handleAntecedentChange = <K extends keyof HighRiskIncidentDraft['antecedent']>(
    key: K,
    value: HighRiskIncidentDraft['antecedent'][K],
  ) => {
    setDraft(prev => ({
      ...prev,
      antecedent: {
        ...prev.antecedent,
        [key]: value,
      },
    }));
  };

  const handleConsequenceChange = <K extends keyof HighRiskIncidentDraft['consequence']>(
    key: K,
    value: HighRiskIncidentDraft['consequence'][K],
  ) => {
    setDraft(prev => ({
      ...prev,
      consequence: {
        ...prev.consequence,
        [key]: value,
      },
    }));
  };

  const handleHypothesisChange = <K extends keyof HighRiskIncidentDraft['hypothesis']>(
    key: K,
    value: HighRiskIncidentDraft['hypothesis'][K],
  ) => {
    setDraft(prev => ({
      ...prev,
      hypothesis: {
        ...prev.hypothesis,
        [key]: value,
      },
    }));
  };

  const handleToggleConsequence = (value: ConsequenceValue) => {
    setDraft(prev => ({
      ...prev,
      consequence: {
        ...prev.consequence,
        consequenceReceived: prev.consequence.consequenceReceived.includes(value)
          ? (prev.consequence.consequenceReceived.filter(item => item !== value) as ConsequenceValue[])
          : ([...prev.consequence.consequenceReceived, value] as ConsequenceValue[]),
      },
    }));
  };

  const canProceed = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return Boolean(draft.targetBehavior.trim()) && draft.behavior.intensityScale >= 1;
      case 1:
        return Boolean(draft.antecedent.antecedentType);
      case 2:
        return draft.consequence.consequenceReceived.length > 0;
      case 3:
        return Boolean(draft.hypothesis.hypothesizedFunction) && draft.hypothesis.confidenceLevel >= 1;
      default:
        return true;
    }
  };

  const goNext = () => {
    if (activeStep < steps.length - 1 && canProceed(activeStep)) {
      setActiveStep(prev => prev + 1);
    }
  };

  const goBack = () => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmissionError(null);
      const payload = {
        ...draft,
        incidentTimestamp: overrideTimestamp ? customTimestamp : draft.incidentTimestamp,
      };
      highRiskIncidentDraftSchema.parse(payload);
      await onSubmit(payload);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : '送信に失敗しました');
    }
  };

  const renderBehaviorStep = () => (
    <Stack spacing={3} mt={2}>
      <Alert severity="info">
        まずは行動の観察内容を記録します。強度と継続時間は後続の分析に必要です。
      </Alert>
      <TextField
        fullWidth
        label="事象の概要 / ターゲット行動"
        value={draft.targetBehavior}
        onChange={(event) => setDraft(prev => ({ ...prev, targetBehavior: event.target.value }))}
        required
        helperText="例：活動の切り替え時に教材を投げる"
      />
      <Grid container spacing={3}>
  <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth>
            <InputLabel>観察された行動</InputLabel>
            <Select
              label="観察された行動"
              value={draft.behavior.behaviorObserved}
              onChange={(event) => handleBehaviorChange('behaviorObserved', event.target.value)}
            >
              {behaviorValues.map(option => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
  <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" gutterBottom>
            重症度
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={draft.severity}
            onChange={(_, value) => value && setDraft(prev => ({ ...prev, severity: value }))}
            aria-label="重症度"
          >
            {severityValues.map(severity => (
              <ToggleButton key={severity} value={severity} sx={{ textTransform: 'none' }}>
                <Chip size="small" color={severityColors[severity]} label={severity} />
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Grid>
      </Grid>
      <Grid container spacing={3}>
  <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            type="number"
            label="行動の継続時間 (分)"
            value={draft.behavior.durationMinutes}
            inputProps={{ min: 0, max: 240 }}
            onChange={(event) => handleBehaviorChange('durationMinutes', Number(event.target.value))}
          />
        </Grid>
  <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2">行動の強度</Typography>
          <Slider
            value={draft.behavior.intensityScale}
            min={1}
            max={5}
            step={1}
            marks={intensityMarks}
            valueLabelDisplay="auto"
            onChange={(_, value) => {
              const nextValue = Array.isArray(value) ? value[0] : value;
              if (typeof nextValue === 'number') {
                const clamped = Math.max(1, Math.min(5, nextValue)) as IntensityLevel;
                handleBehaviorChange('intensityScale', clamped);
              }
            }}
          />
        </Grid>
      </Grid>
    </Stack>
  );

  const renderAntecedentStep = () => (
    <Stack spacing={3} mt={2}>
      <Alert severity="info">
        行動の直前に何が起きたかを整理します。氷山モデルの水面下にある要因も合わせて記録しましょう。
      </Alert>
      <FormControl fullWidth>
        <InputLabel>先行事象</InputLabel>
        <Select
          label="先行事象"
          value={draft.antecedent.antecedentType}
          onChange={(event) => handleAntecedentChange('antecedentType', event.target.value)}
        >
          {antecedentValues.map(option => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        fullWidth
        multiline
        rows={3}
        label="状況メモ"
        value={draft.antecedent.contextNotes}
        onChange={(event) => handleAntecedentChange('contextNotes', event.target.value)}
        placeholder="例：活動終了を告げたが本人は作業を継続したい様子だった"
      />
      <Autocomplete
        multiple
        freeSolo
        options={[]}
        value={draft.antecedent.relatedIcebergFactors}
        onChange={(_, value) => handleAntecedentChange('relatedIcebergFactors', value)}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip label={option} size="small" {...getTagProps({ index })} />
          ))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="氷山モデルの関連要因"
            placeholder="例：聴覚過敏 / 予測不一致"
          />
        )}
      />
    </Stack>
  );

  const renderConsequenceStep = () => (
    <Stack spacing={3} mt={2}>
      <Alert severity="info">
        行動の結果、環境や本人にどのような変化が生じたかを記録します。介入内容も忘れずに。
      </Alert>
      <FormGroup row>
        {consequenceValues.map(option => (
          <FormControlLabel
            key={option}
            control={(
              <Checkbox
                checked={draft.consequence.consequenceReceived.includes(option)}
                onChange={() => handleToggleConsequence(option)}
              />
            )}
            label={option}
          />
        ))}
      </FormGroup>
      <TextField
        fullWidth
        multiline
        rows={3}
        label="職員の介入・状況"
        value={draft.consequence.staffInterventionNotes}
        onChange={(event) => handleConsequenceChange('staffInterventionNotes', event.target.value)}
        placeholder="例：別室へ移動し落ち着くまで声かけ、視覚支援カードを提示"
      />
    </Stack>
  );

  const renderHypothesisStep = () => (
    <Stack spacing={3} mt={2}>
      <Alert severity={suggestedFunction === '特定不能' ? 'warning' : 'success'}>
        {suggestedFunction === '特定不能'
          ? '入力内容から機能の自動推測は行えませんでした。観察に基づき仮説を選択してください。'
          : `入力内容から「${suggestedFunction}」が提案されています。必要に応じて編集できます。`}
      </Alert>
      {suggestedDiffers && (
        <Alert severity="info">
          システム提案と異なる機能が選択されています。確信度を調整し、経過を追跡してください。
        </Alert>
      )}
      <FormControl fullWidth>
        <InputLabel>推定される行動機能</InputLabel>
        <Select
          label="推定される行動機能"
          value={draft.hypothesis.hypothesizedFunction}
          onChange={(event) => handleHypothesisChange('hypothesizedFunction', event.target.value as FunctionValue)}
        >
          {functionValues.map(option => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          仮説の確信度 (1: 低い / 3: 高い)
        </Typography>
        <Slider
          value={draft.hypothesis.confidenceLevel}
          min={1}
          max={3}
          step={1}
          marks={[
            { value: 1, label: '1' },
            { value: 2, label: '2' },
            { value: 3, label: '3' },
          ]}
          valueLabelDisplay="auto"
          onChange={(_, value) => {
            const nextValue = Array.isArray(value) ? value[0] : value;
            if (nextValue === 1 || nextValue === 2 || nextValue === 3) {
              handleHypothesisChange('confidenceLevel', nextValue as ConfidenceLevel);
            }
          }}
        />
      </Box>
      <Divider />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
        <Button
          variant="outlined"
          onClick={() => onRequestIcebergFactors?.(draft)}
          disabled={!onRequestIcebergFactors}
        >
          氷山要因エディタで詳細を追記
        </Button>
        {allowTimestampOverride && (
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControlLabel
              control={(
                <Switch
                  checked={overrideTimestamp}
                  onChange={(_, checked) => setOverrideTimestamp(checked)}
                />
              )}
              label="発生時刻を手動で調整"
            />
            {overrideTimestamp && (
              <TextField
                type="datetime-local"
                value={toLocalInputValue(customTimestamp)}
                onChange={(event) => setCustomTimestamp(fromLocalInputValue(event.target.value, draft.incidentTimestamp))}
                InputLabelProps={{ shrink: true }}
              />
            )}
          </Stack>
        )}
      </Stack>
    </Stack>
  );

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return renderBehaviorStep();
      case 1:
        return renderAntecedentStep();
      case 2:
        return renderConsequenceStep();
      case 3:
        return renderHypothesisStep();
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      {...tid(TESTIDS['support-incident-dialog'])}
    >
      <DialogTitle>高リスク事象記録</DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={activeStep} alternativeLabel {...tid(TESTIDS['support-incident-stepper'])}>
          {steps.map(step => (
            <Step key={step}>
              <StepLabel>{step}</StepLabel>
            </Step>
          ))}
        </Stepper>
        {renderStep()}
        {submissionError && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {submissionError}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">キャンセル</Button>
        {activeStep > 0 && (
          <Button onClick={goBack}>戻る</Button>
        )}
        {activeStep < steps.length - 1 && (
          <Button onClick={goNext} disabled={!canProceed(activeStep)} variant="contained">
            次へ
          </Button>
        )}
        {activeStep === steps.length - 1 && (
          <Button
            {...tid(TESTIDS['support-incident-submit'])}
            onClick={handleSubmit}
            variant="contained"
            disabled={isSubmitting || !canProceed(activeStep)}
          >
            {isSubmitting ? '送信中…' : '記録を保存'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

HighRiskIncidentDialog.defaultProps = {
  isSubmitting: false,
  onRequestIcebergFactors: undefined,
  allowTimestampOverride: false,
};

export const createDialogDraft = (
  personId: string,
  supportPlanId: string,
  reportedAtStepId?: string,
) => createEmptyIncidentDraft(personId, supportPlanId, reportedAtStepId);
