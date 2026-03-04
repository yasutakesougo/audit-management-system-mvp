// ---------------------------------------------------------------------------
// ABCEntryForm — ABC分析（先行事象・行動・結果）セット入力フォーム
// 応用行動分析に基づく構造化データ入力
// ---------------------------------------------------------------------------
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SaveIcon from '@mui/icons-material/Save';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Rating from '@mui/material/Rating';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';
import { useCallback, useState } from 'react';

import type { ABCRecord, BehaviorFunction, BehaviorOutcome } from '../ibdTypes';
import { toLocalDateISO } from '@/utils/getNow';
import {
    BEHAVIOR_FUNCTION_COLORS,
    BEHAVIOR_FUNCTION_LABELS,
    BEHAVIOR_OUTCOME_LABELS,
    COMMON_ANTECEDENT_TAGS,
} from '../ibdTypes';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ABCEntryFormProps = {
  userId: string;
  recordedBy?: string;
  /** 使用した介入方法（InterventionPickerPanel から連動） */
  interventionUsed?: string;
  onSave: (record: ABCRecord) => void;
  onCancel?: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ABCEntryForm: FC<ABCEntryFormProps> = ({
  userId,
  recordedBy,
  interventionUsed,
  onSave,
  onCancel,
}) => {
  // A: 先行事象
  const [antecedent, setAntecedent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // B: 行動
  const [behavior, setBehavior] = useState('');
  const [intensity, setIntensity] = useState<number | null>(null);

  // C: 結果
  const [consequence, setConsequence] = useState('');
  const [outcome, setOutcome] = useState<BehaviorOutcome | null>(null);

  // 機能推定
  const [estimatedFunction, setEstimatedFunction] = useState<BehaviorFunction | null>(null);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleSave = useCallback(() => {
    if (!antecedent.trim() || !behavior.trim() || !consequence.trim() || !outcome) return;

    const record: ABCRecord = {
      id: `abc-${Date.now()}`,
      userId,
      recordedAt: toLocalDateISO(),
      recordedBy,
      antecedent: antecedent.trim(),
      antecedentTags: selectedTags,
      behavior: behavior.trim(),
      intensity: (intensity ?? 3) as ABCRecord['intensity'],
      consequence: consequence.trim(),
      behaviorOutcome: outcome,
      estimatedFunction,
      ...(interventionUsed && { interventionUsed }),
    };
    onSave(record);

    // Reset
    setAntecedent('');
    setSelectedTags([]);
    setBehavior('');
    setIntensity(null);
    setConsequence('');
    setOutcome(null);
    setEstimatedFunction(null);
  }, [
    userId, recordedBy, antecedent, selectedTags, behavior, intensity,
    consequence, outcome, estimatedFunction, interventionUsed, onSave,
  ]);

  const isValid = antecedent.trim() && behavior.trim() && consequence.trim() && outcome;

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }} data-testid="abc-entry-form">
      <Stack spacing={3}>
        <Typography variant="h6" fontWeight={600}>
          🔬 ABC分析 記録フォーム
        </Typography>

        <Divider />

        {/* ── A: 先行事象 ── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} color="primary.main" gutterBottom>
            A — 先行事象（Antecedent）
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            行動の直前に何が起きていたか
          </Typography>

          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            {COMMON_ANTECEDENT_TAGS.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant={selectedTags.includes(tag) ? 'filled' : 'outlined'}
                color={selectedTags.includes(tag) ? 'primary' : 'default'}
                onClick={() => toggleTag(tag)}
              />
            ))}
          </Stack>

          <TextField
            label="先行事象の詳細"
            placeholder="活動の途中で突然予定が変更になり..."
            multiline
            rows={2}
            value={antecedent}
            onChange={(e) => setAntecedent(e.target.value)}
            fullWidth
            data-testid="abc-antecedent"
          />
        </Box>

        <Divider />

        {/* ── B: 行動 ── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} color="warning.main" gutterBottom>
            B — 行動（Behavior）
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            具体的にどのような行動が見られたか
          </Typography>

          <TextField
            label="行動の具体的記述"
            placeholder="椅子を蹴り、大声で叫んだ"
            multiline
            rows={2}
            value={behavior}
            onChange={(e) => setBehavior(e.target.value)}
            fullWidth
            sx={{ mb: 1 }}
            data-testid="abc-behavior"
          />

          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="caption">強度:</Typography>
            <Rating
              value={intensity}
              onChange={(_, v) => setIntensity(v)}
              size="medium"
              data-testid="abc-intensity"
            />
            <Typography variant="caption" color="text.secondary">
              {intensity ? `${intensity}/5` : '未設定'}
            </Typography>
          </Stack>
        </Box>

        <Divider />

        {/* ── C: 結果 ── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} color="error.main" gutterBottom>
            C — 結果（Consequence）
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            行動の後、周囲がどう反応し、本人はどう変化したか
          </Typography>

          <TextField
            label="結果の記述"
            placeholder="スタッフが距離を取り、5分後に落ち着いた"
            multiline
            rows={2}
            value={consequence}
            onChange={(e) => setConsequence(e.target.value)}
            fullWidth
            sx={{ mb: 1 }}
            data-testid="abc-consequence"
          />

          <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>行動変化:</Typography>
          <ToggleButtonGroup
            value={outcome}
            exclusive
            onChange={(_, v: BehaviorOutcome | null) => setOutcome(v)}
            size="small"
            data-testid="abc-outcome"
          >
            {(Object.entries(BEHAVIOR_OUTCOME_LABELS) as [BehaviorOutcome, string][]).map(
              ([key, label]) => (
                <ToggleButton key={key} value={key} sx={{ textTransform: 'none', px: 2 }}>
                  {label}
                </ToggleButton>
              )
            )}
          </ToggleButtonGroup>
        </Box>

        <Divider />

        {/* ── 機能推定 ── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            🧠 行動の機能推定
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            この行動は何を訴えているか（推定）
          </Typography>

          <ToggleButtonGroup
            value={estimatedFunction}
            exclusive
            onChange={(_, v: BehaviorFunction | null) => setEstimatedFunction(v)}
            size="small"
            sx={{ flexWrap: 'wrap', gap: 0.5 }}
            data-testid="abc-function"
          >
            {(Object.entries(BEHAVIOR_FUNCTION_LABELS) as [BehaviorFunction, string][]).map(
              ([key, label]) => (
                <ToggleButton
                  key={key}
                  value={key}
                  sx={{
                    borderRadius: '16px !important',
                    border: '1px solid',
                    borderColor: 'divider',
                    px: 2,
                    textTransform: 'none',
                    '&.Mui-selected': {
                      bgcolor: `${BEHAVIOR_FUNCTION_COLORS[key]}20`,
                      color: BEHAVIOR_FUNCTION_COLORS[key],
                      borderColor: BEHAVIOR_FUNCTION_COLORS[key],
                      fontWeight: 600,
                    },
                  }}
                >
                  {label}
                </ToggleButton>
              )
            )}
          </ToggleButtonGroup>
        </Box>

        {/* 使用介入方法 */}
        {interventionUsed && (
          <>
            <Divider />
            <Box>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                💊 使用した介入方法
              </Typography>
              <Chip
                icon={<AddCircleOutlineIcon />}
                label={interventionUsed}
                color="primary"
                variant="outlined"
              />
            </Box>
          </>
        )}

        <Divider />

        {/* ── アクション ── */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          {onCancel && (
            <Button variant="text" onClick={onCancel}>キャンセル</Button>
          )}
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!isValid}
            startIcon={<SaveIcon />}
            data-testid="abc-save"
          >
            ABC記録を保存
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default ABCEntryForm;
