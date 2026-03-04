// ---------------------------------------------------------------------------
// ObservationFeedbackPanel — 観察者による PDCA フィードバック入力パネル
// 観察ログを「証跡」から「支援改善のトリガー」へ昇格させる
// ---------------------------------------------------------------------------
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditNoteIcon from '@mui/icons-material/EditNote';
import EscalatorWarningIcon from '@mui/icons-material/EscalatorWarning';
import Alert from '@mui/material/Alert';
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
import type { FC, ReactElement } from 'react';
import { useCallback, useState } from 'react';

import type { PDCARecommendation, SupervisionLog } from '../ibdTypes';
import { PDCA_RECOMMENDATION_LABELS } from '../ibdTypes';
import { toLocalDateISO } from '@/utils/getNow';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ObservationFeedbackPanelProps = {
  /** 対象利用者ID */
  userId: number;
  /** 対象利用者名 */
  userName: string;
  /** 観察者（実践研修修了者）ID */
  supervisorId: number;
  /** 保存コールバック */
  onSave: (log: SupervisionLog) => void;
  /** キャンセルコールバック */
  onCancel?: () => void;
};

// ---------------------------------------------------------------------------
// PDCAボタン設定
// ---------------------------------------------------------------------------

const PDCA_OPTIONS: {
  value: PDCARecommendation;
  icon: ReactElement;
  color: 'success' | 'info' | 'warning' | 'error';
}[] = [
  { value: 'continue', icon: <CheckCircleIcon />, color: 'success' },
  { value: 'adjust', icon: <BuildIcon />, color: 'info' },
  { value: 'revise', icon: <EditNoteIcon />, color: 'warning' },
  { value: 'escalate', icon: <EscalatorWarningIcon />, color: 'error' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * 観察者 PDCA フィードバックパネル
 *
 * 実践研修修了者が現場観察後に入力するフォーム。
 * 従来の「メモ」レベルから、手順書更新への具体的提案を含む
 * 構造化されたフィードバックへ昇格させる。
 *
 * - 手順書遵守度（5段階評価）
 * - 発見した新しい「良い状態の条件」
 * - 手順書更新の提案
 * - PDCAサイクルへの推奨アクション
 */
const ObservationFeedbackPanel: FC<ObservationFeedbackPanelProps> = ({
  userId,
  userName,
  supervisorId,
  onSave,
  onCancel,
}) => {
  // Form state
  const [notes, setNotes] = useState('');
  const [actionsTaken, setActionsTaken] = useState('');
  const [adherence, setAdherence] = useState<number | null>(null);
  const [newCondition, setNewCondition] = useState('');
  const [discoveredConditions, setDiscoveredConditions] = useState<string[]>([]);
  const [updateSuggestion, setUpdateSuggestion] = useState('');
  const [suggestedUpdates, setSuggestedUpdates] = useState<string[]>([]);
  const [pdcaRecommendation, setPdcaRecommendation] = useState<PDCARecommendation | null>(null);

  // Handlers
  const handleAddCondition = useCallback(() => {
    const trimmed = newCondition.trim();
    if (trimmed && !discoveredConditions.includes(trimmed)) {
      setDiscoveredConditions((prev) => [...prev, trimmed]);
      setNewCondition('');
    }
  }, [newCondition, discoveredConditions]);

  const handleRemoveCondition = useCallback((condition: string) => {
    setDiscoveredConditions((prev) => prev.filter((c) => c !== condition));
  }, []);

  const handleAddUpdate = useCallback(() => {
    const trimmed = updateSuggestion.trim();
    if (trimmed && !suggestedUpdates.includes(trimmed)) {
      setSuggestedUpdates((prev) => [...prev, trimmed]);
      setUpdateSuggestion('');
    }
  }, [updateSuggestion, suggestedUpdates]);

  const handleRemoveUpdate = useCallback((update: string) => {
    setSuggestedUpdates((prev) => prev.filter((u) => u !== update));
  }, []);

  const handleSave = useCallback(() => {
    const log: SupervisionLog = {
      id: `obs-${Date.now()}`,
      userId,
      supervisorId,
      observedAt: toLocalDateISO(),
      notes,
      actionsTaken: actionsTaken
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      ...(adherence != null && { adherenceToManual: adherence }),
      ...(discoveredConditions.length > 0 && { discoveredPositiveConditions: discoveredConditions }),
      ...(suggestedUpdates.length > 0 && { suggestedProcedureUpdates: suggestedUpdates }),
      ...(pdcaRecommendation != null && { pdcaRecommendation }),
    };
    onSave(log);
  }, [
    userId,
    supervisorId,
    notes,
    actionsTaken,
    adherence,
    discoveredConditions,
    suggestedUpdates,
    pdcaRecommendation,
    onSave,
  ]);

  const isValid = notes.trim().length > 0;

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }} data-testid="observation-feedback-panel">
      <Stack spacing={3}>
        {/* ── ヘッダー ── */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <AssignmentTurnedInIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            指導・観察フィードバック
          </Typography>
          <Chip label={userName} size="small" variant="outlined" />
        </Stack>

        <Divider />

        {/* ── 基本メモ ── */}
        <TextField
          label="観察メモ *"
          placeholder="支援の様子、本人の状態、環境の変化など"
          multiline
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          fullWidth
          data-testid="observation-notes"
        />

        <TextField
          label="実施した支援内容（1行1項目）"
          placeholder="計画通り支援を実施&#10;環境調整の効果を確認"
          multiline
          rows={2}
          value={actionsTaken}
          onChange={(e) => setActionsTaken(e.target.value)}
          fullWidth
          data-testid="observation-actions"
        />

        <Divider />

        {/* ── 手順書遵守度 ── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            📊 手順書遵守度
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            手順書通りに支援が実施されていたか（1: 大幅にズレ → 5: 完全に手順通り）
          </Typography>
          <Rating
            value={adherence}
            onChange={(_, newValue) => setAdherence(newValue)}
            size="large"
            data-testid="adherence-rating"
          />
        </Box>

        <Divider />

        {/* ── 発見した良い状態の条件 ── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            ✨ 発見した「良い状態の条件」
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            観察中に見つけた、本人が安定していた新しい条件
          </Typography>

          {discoveredConditions.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              {discoveredConditions.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  color="success"
                  variant="filled"
                  size="small"
                  onDelete={() => handleRemoveCondition(c)}
                />
              ))}
            </Stack>
          )}

          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              placeholder="例: 特定のBGMで落ち着く"
              value={newCondition}
              onChange={(e) => setNewCondition(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCondition();
                }
              }}
              sx={{ flex: 1 }}
              data-testid="new-condition-input"
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddCircleOutlineIcon />}
              onClick={handleAddCondition}
              disabled={!newCondition.trim()}
            >
              追加
            </Button>
          </Stack>
        </Box>

        <Divider />

        {/* ── 手順書更新の提案 ── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            🔧 手順書更新の提案
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            現場で気づいた「手順のズレ」や改善案
          </Typography>

          {suggestedUpdates.length > 0 && (
            <Stack spacing={0.5} sx={{ mb: 1 }}>
              {suggestedUpdates.map((u) => (
                <Alert
                  key={u}
                  severity="info"
                  variant="outlined"
                  onClose={() => handleRemoveUpdate(u)}
                  sx={{ py: 0, borderRadius: 1 }}
                >
                  <Typography variant="body2">{u}</Typography>
                </Alert>
              ))}
            </Stack>
          )}

          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              placeholder="例: 来所時のプロンプトを写真カードに変更すべき"
              value={updateSuggestion}
              onChange={(e) => setUpdateSuggestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddUpdate();
                }
              }}
              sx={{ flex: 1 }}
              data-testid="update-suggestion-input"
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddCircleOutlineIcon />}
              onClick={handleAddUpdate}
              disabled={!updateSuggestion.trim()}
            >
              追加
            </Button>
          </Stack>
        </Box>

        <Divider />

        {/* ── PDCA推奨アクション ── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            📋 PDCA 推奨アクション
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            この観察を踏まえて、次のステップとして何を推奨しますか？
          </Typography>

          <ToggleButtonGroup
            value={pdcaRecommendation}
            exclusive
            onChange={(_, v: PDCARecommendation | null) => setPdcaRecommendation(v)}
            size="small"
            sx={{ flexWrap: 'wrap', gap: 0.5 }}
            data-testid="pdca-toggle"
          >
            {PDCA_OPTIONS.map((opt) => (
              <ToggleButton
                key={opt.value}
                value={opt.value}
                sx={{
                  borderRadius: '16px !important',
                  border: '1px solid',
                  borderColor: 'divider',
                  px: 2,
                  textTransform: 'none',
                  '&.Mui-selected': {
                    bgcolor: `${opt.color}.light`,
                    color: `${opt.color}.dark`,
                    borderColor: `${opt.color}.main`,
                    fontWeight: 600,
                  },
                }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {opt.icon}
                  <span>{PDCA_RECOMMENDATION_LABELS[opt.value]}</span>
                </Stack>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Divider />

        {/* ── アクション ── */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          {onCancel && (
            <Button variant="text" onClick={onCancel}>
              キャンセル
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!isValid}
            startIcon={<AssignmentTurnedInIcon />}
            data-testid="observation-save-button"
          >
            観察ログを保存
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default ObservationFeedbackPanel;
