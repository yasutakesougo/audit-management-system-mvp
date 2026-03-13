/**
 * RegulatoryResolutionForm — 制度系 handoff の対応完了記録フォーム
 *
 * P6 Phase 3: finding → 共有 → 会議 → 対応 → 完了 → 証跡
 *
 * 制度系 handoff に対して「誰が」「何をしたか」を記録する。
 * HandoffItem のインラインに表示する想定。
 */

import { CheckCircle as CheckIcon, Edit as EditIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useState } from 'react';
import type { HandoffRecord } from './handoffTypes';
import {
  getRegulatoryResolutionStatus,
  isRegulatoryHandoff,
  type RegulatoryResolutionStatus,
} from './regulatoryResolution';

// ─── Props ─── //

export interface RegulatoryResolutionFormProps {
  record: HandoffRecord;
  /** 現在のユーザー名（resolvedBy に使う） */
  currentUserName: string;
  /** 対応完了を記録するコールバック */
  onResolve: (id: number, resolvedBy: string, resolutionNote: string) => Promise<void>;
}

// ─── 表示用ヘルパー ─── //

const STATUS_CONFIG: Record<RegulatoryResolutionStatus, {
  label: string;
  color: 'default' | 'success' | 'warning';
  icon: string;
}> = {
  pending:         { label: '対応待ち',   color: 'warning', icon: '⏳' },
  closed_no_trail: { label: '証跡なし',   color: 'warning', icon: '⚠️' },
  resolved:        { label: '対応完了済', color: 'success', icon: '✅' },
};

// ─── コンポーネント ─── //

export default function RegulatoryResolutionForm({
  record,
  currentUserName,
  onResolve,
}: RegulatoryResolutionFormProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 制度系でなければ非表示
  if (!isRegulatoryHandoff(record)) return null;

  const resStatus = getRegulatoryResolutionStatus(record);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onResolve(record.id, currentUserName, note.trim());
      setOpen(false);
      setNote('');
    } finally {
      setSubmitting(false);
    }
  }, [record.id, currentUserName, note, onResolve, submitting]);

  const config = STATUS_CONFIG[resStatus];

  // 既に resolved の場合は読み取り専用バッジ
  if (resStatus === 'resolved') {
    return (
      <Box sx={{ mt: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
          <Typography variant="caption" color="success.main" fontWeight={600}>
            対応完了
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {record.resolvedBy} · {record.resolvedAt ? new Date(record.resolvedAt).toLocaleDateString('ja-JP') : ''}
          </Typography>
        </Stack>
        {record.resolutionNote && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 3, display: 'block' }}>
            {record.resolutionNote}
          </Typography>
        )}
      </Box>
    );
  }

  // pending / closed_no_trail の場合: 対応記録フォーム
  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Chip
          size="small"
          color={config.color}
          variant="outlined"
          label={`${config.icon} ${config.label}`}
          sx={{ fontSize: '0.65rem' }}
        />
        {!open && (
          <Button
            size="small"
            variant="text"
            startIcon={<EditIcon sx={{ fontSize: 14 }} />}
            onClick={() => setOpen(true)}
            sx={{ fontSize: '0.7rem', textTransform: 'none' }}
          >
            対応記録
          </Button>
        )}
      </Stack>

      <Collapse in={open}>
        <Stack spacing={1} sx={{ mt: 1, pl: 1 }}>
          <TextField
            size="small"
            multiline
            minRows={2}
            maxRows={4}
            placeholder="何をしたか（例: 基礎研修の受講を手配しました）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
          />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              size="small"
              variant="text"
              onClick={() => { setOpen(false); setNote(''); }}
              disabled={submitting}
            >
              キャンセル
            </Button>
            <Button
              size="small"
              variant="contained"
              color="success"
              onClick={handleSubmit}
              disabled={submitting || !note.trim()}
              startIcon={<CheckIcon sx={{ fontSize: 14 }} />}
            >
              対応完了
            </Button>
          </Stack>
        </Stack>
      </Collapse>
    </Box>
  );
}
