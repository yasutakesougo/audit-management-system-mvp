// ---------------------------------------------------------------------------
// CommitteeMeetingDialog — 委員会記録の新規作成ダイアログ
//
// P0-3: 適正化委員会の開催記録を入力する。
// シンプルな1画面フォーム形式。
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
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  type CommitteeMeetingDraft,
  type CommitteeAttendee,
  committeeMeetingDraftSchema,
  committeeTypeValues,
  createEmptyCommitteeDraft,
  fromDraftToCommitteeRecord,
} from '@/domain/safety/complianceCommittee';
import { localCommitteeRepository } from '@/infra/localStorage/localComplianceRepository';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommitteeMeetingDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CommitteeMeetingDialog: React.FC<CommitteeMeetingDialogProps> = ({
  open,
  onClose,
  onSaved,
}) => {
  const [draft, setDraft] = useState<CommitteeMeetingDraft>(createEmptyCommitteeDraft());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(createEmptyCommitteeDraft());
      setError(null);
    }
  }, [open]);

  // Attendee management
  const addAttendee = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      attendees: [...prev.attendees, { staffId: '', staffName: '', role: '' }],
    }));
  }, []);

  const removeAttendee = useCallback((index: number) => {
    setDraft((prev) => ({
      ...prev,
      attendees: prev.attendees.filter((_, i) => i !== index),
    }));
  }, []);

  const updateAttendee = useCallback(
    (index: number, field: keyof CommitteeAttendee, value: string) => {
      setDraft((prev) => ({
        ...prev,
        attendees: prev.attendees.map((a, i) =>
          i === index ? { ...a, [field]: value } : a,
        ),
      }));
    },
    [],
  );

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const parsed = committeeMeetingDraftSchema.parse(draft);
      const record = fromDraftToCommitteeRecord('', parsed);
      record.status = 'finalized';
      await localCommitteeRepository.save(record);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = draft.agenda.trim().length > 0 && draft.recordedBy.trim().length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      data-testid="compliance-committee-dialog"
    >
      <DialogTitle>委員会記録の作成</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Alert severity="info">
            適正化委員会の開催記録を入力してください。年4回以上の開催が推奨されています。
          </Alert>

          {/* 基本情報 */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <TextField
              fullWidth
              type="date"
              label="開催日"
              value={draft.meetingDate}
              onChange={(e) => setDraft((prev) => ({ ...prev, meetingDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth>
              <InputLabel>種別</InputLabel>
              <Select
                label="種別"
                value={draft.committeeType}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    committeeType: e.target.value as CommitteeMeetingDraft['committeeType'],
                  }))
                }
              >
                {committeeTypeValues.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <TextField
            fullWidth
            label="議題"
            value={draft.agenda}
            onChange={(e) => setDraft((prev) => ({ ...prev, agenda: e.target.value }))}
            required
            placeholder="例：身体拘束等の適正化に関する定期検討"
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
                onClick={addAttendee}
              >
                参加者を追加
              </Button>
            </Stack>
            {draft.attendees.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                参加者を追加してください
              </Typography>
            ) : (
              <Stack spacing={1}>
                {draft.attendees.map((a, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'grid',
                      gap: 1,
                      gridTemplateColumns: '1fr 1fr auto',
                      alignItems: 'center',
                    }}
                  >
                    <TextField
                      size="small"
                      label="氏名"
                      value={a.staffName}
                      onChange={(e) => updateAttendee(i, 'staffName', e.target.value)}
                    />
                    <TextField
                      size="small"
                      label="役割"
                      value={a.role}
                      onChange={(e) => updateAttendee(i, 'role', e.target.value)}
                      placeholder="例: 委員長, 委員, 書記"
                    />
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeAttendee(i)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          {/* 議事内容 */}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="議事概要"
            value={draft.summary}
            onChange={(e) => setDraft((prev) => ({ ...prev, summary: e.target.value }))}
          />

          <TextField
            fullWidth
            multiline
            rows={2}
            label="決定事項"
            value={draft.decisions}
            onChange={(e) => setDraft((prev) => ({ ...prev, decisions: e.target.value }))}
          />

          <TextField
            fullWidth
            multiline
            rows={2}
            label="課題・改善事項"
            value={draft.issues}
            onChange={(e) => setDraft((prev) => ({ ...prev, issues: e.target.value }))}
          />

          {/* 身体拘束検討 */}
          <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={draft.restraintDiscussed}
                  onChange={(_, checked) =>
                    setDraft((prev) => ({ ...prev, restraintDiscussed: checked }))
                  }
                />
              }
              label={
                <Typography fontWeight={600}>
                  身体拘束に関する検討を行った
                </Typography>
              }
            />
            {draft.restraintDiscussed && (
              <TextField
                fullWidth
                multiline
                rows={2}
                label="身体拘束に関する検討の詳細"
                value={draft.restraintDiscussionDetail}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    restraintDiscussionDetail: e.target.value,
                  }))
                }
                placeholder="例：○○さんの拘束記録を検討し、代替方法について議論した"
                sx={{ mt: 1 }}
              />
            )}
          </Box>

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
          data-testid="compliance-committee-submit"
        >
          {submitting ? '保存中…' : '記録を保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
