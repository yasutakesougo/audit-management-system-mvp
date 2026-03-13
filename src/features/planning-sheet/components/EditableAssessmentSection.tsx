/**
 * EditableAssessmentSection — アセスメントタブ（編集可能）
 *
 * ADR-006 準拠: PlanningSheet の assessment セクションを編集する。
 *
 * 編集対象:
 *  - 対象行動（操作的定義・頻度・強度・持続）
 *  - ABC 観察記録（Antecedent → Behavior → Consequence）
 *  - 行動機能仮説
 *  - リスクレベル
 *  - チーム合意メモ
 */
import type { AbcEvent, AssessedBehavior, BehaviorHypothesis, PlanningAssessment } from '@/domain/isp/schema';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type React from 'react';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface Props {
  assessment: PlanningAssessment;
  onChange: (updated: PlanningAssessment) => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const EMPTY_BEHAVIOR: AssessedBehavior = {
  name: '',
  operationalDefinition: '',
  frequency: '',
  intensity: '',
  duration: '',
};

const EMPTY_ABC: AbcEvent = {
  antecedent: '',
  behavior: '',
  consequence: '',
  date: null,
  notes: '',
};

const EMPTY_HYPOTHESIS: BehaviorHypothesis = {
  function: '',
  evidence: '',
  confidence: 'low',
};

const CONFIDENCE_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
] as const;

const RISK_LEVEL_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
] as const;

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export const EditableAssessmentSection: React.FC<Props> = ({ assessment, onChange }) => {
  // ── Array update helpers ──
  const updateBehavior = (idx: number, patch: Partial<AssessedBehavior>) => {
    const updated = assessment.targetBehaviors.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    onChange({ ...assessment, targetBehaviors: updated });
  };
  const addBehavior = () => onChange({ ...assessment, targetBehaviors: [...assessment.targetBehaviors, { ...EMPTY_BEHAVIOR }] });
  const removeBehavior = (idx: number) => onChange({ ...assessment, targetBehaviors: assessment.targetBehaviors.filter((_, i) => i !== idx) });

  const updateAbcEvent = (idx: number, patch: Partial<AbcEvent>) => {
    const updated = assessment.abcEvents.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    onChange({ ...assessment, abcEvents: updated });
  };
  const addAbcEvent = () => onChange({ ...assessment, abcEvents: [...assessment.abcEvents, { ...EMPTY_ABC }] });
  const removeAbcEvent = (idx: number) => onChange({ ...assessment, abcEvents: assessment.abcEvents.filter((_, i) => i !== idx) });

  const updateHypothesis = (idx: number, patch: Partial<BehaviorHypothesis>) => {
    const updated = assessment.hypotheses.map((h, i) => (i === idx ? { ...h, ...patch } : h));
    onChange({ ...assessment, hypotheses: updated });
  };
  const addHypothesis = () => onChange({ ...assessment, hypotheses: [...assessment.hypotheses, { ...EMPTY_HYPOTHESIS }] });
  const removeHypothesis = (idx: number) => onChange({ ...assessment, hypotheses: assessment.hypotheses.filter((_, i) => i !== idx) });

  return (
    <Stack spacing={3}>
      {/* ── 対象行動 ── */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>対象行動</Typography>
          <Button size="small" startIcon={<AddCircleOutlineRoundedIcon />} onClick={addBehavior}>
            行動を追加
          </Button>
        </Stack>
        <Stack spacing={2}>
          {assessment.targetBehaviors.map((b, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Chip size="small" label={`行動 ${i + 1}`} color="primary" variant="outlined" />
                  <Tooltip title="削除">
                    <IconButton size="small" onClick={() => removeBehavior(i)} color="error">
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <TextField
                  label="行動名"
                  value={b.name}
                  onChange={(e) => updateBehavior(i, { name: e.target.value })}
                  fullWidth size="small" required
                />
                <TextField
                  label="操作的定義"
                  value={b.operationalDefinition}
                  onChange={(e) => updateBehavior(i, { operationalDefinition: e.target.value })}
                  fullWidth size="small" multiline minRows={2}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField
                    label="頻度"
                    value={b.frequency}
                    onChange={(e) => updateBehavior(i, { frequency: e.target.value })}
                    fullWidth size="small"
                  />
                  <TextField
                    label="強度"
                    value={b.intensity}
                    onChange={(e) => updateBehavior(i, { intensity: e.target.value })}
                    fullWidth size="small"
                  />
                  <TextField
                    label="持続時間"
                    value={b.duration}
                    onChange={(e) => updateBehavior(i, { duration: e.target.value })}
                    fullWidth size="small"
                  />
                </Stack>
              </Stack>
            </Paper>
          ))}
          {assessment.targetBehaviors.length === 0 && (
            <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
              対象行動がまだ登録されていません
            </Typography>
          )}
        </Stack>
      </Box>

      <Divider />

      {/* ── ABC 観察記録 ── */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>ABC 観察記録</Typography>
          <Button size="small" startIcon={<AddCircleOutlineRoundedIcon />} onClick={addAbcEvent}>
            観察を追加
          </Button>
        </Stack>
        <Stack spacing={2}>
          {assessment.abcEvents.map((e, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 2, borderLeft: '3px solid', borderLeftColor: 'primary.main' }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Chip size="small" label={`ABC #${i + 1}`} color="info" variant="outlined" />
                  <Tooltip title="削除">
                    <IconButton size="small" onClick={() => removeAbcEvent(i)} color="error">
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <TextField
                  label="A（先行事象）"
                  value={e.antecedent}
                  onChange={(ev) => updateAbcEvent(i, { antecedent: ev.target.value })}
                  fullWidth size="small" multiline minRows={2}
                  placeholder="行動の直前に何が起きたか"
                />
                <TextField
                  label="B（行動）"
                  value={e.behavior}
                  onChange={(ev) => updateAbcEvent(i, { behavior: ev.target.value })}
                  fullWidth size="small" multiline minRows={2}
                  placeholder="具体的にどんな行動をしたか"
                />
                <TextField
                  label="C（結果事象）"
                  value={e.consequence}
                  onChange={(ev) => updateAbcEvent(i, { consequence: ev.target.value })}
                  fullWidth size="small" multiline minRows={2}
                  placeholder="行動の直後に何が起きたか"
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField
                    label="観察日"
                    type="date"
                    value={e.date ?? ''}
                    onChange={(ev) => updateAbcEvent(i, { date: ev.target.value || null })}
                    InputLabelProps={{ shrink: true }}
                    size="small" sx={{ minWidth: 160 }}
                  />
                  <TextField
                    label="メモ"
                    value={e.notes}
                    onChange={(ev) => updateAbcEvent(i, { notes: ev.target.value })}
                    fullWidth size="small"
                  />
                </Stack>
              </Stack>
            </Paper>
          ))}
          {assessment.abcEvents.length === 0 && (
            <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
              ABC 観察がまだ記録されていません
            </Typography>
          )}
        </Stack>
      </Box>

      <Divider />

      {/* ── 行動機能仮説 ── */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>行動機能仮説</Typography>
          <Button size="small" startIcon={<AddCircleOutlineRoundedIcon />} onClick={addHypothesis}>
            仮説を追加
          </Button>
        </Stack>
        <Stack spacing={2}>
          {assessment.hypotheses.map((h, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Chip size="small" label={`仮説 ${i + 1}`} variant="outlined" />
                  <Tooltip title="削除">
                    <IconButton size="small" onClick={() => removeHypothesis(i)} color="error">
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <TextField
                  label="行動の機能"
                  value={h.function}
                  onChange={(e) => updateHypothesis(i, { function: e.target.value })}
                  fullWidth size="small"
                  placeholder="例: 感覚刺激の追求、要求の表現、逃避"
                />
                <TextField
                  label="根拠"
                  value={h.evidence}
                  onChange={(e) => updateHypothesis(i, { evidence: e.target.value })}
                  fullWidth size="small" multiline minRows={2}
                />
                <TextField
                  label="確信度"
                  value={h.confidence}
                  onChange={(e) => updateHypothesis(i, { confidence: e.target.value as BehaviorHypothesis['confidence'] })}
                  select fullWidth size="small"
                >
                  {CONFIDENCE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Paper>
          ))}
          {assessment.hypotheses.length === 0 && (
            <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
              仮説がまだ登録されていません
            </Typography>
          )}
        </Stack>
      </Box>

      <Divider />

      {/* ── リスクレベル・チーム合意 ── */}
      <Stack spacing={2}>
        <TextField
          label="リスクレベル"
          value={assessment.riskLevel}
          onChange={(e) => onChange({ ...assessment, riskLevel: e.target.value as PlanningAssessment['riskLevel'] })}
          select fullWidth size="small"
        >
          {RISK_LEVEL_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>

        <TextField
          label="チーム合意メモ"
          value={assessment.teamConsensusNote}
          onChange={(e) => onChange({ ...assessment, teamConsensusNote: e.target.value })}
          fullWidth size="small" multiline minRows={2}
          placeholder="チームでの合意内容を記録"
        />
      </Stack>
    </Stack>
  );
};
