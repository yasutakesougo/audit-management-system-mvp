// ---------------------------------------------------------------------------
// GuidelineVersionDialog — 指針版の新規作成ダイアログ
//
// P0-3: 指針版を作成/改訂する。7つの必須項目チェックリスト付き。
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

import {
  type GuidelineVersionDraft,
  type GuidelineRequiredItems,
  guidelineVersionDraftSchema,
  changeTypeValues,
  createEmptyGuidelineDraft,
  fromDraftToGuidelineVersion,
  countFulfilledRequiredItems,
  allRequiredItemsFulfilled,
  REQUIRED_ITEM_LABELS,
  TOTAL_REQUIRED_ITEMS,
} from '@/domain/safety/guidelineVersion';
import { localGuidelineRepository } from '@/infra/localStorage/localComplianceRepository';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GuidelineVersionDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const GuidelineVersionDialog: React.FC<GuidelineVersionDialogProps> = ({
  open,
  onClose,
  onSaved,
}) => {
  const [draft, setDraft] = useState<GuidelineVersionDraft>(createEmptyGuidelineDraft());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(createEmptyGuidelineDraft());
      setError(null);
    }
  }, [open]);

  const fulfilled = countFulfilledRequiredItems(draft.requiredItems);
  const allFulfilled = allRequiredItemsFulfilled(draft.requiredItems);
  const fulfillmentRate = Math.round((fulfilled / TOTAL_REQUIRED_ITEMS) * 100);

  const toggleRequiredItem = (key: keyof GuidelineRequiredItems) => {
    setDraft((prev) => ({
      ...prev,
      requiredItems: {
        ...prev.requiredItems,
        [key]: !prev.requiredItems[key],
      },
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const parsed = guidelineVersionDraftSchema.parse(draft);
      const version = fromDraftToGuidelineVersion('', parsed);
      version.status = 'active';
      await localGuidelineRepository.save(version);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = draft.title.trim().length > 0 && draft.createdBy.trim().length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      data-testid="compliance-guideline-dialog"
    >
      <DialogTitle>指針版の作成</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Alert severity="info">
            身体拘束等適正化のための指針を策定または改訂してください。
            厚労省通知に基づく7つの必須項目の整備状況を確認します。
          </Alert>

          {/* 基本情報 */}
          <TextField
            fullWidth
            label="指針のタイトル"
            value={draft.title}
            onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
            required
            placeholder="例：身体拘束等適正化のための指針"
          />

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' } }}>
            <TextField
              fullWidth
              label="バージョン"
              value={draft.version}
              onChange={(e) => setDraft((prev) => ({ ...prev, version: e.target.value }))}
              placeholder="例: 2.0"
            />
            <FormControl fullWidth>
              <InputLabel>変更種別</InputLabel>
              <Select
                label="変更種別"
                value={draft.changeType}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    changeType: e.target.value as GuidelineVersionDraft['changeType'],
                  }))
                }
              >
                {changeTypeValues.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              type="date"
              label="施行日"
              value={draft.effectiveDate}
              onChange={(e) => setDraft((prev) => ({ ...prev, effectiveDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          {draft.changeType !== '新規策定' && (
            <TextField
              fullWidth
              multiline
              rows={2}
              label="改訂理由"
              value={draft.changeReason}
              onChange={(e) => setDraft((prev) => ({ ...prev, changeReason: e.target.value }))}
              placeholder="例：委員会での検討結果に基づき三要件確認手順を改訂"
            />
          )}

          {/* 指針内容 */}
          <TextField
            fullWidth
            multiline
            rows={4}
            label="指針の本文・要約"
            value={draft.content}
            onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
            placeholder="指針の主要な内容を記述してください"
          />

          <Divider />

          {/* 必須項目チェックリスト */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle1" fontWeight={700}>
                必須項目の整備状況
              </Typography>
              <Typography
                variant="body2"
                fontWeight={700}
                color={allFulfilled ? 'success.main' : 'warning.main'}
              >
                {fulfilled} / {TOTAL_REQUIRED_ITEMS} ({fulfillmentRate}%)
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={fulfillmentRate}
              sx={{
                height: 8,
                borderRadius: 4,
                mb: 2,
                bgcolor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  bgcolor: allFulfilled ? 'success.main' : 'warning.main',
                },
              }}
            />

            <List dense>
              {(Object.entries(REQUIRED_ITEM_LABELS) as [keyof GuidelineRequiredItems, string][]).map(
                ([key, label]) => (
                  <ListItem
                    key={key}
                    disablePadding
                    sx={{
                      py: 0.5,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                      borderRadius: 1,
                    }}
                    onClick={() => toggleRequiredItem(key)}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={draft.requiredItems[key]}
                            onChange={() => toggleRequiredItem(key)}
                            size="small"
                          />
                        }
                        label=""
                        sx={{ m: 0 }}
                      />
                    </ListItemIcon>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      {draft.requiredItems[key] ? (
                        <CheckCircleIcon fontSize="small" color="success" />
                      ) : (
                        <CancelIcon fontSize="small" color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={label}
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontWeight: draft.requiredItems[key] ? 400 : 600,
                        color: draft.requiredItems[key] ? 'text.primary' : 'error.main',
                      }}
                    />
                  </ListItem>
                ),
              )}
            </List>
          </Box>

          {allFulfilled && (
            <Alert severity="success">
              すべての必須項目が整備されています。監査基準を充足しています。
            </Alert>
          )}

          <Divider />

          {/* 作成者 */}
          <TextField
            fullWidth
            label="作成者氏名"
            value={draft.createdBy}
            onChange={(e) => setDraft((prev) => ({ ...prev, createdBy: e.target.value }))}
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
          data-testid="compliance-guideline-submit"
        >
          {submitting ? '保存中…' : '指針を保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
