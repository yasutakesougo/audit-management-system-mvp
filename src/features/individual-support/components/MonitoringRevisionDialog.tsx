// ---------------------------------------------------------------------------
// MonitoringRevisionDialog — モニタリング改訂ダイアログ
//
// 3か月ごとのモニタリングミーティングで SPS を改訂するためのフォーム。
// 旧バージョンをスナップショット保存し、新バージョンに移行する。
// ---------------------------------------------------------------------------
import HistoryIcon from '@mui/icons-material/History';
import SaveIcon from '@mui/icons-material/Save';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';

import type { SPSHistoryEntry, SupportPlanSheet } from '@/features/ibd/ibdTypes';

interface MonitoringRevisionDialogProps {
  open: boolean;
  onClose: () => void;
  currentSPS: SupportPlanSheet | null;
  history: SPSHistoryEntry[];
  onRevise: (
    spsId: string,
    revisedBy: number | null,
    revisionReason: string,
    changesSummary: string,
  ) => boolean;
  userName: string;
}

export const MonitoringRevisionDialog: React.FC<MonitoringRevisionDialogProps> = ({
  open,
  onClose,
  currentSPS,
  history,
  onRevise,
  userName,
}) => {
  const [reason, setReason] = useState('');
  const [changes, setChanges] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRevise = () => {
    if (!currentSPS) return;

    if (!reason.trim()) {
      setError('改訂理由を入力してください。');
      return;
    }
    if (!changes.trim()) {
      setError('変更内容を入力してください。');
      return;
    }

    const result = onRevise(currentSPS.id, null, reason.trim(), changes.trim());
    if (result) {
      setSuccess(true);
      setError(null);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } else {
      setError('改訂に失敗しました。SPS が見つかりません。');
    }
  };

  const handleClose = () => {
    setReason('');
    setChanges('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  if (!currentSPS) return null;

  const dueDate = new Date(currentSPS.nextReviewDueDate).toLocaleDateString('ja-JP');

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon color="primary" />
        📝 モニタリング更新 — {userName}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* 現行バージョン情報 */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              現行バージョン情報
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Chip label={`バージョン: ${currentSPS.version}`} color="primary" variant="outlined" />
              <Chip
                label={`ステータス: ${currentSPS.status === 'confirmed' ? '確定済み' : currentSPS.status === 'draft' ? '下書き' : '期限切れ'}`}
                color={currentSPS.status === 'confirmed' ? 'success' : 'warning'}
                variant="outlined"
              />
              <Chip label={`次回見直し: ${dueDate}`} variant="outlined" />
              <Chip label={`改訂回数: ${history.length}回`} variant="outlined" />
            </Stack>
          </Box>

          <Divider />

          {/* 改訂フォーム */}
          {success ? (
            <Alert severity="success" variant="filled">
              ✅ {currentSPS.version} → 新バージョンへの改訂が完了しました。次回見直し期限は 90 日後にリセットされました。
            </Alert>
          ) : (
            <>
              <TextField
                label="改訂理由 *"
                placeholder="例：3か月モニタリングにより、AM活動時のパニック頻度が減少したため手順を更新"
                multiline
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError(null);
                }}
                fullWidth
                error={!!error && !reason.trim()}
              />

              <TextField
                label="変更内容サマリ *"
                placeholder="例：10:30 AM個別作業の声掛けタイミングを変更。13:30 グループ活動の参加条件を緩和。"
                multiline
                rows={3}
                value={changes}
                onChange={(e) => {
                  setChanges(e.target.value);
                  setError(null);
                }}
                fullWidth
                error={!!error && !changes.trim()}
              />

              {error && (
                <Alert severity="error" variant="outlined">
                  {error}
                </Alert>
              )}
            </>
          )}

          {/* 改訂履歴 */}
          {history.length > 0 && (
            <>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                📜 過去の改訂履歴
              </Typography>
              <Stack spacing={1.5}>
                {history.map((entry) => (
                  <Paper key={entry.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Chip label={entry.version} size="small" color="primary" variant="outlined" />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(entry.snapshotAt).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>
                      {entry.revisionReason}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {entry.changesSummary}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} color="inherit">
          {success ? '閉じる' : 'キャンセル'}
        </Button>
        {!success && (
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleRevise}
            disabled={!reason.trim() || !changes.trim()}
          >
            改訂を保存
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
