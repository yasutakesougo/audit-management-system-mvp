// ---------------------------------------------------------------------------
// TrainingRecordDialog — 研修記録の新規作成ダイアログ
//
// P0-3: 適正化研修の実施記録を入力する。
// 参加者管理と理解度フィードバック付き。
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Rating from '@mui/material/Rating';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import {
  type TrainingRecordDraft,
  type TrainingParticipant,
  trainingRecordDraftSchema,
  trainingTypeValues,
  trainingFormatValues,
  createEmptyTrainingDraft,
  fromDraftToTrainingRecord,
} from '@/domain/safety/trainingRecord';
import { localTrainingRepository } from '@/infra/localStorage/localComplianceRepository';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TrainingRecordDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TrainingRecordDialog: React.FC<TrainingRecordDialogProps> = ({
  open,
  onClose,
  onSaved,
}) => {
  const [draft, setDraft] = useState<TrainingRecordDraft>(createEmptyTrainingDraft());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(createEmptyTrainingDraft());
      setError(null);
    }
  }, [open]);

  // Participant management
  const addParticipant = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      participants: [
        ...prev.participants,
        { staffId: '', staffName: '', attended: false },
      ],
    }));
  }, []);

  const removeParticipant = useCallback((index: number) => {
    setDraft((prev) => ({
      ...prev,
      participants: prev.participants.filter((_, i) => i !== index),
    }));
  }, []);

  const updateParticipant = useCallback(
    <K extends keyof TrainingParticipant>(
      index: number,
      field: K,
      value: TrainingParticipant[K],
    ) => {
      setDraft((prev) => ({
        ...prev,
        participants: prev.participants.map((p, i) =>
          i === index ? { ...p, [field]: value } : p,
        ),
      }));
    },
    [],
  );

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const parsed = trainingRecordDraftSchema.parse(draft);
      const record = fromDraftToTrainingRecord('', parsed);
      await localTrainingRepository.save(record);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const isValid =
    draft.title.trim().length > 0 &&
    draft.recordedBy.trim().length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      data-testid="compliance-training-dialog"
    >
      <DialogTitle>研修記録の作成</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Alert severity="info">
            研修の実施記録を入力してください。年2回以上の研修実施が義務付けられています。
          </Alert>

          {/* 基本情報 */}
          <TextField
            fullWidth
            label="研修名"
            value={draft.title}
            onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
            required
            placeholder="例：身体拘束等適正化研修（第1回）"
          />

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' } }}>
            <TextField
              fullWidth
              type="date"
              label="研修実施日"
              value={draft.trainingDate}
              onChange={(e) => setDraft((prev) => ({ ...prev, trainingDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth>
              <InputLabel>研修の種別</InputLabel>
              <Select
                label="研修の種別"
                value={draft.trainingType}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    trainingType: e.target.value as TrainingRecordDraft['trainingType'],
                  }))
                }
              >
                {trainingTypeValues.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>実施形式</InputLabel>
              <Select
                label="実施形式"
                value={draft.format}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    format: e.target.value as TrainingRecordDraft['format'],
                  }))
                }
              >
                {trainingFormatValues.map((f) => (
                  <MenuItem key={f} value={f}>{f}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <TextField
              fullWidth
              type="number"
              label="研修時間（分）"
              value={draft.durationMinutes}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  durationMinutes: Math.max(0, parseInt(e.target.value) || 0),
                }))
              }
              inputProps={{ min: 0 }}
            />
            <TextField
              fullWidth
              label="講師名"
              value={draft.instructor}
              onChange={(e) => setDraft((prev) => ({ ...prev, instructor: e.target.value }))}
              placeholder="例：山田太郎（外部講師）"
            />
          </Box>

          {/* 内容 */}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="研修内容の概要"
            value={draft.description}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="例：身体拘束の三要件について、事例を用いた講義と演習を実施"
          />

          <TextField
            fullWidth
            multiline
            rows={2}
            label="使用した資料・教材"
            value={draft.materials}
            onChange={(e) => setDraft((prev) => ({ ...prev, materials: e.target.value }))}
            placeholder="例：厚労省ガイドライン、事例集スライド（30枚）"
          />

          {/* 参加者 */}
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle2" fontWeight={700}>
                参加者
              </Typography>
              <Button
                size="small"
                startIcon={<AddCircleOutlineIcon />}
                onClick={addParticipant}
              >
                参加者を追加
              </Button>
            </Stack>
            {draft.participants.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                参加者を追加してください
              </Typography>
            ) : (
              <Stack spacing={1}>
                {draft.participants.map((p, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'grid',
                      gap: 1,
                      gridTemplateColumns: { xs: '1fr auto', md: '1fr auto 120px auto' },
                      alignItems: 'center',
                      p: 1,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <TextField
                      size="small"
                      label="氏名"
                      value={p.staffName}
                      onChange={(e) => updateParticipant(i, 'staffName', e.target.value)}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={p.attended}
                          onChange={(_, checked) => updateParticipant(i, 'attended', checked)}
                          size="small"
                        />
                      }
                      label="出席"
                    />
                    {p.attended && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          理解度:
                        </Typography>
                        <Rating
                          size="small"
                          max={5}
                          value={p.comprehensionLevel ?? 0}
                          onChange={(_, newValue) =>
                            updateParticipant(i, 'comprehensionLevel', newValue ?? undefined)
                          }
                        />
                      </Box>
                    )}
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeParticipant(i)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          {/* 評価 */}
          <TextField
            fullWidth
            multiline
            rows={2}
            label="目標達成度メモ"
            value={draft.achievementNotes}
            onChange={(e) => setDraft((prev) => ({ ...prev, achievementNotes: e.target.value }))}
          />

          <TextField
            fullWidth
            multiline
            rows={2}
            label="次回への改善点"
            value={draft.improvementNotes}
            onChange={(e) => setDraft((prev) => ({ ...prev, improvementNotes: e.target.value }))}
          />

          {/* 記録者 */}
          <TextField
            fullWidth
            label="記録者氏名"
            value={draft.recordedBy}
            onChange={(e) => setDraft((prev) => ({ ...prev, recordedBy: e.target.value }))}
            required
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">キャンセル</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting || !isValid}
          data-testid="compliance-training-submit"
        >
          {submitting ? '保存中…' : '記録を保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
