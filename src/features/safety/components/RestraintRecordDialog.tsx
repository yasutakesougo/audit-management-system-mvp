// ---------------------------------------------------------------------------
// RestraintRecordDialog — 身体拘束等記録ダイアログ
//
// P0-2: ステッパー形式で身体拘束記録を入力する。
// Step 1: 拘束の基本情報（態様・日時・時間計算）
// Step 2: 三要件確認（切迫性・非代替性・一時性）
// Step 3: 状況記録（理由・心身状況・周囲状況）
// Step 4: 確認・送信
// ---------------------------------------------------------------------------
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
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
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/PigmentGrid';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';

import {
  allThreeRequirementsMet,
  computeDurationMinutes,
  countMetRequirements,
  physicalRestraintDraftSchema,
  restraintTypeValues,
  type PhysicalRestraintDraft,
  type ThreeRequirements,
} from '@/domain/safety/physicalRestraint';
import { TESTIDS, tid } from '@/testids';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const steps = [
  '拘束の基本情報',
  '三要件確認',
  '状況記録',
  '確認・送信',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toLocalInputValue = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromLocalInputValue = (value: string, fallback: string) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

const formatDuration = (minutes: number): string => {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RestraintRecordDialogProps {
  open: boolean;
  initialDraft: PhysicalRestraintDraft;
  onClose: () => void;
  onSubmit: (draft: PhysicalRestraintDraft) => Promise<void> | void;
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const RestraintRecordDialog: React.FC<RestraintRecordDialogProps> = ({
  open,
  initialDraft,
  onClose,
  onSubmit,
  isSubmitting = false,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [draft, setDraft] = useState<PhysicalRestraintDraft>(initialDraft);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initialDraft);
      setActiveStep(0);
      setSubmissionError(null);
    }
  }, [initialDraft, open]);

  // ── 自動時間計算 ──
  const durationMinutes = useMemo(
    () => computeDurationMinutes(draft.startedAt, draft.endedAt),
    [draft.startedAt, draft.endedAt],
  );

  const threeReqMet = useMemo(
    () => allThreeRequirementsMet(draft.threeRequirements),
    [draft.threeRequirements],
  );

  const metCount = useMemo(
    () => countMetRequirements(draft.threeRequirements),
    [draft.threeRequirements],
  );

  // ── Updaters ──
  const updateThreeReq = <K extends keyof ThreeRequirements>(key: K, value: ThreeRequirements[K]) => {
    setDraft((prev) => ({
      ...prev,
      threeRequirements: { ...prev.threeRequirements, [key]: value },
    }));
  };

  // ── Step validation ──
  const canProceed = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return Boolean(draft.restraintType) && durationMinutes > 0;
      case 1:
        return threeReqMet;
      case 2:
        return Boolean(draft.reason.trim()) && Boolean(draft.recordedBy.trim());
      case 3:
        return true;
      default:
        return true;
    }
  };

  const goNext = () => {
    if (activeStep < steps.length - 1 && canProceed(activeStep)) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (activeStep > 0) setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    try {
      setSubmissionError(null);
      physicalRestraintDraftSchema.parse(draft);
      await onSubmit(draft);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : '送信に失敗しました');
    }
  };

  // ─────────────────────────────────────
  // Step 1: 拘束の基本情報
  // ─────────────────────────────────────
  const renderBasicInfoStep = () => (
    <Stack spacing={3} mt={2}>
      <Alert severity="info">
        拘束の態様と実施時間を記録します。終了時刻を入力すると継続時間が自動で計算されます。
      </Alert>

      <FormControl fullWidth>
        <InputLabel>拘束の態様</InputLabel>
        <Select
          label="拘束の態様"
          value={draft.restraintType}
          onChange={(e) => setDraft((prev) => ({ ...prev, restraintType: e.target.value as PhysicalRestraintDraft['restraintType'] }))}
        >
          {restraintTypeValues.map((option) => (
            <MenuItem key={option} value={option}>{option}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <TextField
            fullWidth
            type="datetime-local"
            label="開始日時"
            value={toLocalInputValue(draft.startedAt)}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                startedAt: fromLocalInputValue(e.target.value, prev.startedAt),
              }))
            }
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <TextField
            fullWidth
            type="datetime-local"
            label="終了日時"
            value={toLocalInputValue(draft.endedAt)}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                endedAt: fromLocalInputValue(e.target.value, prev.endedAt),
              }))
            }
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <Box
            {...tid(TESTIDS['safety-restraint-duration'])}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 0.5,
            }}
          >
            <AccessTimeIcon color={durationMinutes > 0 ? 'primary' : 'disabled'} />
            <Typography
              variant="h6"
              color={durationMinutes > 0 ? 'primary' : 'text.disabled'}
              fontWeight={700}
            >
              {formatDuration(durationMinutes)}
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {durationMinutes > 120 && (
        <Alert severity="warning">
          継続時間が2時間を超えています。一時性の要件について慎重に確認してください。
        </Alert>
      )}
    </Stack>
  );

  // ─────────────────────────────────────
  // Step 2: 三要件確認
  // ─────────────────────────────────────
  const renderThreeRequirementsStep = () => (
    <Stack spacing={3} mt={2} {...tid(TESTIDS['safety-restraint-three-req'])}>
      <Alert severity={threeReqMet ? 'success' : 'warning'}>
        {threeReqMet
          ? '三要件がすべて確認されました。'
          : `三要件のうち ${metCount}/3 が確認されています。すべての要件を確認してください。`}
      </Alert>

      {/* 切迫性 */}
      <Box sx={{ p: 2, border: 1, borderColor: draft.threeRequirements.immediacy ? 'success.main' : 'divider', borderRadius: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={draft.threeRequirements.immediacy}
              onChange={(_, checked) => updateThreeReq('immediacy', checked)}
            />
          }
          label={
            <Typography fontWeight={600}>
              切迫性{' '}
              <Typography component="span" variant="body2" color="text.secondary">
                — 利用者等の生命・身体に危険が及ぶ可能性が著しく高い
              </Typography>
            </Typography>
          }
        />
        {draft.threeRequirements.immediacy && (
          <TextField
            fullWidth
            multiline
            rows={2}
            label="切迫性の具体的状況"
            value={draft.threeRequirements.immediacyReason}
            onChange={(e) => updateThreeReq('immediacyReason', e.target.value)}
            placeholder="例：自傷行為により頭部を壁に激しく打ち付けており、外傷の危険性が極めて高い"
            sx={{ mt: 1 }}
          />
        )}
      </Box>

      {/* 非代替性 */}
      <Box sx={{ p: 2, border: 1, borderColor: draft.threeRequirements.nonSubstitutability ? 'success.main' : 'divider', borderRadius: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={draft.threeRequirements.nonSubstitutability}
              onChange={(_, checked) => updateThreeReq('nonSubstitutability', checked)}
            />
          }
          label={
            <Typography fontWeight={600}>
              非代替性{' '}
              <Typography component="span" variant="body2" color="text.secondary">
                — 身体拘束以外に代替する介護方法がない
              </Typography>
            </Typography>
          }
        />
        {draft.threeRequirements.nonSubstitutability && (
          <TextField
            fullWidth
            multiline
            rows={2}
            label="検討した代替手段と不可の理由"
            value={draft.threeRequirements.nonSubstitutabilityReason}
            onChange={(e) => updateThreeReq('nonSubstitutabilityReason', e.target.value)}
            placeholder="例：声かけ・環境調整・クールダウンスペースへの誘導を試みたが効果なし"
            sx={{ mt: 1 }}
          />
        )}
      </Box>

      {/* 一時性 */}
      <Box sx={{ p: 2, border: 1, borderColor: draft.threeRequirements.temporariness ? 'success.main' : 'divider', borderRadius: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={draft.threeRequirements.temporariness}
              onChange={(_, checked) => updateThreeReq('temporariness', checked)}
            />
          }
          label={
            <Typography fontWeight={600}>
              一時性{' '}
              <Typography component="span" variant="body2" color="text.secondary">
                — 身体拘束が一時的なものである
              </Typography>
            </Typography>
          }
        />
        {draft.threeRequirements.temporariness && (
          <TextField
            fullWidth
            multiline
            rows={2}
            label="一時性の具体的見通し"
            value={draft.threeRequirements.temporarinessReason}
            onChange={(e) => updateThreeReq('temporarinessReason', e.target.value)}
            placeholder="例：本人の興奮が収まり次第、速やかに解除する"
            sx={{ mt: 1 }}
          />
        )}
      </Box>
    </Stack>
  );

  // ─────────────────────────────────────
  // Step 3: 状況記録
  // ─────────────────────────────────────
  const renderSituationStep = () => (
    <Stack spacing={3} mt={2}>
      <Alert severity="info">
        拘束に至った経緯と状況を記録します。
      </Alert>

      <TextField
        fullWidth
        multiline
        rows={3}
        label="緊急やむを得ない理由"
        value={draft.reason}
        onChange={(e) => setDraft((prev) => ({ ...prev, reason: e.target.value }))}
        required
        placeholder="例：自傷行為が激しく、環境調整等の代替手段では対応困難であったため"
      />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="利用者の心身の状況"
            value={draft.physicalMentalCondition}
            onChange={(e) => setDraft((prev) => ({ ...prev, physicalMentalCondition: e.target.value }))}
            placeholder="例：興奮状態、大声を発しながら壁を叩く行動が30分以上継続"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="周囲の状況"
            value={draft.surroundingCondition}
            onChange={(e) => setDraft((prev) => ({ ...prev, surroundingCondition: e.target.value }))}
            placeholder="例：他利用者が近くにおり、二次被害の危険があった"
          />
        </Grid>
      </Grid>

      <TextField
        fullWidth
        label="記録者氏名"
        value={draft.recordedBy}
        onChange={(e) => setDraft((prev) => ({ ...prev, recordedBy: e.target.value }))}
        required
      />

      {draft.relatedIncidentId && (
        <Chip
          size="small"
          variant="outlined"
          color="info"
          label={`関連インシデント: ${draft.relatedIncidentId}`}
        />
      )}
    </Stack>
  );

  // ─────────────────────────────────────
  // Step 4: 確認・送信
  // ─────────────────────────────────────
  const renderConfirmStep = () => (
    <Stack spacing={2} mt={2}>
      <Alert severity={threeReqMet ? 'info' : 'error'}>
        {threeReqMet
          ? '以下の内容で記録を保存します。内容を確認してください。'
          : '⚠️ 三要件が未確認の状態です。前のステップに戻って確認してください。'}
      </Alert>

      <Divider />

      {/* 概要表示 */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary">態様</Typography>
        <Typography>{draft.restraintType}</Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 4 }}>
          <Typography variant="subtitle2" color="text.secondary">開始</Typography>
          <Typography variant="body2">
            {new Date(draft.startedAt).toLocaleString('ja-JP')}
          </Typography>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Typography variant="subtitle2" color="text.secondary">終了</Typography>
          <Typography variant="body2">
            {new Date(draft.endedAt).toLocaleString('ja-JP')}
          </Typography>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Typography variant="subtitle2" color="text.secondary">継続時間</Typography>
          <Typography variant="body2" fontWeight={700} color="primary">
            {formatDuration(durationMinutes)}
          </Typography>
        </Grid>
      </Grid>

      <Divider />

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          三要件確認
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip
            size="small"
            icon={draft.threeRequirements.immediacy ? <CheckCircleOutlineIcon /> : <WarningAmberIcon />}
            label="切迫性"
            color={draft.threeRequirements.immediacy ? 'success' : 'default'}
            variant={draft.threeRequirements.immediacy ? 'filled' : 'outlined'}
          />
          <Chip
            size="small"
            icon={draft.threeRequirements.nonSubstitutability ? <CheckCircleOutlineIcon /> : <WarningAmberIcon />}
            label="非代替性"
            color={draft.threeRequirements.nonSubstitutability ? 'success' : 'default'}
            variant={draft.threeRequirements.nonSubstitutability ? 'filled' : 'outlined'}
          />
          <Chip
            size="small"
            icon={draft.threeRequirements.temporariness ? <CheckCircleOutlineIcon /> : <WarningAmberIcon />}
            label="一時性"
            color={draft.threeRequirements.temporariness ? 'success' : 'default'}
            variant={draft.threeRequirements.temporariness ? 'filled' : 'outlined'}
          />
        </Stack>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" color="text.secondary">理由</Typography>
        <Typography variant="body2">{draft.reason || '（未入力）'}</Typography>
      </Box>

      <Box>
        <Typography variant="subtitle2" color="text.secondary">記録者</Typography>
        <Typography variant="body2">{draft.recordedBy || '（未入力）'}</Typography>
      </Box>
    </Stack>
  );

  // ─────────────────────────────────────
  // Render Step
  // ─────────────────────────────────────
  const renderStep = () => {
    switch (activeStep) {
      case 0: return renderBasicInfoStep();
      case 1: return renderThreeRequirementsStep();
      case 2: return renderSituationStep();
      case 3: return renderConfirmStep();
      default: return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      {...tid(TESTIDS['safety-restraint-dialog'])}
    >
      <DialogTitle>身体拘束等記録</DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={activeStep} alternativeLabel {...tid(TESTIDS['safety-restraint-stepper'])}>
          {steps.map((step) => (
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
        {activeStep > 0 && <Button onClick={goBack}>戻る</Button>}
        {activeStep < steps.length - 1 && (
          <Button onClick={goNext} disabled={!canProceed(activeStep)} variant="contained">
            次へ
          </Button>
        )}
        {activeStep === steps.length - 1 && (
          <Button
            {...tid(TESTIDS['safety-restraint-submit'])}
            onClick={handleSubmit}
            variant="contained"
            disabled={isSubmitting || !threeReqMet}
          >
            {isSubmitting ? '送信中…' : '記録を保存'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

RestraintRecordDialog.defaultProps = {
  isSubmitting: false,
};
