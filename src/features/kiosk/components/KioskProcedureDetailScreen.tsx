import React, { useState } from 'react';
import { Box, Typography, IconButton, Paper, Grid, Button, Chip, Stack, Alert, Snackbar, TextField, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Drawer } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { KioskProcedureHistoryPanel } from './KioskProcedureHistoryPanel';
import { appendKioskSearchParams } from '../utils/navigation';
import { useUser } from '@/features/users/useUsers';
import { useProcedureData } from '@/features/daily/hooks/useProcedureData';
import { useExecutionRecord } from '@/features/daily/hooks/useExecutionRecord';
import { resolveKioskRecordDate } from '../utils/kioskDate';
import {
  buildExecutionUserIdCandidates,
  normalizeScheduleItemId,
} from '@/features/daily/utils/normalizeExecutionLookup';
import {
  parseKioskProcedureMemo,
  serializeKioskProcedureMemo,
} from '../domain/kioskProcedureMemo';
import { resolveProcedureUserQueryCandidates } from '../utils/resolveProcedureUserQuery';

const MOOD_CHIPS = ['落ち着いていた', '不安そう', '拒否あり', '興奮あり', '切り替え困難'];
const ACTION_CHIPS = ['見守り', '声かけ', '環境調整', '活動変更', '距離を取る', 'クールダウン'];
const RESULT_CHIPS = ['改善した', '変化なし', '悪化した', '途中で落ち着いた'];

const buildScheduleItemIdCandidates = (
  procedure: { id?: unknown; rowNo?: unknown } | null,
  slotKey: string | undefined,
): string[] => {
  const keys = new Set<string>();
  const push = (value: unknown) => {
    const normalized = normalizeScheduleItemId(value);
    if (normalized) keys.add(normalized);
  };

  const rowNo = normalizeScheduleItemId(procedure?.rowNo);
  const slotIndex = Number.parseInt(String(slotKey ?? ''), 10);
  const indexPlusOne = Number.isNaN(slotIndex) ? '' : String(slotIndex + 1);
  const rowCandidates = [rowNo, indexPlusOne].filter(Boolean);

  push(procedure?.id);
  push(slotKey);
  for (const rowCandidate of rowCandidates) {
    push(rowCandidate);
    push(`base-${rowCandidate}`);
    push(`row-${rowCandidate}`);
    push(`procedure-${rowCandidate}`);
    push(`slot-${rowCandidate}`);
    push(`slot_${rowCandidate}`);
    push(`step-${rowCandidate}`);
  }

  return Array.from(keys);
};

export const KioskProcedureDetailScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, slotKey } = useParams<{ userId: string; slotKey: string }>();
  const { data: user, status } = useUser(userId || '');
  const isUserLoading = status === 'loading' || status === 'idle';
  const procedureRepo = useProcedureData();
  
  const selectedDateIso = React.useMemo(() => resolveKioskRecordDate(location.search), [location.search]);
  const deepLinkUserId = React.useMemo(() => {
    const canonical = String(user?.UserID ?? '').trim();
    if (canonical) return canonical;
    return String(userId ?? '').trim();
  }, [user?.UserID, userId]);
  const returnRouteUserId = React.useMemo(() => {
    const routeId = String(userId ?? '').trim();
    if (routeId) return routeId;
    return deepLinkUserId;
  }, [deepLinkUserId, userId]);
  
  const procedure = React.useMemo(() => {
    const queryId = resolveProcedureUserQueryCandidates(user, userId);
    if (!queryId || slotKey === undefined) return null;
    const procedures = procedureRepo.getByUser(queryId);
    const index = parseInt(slotKey, 10);
    return procedures[index] || null;
  }, [userId, user, slotKey, procedureRepo]);

  // rowNo is the canonical slot identity for kiosk procedure completion tracking.
  // Some procedure IDs can vary by source/runtime, so prefer rowNo for persistence keys.
  const scheduleItemId = normalizeScheduleItemId(procedure?.rowNo) ||
    normalizeScheduleItemId(procedure?.id) ||
    normalizeScheduleItemId(slotKey);
  const historyScheduleItemIds = React.useMemo(() => {
    const indexValue = Number.parseInt(String(slotKey ?? ''), 10);
    const indexPlusOne = Number.isNaN(indexValue) ? '' : normalizeScheduleItemId(indexValue + 1);
    return [
      normalizeScheduleItemId(procedure?.rowNo),
      normalizeScheduleItemId(procedure?.id),
      normalizeScheduleItemId(slotKey),
      indexPlusOne,
    ].filter((value, idx, arr): value is string => Boolean(value) && arr.indexOf(value) === idx);
  }, [procedure?.id, procedure?.rowNo, slotKey]);
  const historyUserIds = React.useMemo(() => {
    const rawUserId = String(userId ?? '').trim();
    const masterUserId = String(user?.UserID ?? '').trim();
    const compactMasterUserId = masterUserId.replace(/-/g, '');
    return [rawUserId, masterUserId, compactMasterUserId].filter(
      (value, idx, arr): value is string => Boolean(value) && arr.indexOf(value) === idx,
    );
  }, [user?.UserID, userId]);
  const fallbackScheduleItemIds = React.useMemo(
    () => buildScheduleItemIdCandidates(procedure, slotKey),
    [procedure, slotKey],
  );
  const fallbackUserIds = React.useMemo(
    () => (isUserLoading ? [] : buildExecutionUserIdCandidates(deepLinkUserId, userId)),
    [deepLinkUserId, isUserLoading, userId],
  );

  const abcSlotId = React.useMemo(() => {
    const time = procedure?.time ?? '';
    const activity = procedure?.activity ?? '';
    if (!time || !activity) return '';
    return `${time}|${activity}`;
  }, [procedure?.activity, procedure?.time]);

  const abcRecordLink = React.useMemo(() => {
    if (!deepLinkUserId || !abcSlotId) return '/abc-record';
    const returnParams = new URLSearchParams({ date: selectedDateIso });
    const params = new URLSearchParams({
      userId: deepLinkUserId,
      source: 'daily-support',
      date: selectedDateIso,
      slotId: abcSlotId,
      kiosk: '1',
      returnUrl: `/kiosk/users/${encodeURIComponent(returnRouteUserId)}/procedures/${encodeURIComponent(String(slotKey ?? ''))}?${returnParams.toString()}`,
    });
    return `/abc-record?${params.toString()}`;
  }, [abcSlotId, deepLinkUserId, returnRouteUserId, selectedDateIso, slotKey]);
  // isUserLoading 中は空文字を渡し、確定前の userId が saveRecord のクロージャに
  // 束縛されて Zustand に誤ったキーで保存されるのを防ぐ
  const resolvedUserId = isUserLoading ? '' : deepLinkUserId;
  const { record, saveRecord, deleteRecord, isLoading } = useExecutionRecord(
    selectedDateIso,
    resolvedUserId,
    scheduleItemId,
    fallbackScheduleItemIds,
    fallbackUserIds,
  );
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSaveError, setShowSaveError] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [showDeleteError, setShowDeleteError] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // 観察チップ用ステート
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedResult, setSelectedResult] = useState<string>('');
  const [textMemo, setTextMemo] = useState<string>('');
  const [showObservations] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // 以前の保存記録からステートを復元する（1回限り）
  React.useEffect(() => {
    const isRecordLoading = isLoading || isUserLoading || !resolvedUserId;
    if (isRecordLoading || isInitialized) return;
    
    if (record) {
      const parsedMemo = parseKioskProcedureMemo(record.memo);
      setSelectedMood(parsedMemo.mood);
      setSelectedAction(parsedMemo.action);
      setSelectedResult(parsedMemo.result);
      setTextMemo(parsedMemo.memo);
    }
    
    setIsInitialized(true);
  }, [record, isLoading, isUserLoading, resolvedUserId, isInitialized]);

  const serializeMemo = () => {
    return serializeKioskProcedureMemo({
      mood: selectedMood,
      action: selectedAction,
      result: selectedResult,
      memo: textMemo,
    });
  };

  const handleSave = async () => {
    if (!userId || isUserLoading || !resolvedUserId) return;
    const finalMemo = serializeMemo();
    if (!finalMemo.trim()) {
      setShowValidationError(true);
      return;
    }
    setIsSaving(true);
    try {
      await saveRecord('completed', finalMemo);
      setShowSuccess(true);
      // 成功フィードバックの後、少し待ってから一覧に戻る
      setTimeout(() => {
        navigate(appendKioskSearchParams(`/kiosk/users/${userId}/procedures`, location.search));
      }, 1500);
    } catch (error) {
      console.error('Failed to save execution record:', error);
      setShowSaveError(true);
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteRecord();
      setDeleteDialogOpen(false);
      setShowDeleteSuccess(true);
      setTimeout(() => {
        navigate(appendKioskSearchParams(`/kiosk/users/${userId}/procedures`, location.search));
      }, 1500);
    } catch (error) {
      console.error('Failed to delete execution record:', error);
      setShowDeleteError(true);
      setIsDeleting(false);
    }
  };

  // Show initial loading state only. 
  // Background re-fetches (triggered by store updates) should not unmount the entire UI,
  // otherwise the History Drawer state will be reset.
  if (isUserLoading || (isLoading && !isInitialized)) {
    return (
      <Box sx={{ 
        p: 4, 
        height: '100dvh', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        bgcolor: 'background.default'
      }}>
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography color="text.secondary">読み込み中...</Typography>
      </Box>
    );
  }

  if (!user || !procedure) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5">情報が見つかりません</Typography>
        <Button 
          variant="contained" 
          onClick={() => navigate(appendKioskSearchParams(`/kiosk/users/${userId}/procedures`, location.search))} 
          sx={{ mt: 2 }}
          startIcon={<ArrowBackIcon />}
        >
          一覧に戻る
        </Button>
      </Box>
    );
  }

  const parts = (procedure.instruction || '').split('。').filter(Boolean);
  const personTask = procedure.activityDetail || parts[0] || '手順に従って進めましょう';
  const staffTask = procedure.instructionDetail || parts.slice(1).join('。') || '適宜見守り、必要に応じて声掛けを行います';

  const isCompleted = record?.status === 'completed';

  return (
    <Box sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            onClick={() => navigate(appendKioskSearchParams(`/kiosk/users/${userId}/procedures`, location.search))} 
            sx={{ mr: 2, bgcolor: 'action.hover' }}
            data-testid="kiosk-procedure-detail-back"
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
          <Box>
            <Typography variant="h6" color="text.secondary" sx={{ mb: -0.5 }}>
              {procedure.time} - {procedure.activity}
            </Typography>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
              {user.FullName} 様
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="outlined"
            color="secondary"
            onClick={() =>
              navigate(abcRecordLink, {
                state: {
                  draftBehavior: `${procedure.time} ${procedure.activity}の時間帯に問題行動あり`,
                  draftSlotId: abcSlotId,
                },
              })
            }
            disabled={!abcSlotId}
            sx={{ fontWeight: 'bold', borderRadius: 3 }}
            data-testid="kiosk-procedure-detail-abc-record"
          >
            この手順でABC記録
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<HistoryIcon />}
            onClick={() => setShowHistory(true)}
            sx={{ fontWeight: 'bold', borderRadius: 3 }}
          >
            履歴・傾向を見る
          </Button>
          {isCompleted && (
            <Chip label="実施済み" color="success" icon={<CheckCircleOutlineIcon />} sx={{ fontWeight: 'bold' }} />
          )}
        </Stack>
      </Box>

      {/* メインコンテンツ */}
      <Grid container spacing={4} sx={{ flexGrow: 1, mb: 4 }}>
        {/* 本人のやる事 */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 4, 
              height: '100%', 
              bgcolor: 'primary.lighter', 
              borderRadius: 6,
              border: '2px solid',
              borderColor: 'primary.light',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Typography variant="h5" color="primary.main" sx={{ mb: 3, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              <Box sx={{ width: 8, height: 24, bgcolor: 'primary.main', mr: 2, borderRadius: 1 }} />
              本人のすること
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold', lineHeight: 1.4, flexGrow: 1 }}>
              {personTask}
            </Typography>
          </Paper>
        </Grid>

        {/* 支援者のやる事 */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 4, 
              height: '100%', 
              bgcolor: 'action.hover', 
              borderRadius: 6,
              border: '2px solid transparent',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Typography variant="h5" color="text.secondary" sx={{ mb: 3, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              <Box sx={{ width: 8, height: 24, bgcolor: 'text.disabled', mr: 2, borderRadius: 1 }} />
              支援者がすること
            </Typography>
            <Typography variant="h4" sx={{ color: 'text.secondary', lineHeight: 1.5, flexGrow: 1 }}>
              {staffTask}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* 観察記録の入力パネル */}
      {showObservations && (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            mb: 4,
            borderRadius: 6,
            border: '2px solid',
            borderColor: 'warning.light',
            bgcolor: 'warning.lighter',
          }}
          data-testid="kiosk-observation-panel"
        >
          <Typography variant="h5" color="primary.main" sx={{ mb: 3, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 8, height: 24, bgcolor: 'primary.main', mr: 2, borderRadius: 1 }} />
            手順記録の作成
          </Typography>

          <Stack spacing={4}>
            {/* 1. 本人の様子 */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1.5, color: 'text.secondary' }}>
                本人の様子
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {MOOD_CHIPS.map((chip) => {
                  const active = selectedMood === chip;
                  return (
                    <Chip
                      key={chip}
                      label={chip}
                      onClick={() => setSelectedMood(active ? '' : chip)}
                      color={active ? 'warning' : 'default'}
                      variant={active ? 'filled' : 'outlined'}
                      sx={{ fontSize: '1.1rem', py: 2.5, px: 1, borderRadius: 3, fontWeight: active ? 'bold' : 'normal' }}
                      data-testid={`mood-chip-${chip}`}
                    />
                  );
                })}
              </Stack>
            </Box>

            {/* 2. 支援者の対応 */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1.5, color: 'text.secondary' }}>
                支援者の対応
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {ACTION_CHIPS.map((chip) => {
                  const active = selectedAction === chip;
                  return (
                    <Chip
                      key={chip}
                      label={chip}
                      onClick={() => setSelectedAction(active ? '' : chip)}
                      color={active ? 'warning' : 'default'}
                      variant={active ? 'filled' : 'outlined'}
                      sx={{ fontSize: '1.1rem', py: 2.5, px: 1, borderRadius: 3, fontWeight: active ? 'bold' : 'normal' }}
                      data-testid={`action-chip-${chip}`}
                    />
                  );
                })}
              </Stack>
            </Box>

            {/* 3. 変化 */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1.5, color: 'text.secondary' }}>
                変化
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {RESULT_CHIPS.map((chip) => {
                  const active = selectedResult === chip;
                  return (
                    <Chip
                      key={chip}
                      label={chip}
                      onClick={() => setSelectedResult(active ? '' : chip)}
                      color={active ? 'warning' : 'default'}
                      variant={active ? 'filled' : 'outlined'}
                      sx={{ fontSize: '1.1rem', py: 2.5, px: 1, borderRadius: 3, fontWeight: active ? 'bold' : 'normal' }}
                      data-testid={`result-chip-${chip}`}
                    />
                  );
                })}
              </Stack>
            </Box>

            {/* 4. メモ */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1.5, color: 'text.secondary' }}>
                メモ (自由記述)
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                variant="outlined"
                placeholder="様子や対応について、その他の補足事項があれば入力してください"
                value={textMemo}
                onChange={(e) => setTextMemo(e.target.value)}
                sx={{
                  bgcolor: 'background.paper',
                  borderRadius: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                  }
                }}
                inputProps={{ 'data-testid': 'kiosk-observation-memo' }}
              />
            </Box>

            {/* 操作ボタン */}
            <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 2 }}>
              {isCompleted && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setDeleteDialogOpen(true)}
                  sx={{ py: 1.5, px: 3, borderRadius: 3, fontSize: '1.1rem', mr: 'auto' }}
                  disabled={isSaving || isDeleting}
                  data-testid="kiosk-observation-revert"
                >
                  記録を取り消す
                </Button>
              )}
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => navigate(appendKioskSearchParams(`/kiosk/users/${userId}/procedures`, location.search))}
                sx={{ py: 1.5, px: 3, borderRadius: 3, fontSize: '1.1rem' }}
                disabled={isSaving || isDeleting}
              >
                一覧に戻る
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSave}
                sx={{ py: 1.5, px: 4, borderRadius: 3, fontSize: '1.1rem', fontWeight: 'bold' }}
                disabled={isSaving || isDeleting}
                data-testid="kiosk-observation-submit"
              >
                記録を保存する
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* 成功メッセージ */}
      <Snackbar 
        open={showSuccess} 
        autoHideDuration={3000} 
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%', fontSize: '1.2rem', fontWeight: 'bold' }}>
          記録を保存しました
        </Alert>
      </Snackbar>

      <Snackbar
        open={showSaveError}
        autoHideDuration={4000}
        onClose={() => setShowSaveError(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" sx={{ width: '100%' }}>
          記録の保存に失敗しました。再度お試しください。
        </Alert>
      </Snackbar>

      <Snackbar
        open={showValidationError}
        autoHideDuration={3000}
        onClose={() => setShowValidationError(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" sx={{ width: '100%' }}>
          手順記録の内容を1つ以上入力してください。
        </Alert>
      </Snackbar>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !isDeleting && setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        PaperProps={{
          sx: { borderRadius: 4, p: 2 }
        }}
      >
        <DialogTitle id="delete-dialog-title" sx={{ fontWeight: 'bold', fontSize: '1.3rem' }}>
          記録を取り消しますか？
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description" sx={{ fontSize: '1.1rem', color: 'text.primary' }}>
            この手順の実施記録とメモを完全に削除し、未実施の状態に戻します。この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setDeleteDialogOpen(false)}
            disabled={isDeleting}
            sx={{ borderRadius: 3, px: 3 }}
          >
            キャンセル
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={isDeleting}
            sx={{ borderRadius: 3, px: 3, fontWeight: 'bold' }}
            autoFocus
            data-testid="kiosk-observation-revert-confirm"
          >
            {isDeleting ? '取り消し中...' : '取り消す'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除成功メッセージ */}
      <Snackbar 
        open={showDeleteSuccess} 
        autoHideDuration={3000} 
        onClose={() => setShowDeleteSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%', fontSize: '1.2rem', fontWeight: 'bold' }}>
          記録を取り消しました
        </Alert>
      </Snackbar>

      <Snackbar
        open={showDeleteError}
        autoHideDuration={4000}
        onClose={() => setShowDeleteError(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" sx={{ width: '100%' }}>
          記録の取り消しに失敗しました。再度お試しください。
        </Alert>
      </Snackbar>

      <Drawer
        anchor="right"
        open={showHistory}
        onClose={() => setShowHistory(false)}
        PaperProps={{
          sx: { width: { xs: '100%', md: 450 } }
        }}
      >
        <KioskProcedureHistoryPanel
          userId={userId || ''}
          fallbackUserIds={historyUserIds}
          scheduleItemId={scheduleItemId}
          fallbackScheduleItemIds={historyScheduleItemIds}
          userName={user.FullName}
          procedureName={procedure.activity}
          onClose={() => setShowHistory(false)}
        />
      </Drawer>
    </Box>
  );
};
