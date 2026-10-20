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
import { useKioskAttendance } from '../hooks/useKioskAttendance';
import { KioskProcedureRecordSummary } from './KioskProcedureRecordSummary';

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
  // Do not add raw route-index based candidates.
  // route index is 0-based and can collide with rowNo-based persisted records.
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
  const { data: fetchedUser, status } = useUser(userId || '');
  const user = React.useMemo(() => {
    const lookup = String(userId ?? '').trim();
    if (!lookup || !fetchedUser) return null;
    const matchesRouteId = String(fetchedUser.UserID ?? '').trim() === lookup
      || String(fetchedUser.Id ?? '').trim() === lookup;
    return matchesRouteId ? fetchedUser : null;
  }, [fetchedUser, userId]);
  const canonicalUserId = String(user?.UserID ?? '').trim();
  const isUserResultFresh = status === 'success' && Boolean(user);
  const isUserFreshnessUnconfirmed = Boolean(user && !isUserResultFresh);
  const isUserLoading = (status === 'loading' || status === 'idle') && !user;
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

  const slotIndex = Number.parseInt(String(slotKey ?? ''), 10);
  const indexPlusOne = Number.isNaN(slotIndex) ? '' : String(slotIndex + 1);

  // rowNo is the canonical slot identity for kiosk procedure completion tracking.
  // Some procedure IDs can vary by source/runtime, so prefer rowNo for persistence keys.
  const rawRowNo = normalizeScheduleItemId(procedure?.rowNo) || indexPlusOne;
  const scheduleItemId = rawRowNo ? `procedure-${rawRowNo}` : normalizeScheduleItemId(procedure?.id || slotKey);
  const historyScheduleItemIds = React.useMemo(() => {
    const indexValue = Number.parseInt(String(slotKey ?? ''), 10);
    const idxPlusOne = Number.isNaN(indexValue) ? '' : normalizeScheduleItemId(indexValue + 1);
    return [
      normalizeScheduleItemId(procedure?.rowNo),
      normalizeScheduleItemId(procedure?.id),
      idxPlusOne,
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
    () => (isUserResultFresh && !isUserLoading && canonicalUserId ? buildExecutionUserIdCandidates(canonicalUserId) : []),
    [canonicalUserId, isUserLoading, isUserResultFresh],
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
  const resolvedUserId = isUserLoading || !isUserResultFresh || !canonicalUserId ? '' : canonicalUserId;
  const { record: fetchedRecord, saveRecord, deleteRecord, isLoading, error: recordLoadError, refresh: refreshRecord } = useExecutionRecord(
    selectedDateIso,
    resolvedUserId,
    scheduleItemId,
    fallbackScheduleItemIds,
    fallbackUserIds,
  );
  const recordScheduleItemCandidates = React.useMemo(
    () => new Set([scheduleItemId, ...fallbackScheduleItemIds].map(normalizeScheduleItemId).filter(Boolean)),
    [fallbackScheduleItemIds, scheduleItemId],
  );
  const recordUserIdCandidates = React.useMemo(
    () => new Set([resolvedUserId, ...fallbackUserIds].map((candidate) => candidate.trim()).filter(Boolean)),
    [fallbackUserIds, resolvedUserId],
  );
  const record = fetchedRecord
    && fetchedRecord.date === selectedDateIso
    && recordUserIdCandidates.has(String(fetchedRecord.userId ?? '').trim())
    && recordScheduleItemCandidates.has(normalizeScheduleItemId(fetchedRecord.scheduleItemId))
    ? fetchedRecord
    : undefined;
  const hasMismatchedRecord = Boolean(fetchedRecord && !record);
  const hasCurrentFetchedRecord = Boolean(fetchedRecord && record && !hasMismatchedRecord);
  const recordQueryKey = JSON.stringify([selectedDateIso, resolvedUserId, scheduleItemId]);
  const [recordQueryState, setRecordQueryState] = React.useState(() => ({
    key: recordQueryKey,
    observedLoading: isLoading,
    ready: !isLoading,
  }));
  if (recordQueryState.key !== recordQueryKey) {
    setRecordQueryState({
      key: recordQueryKey,
      observedLoading: isLoading,
      ready: !isLoading && hasCurrentFetchedRecord,
    });
  }
  const isRecordQueryReady = recordQueryState.key === recordQueryKey && recordQueryState.ready;
  React.useEffect(() => {
    if (recordQueryState.key !== recordQueryKey) return;
    setRecordQueryState((current) => {
      if (current.key !== recordQueryKey) return current;
      if (isLoading) {
        return current.observedLoading && !current.ready
          ? current
          : { key: recordQueryKey, observedLoading: true, ready: false };
      }
      if (current.observedLoading && !current.ready) {
        return { ...current, ready: true };
      }
      if (hasCurrentFetchedRecord && !current.ready) {
        return { ...current, ready: true };
      }
      return current;
    });
  }, [hasCurrentFetchedRecord, isLoading, recordQueryKey, recordQueryState.key, recordQueryState.observedLoading, recordQueryState.ready]);
  
  const { isAbsent } = useKioskAttendance(
    resolvedUserId,
    selectedDateIso,
    isUserResultFresh ? historyUserIds : [],
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

  // Keep the main-branch transition guard, but key the form to the matched
  // cached identity so a freshness-only change does not erase the user's draft.
  const formIdentityKey = JSON.stringify([
    selectedDateIso,
    canonicalUserId,
    scheduleItemId,
    String(slotKey ?? ''),
    String(userId ?? '').trim(),
  ]);
  const formIdentityKeyRef = React.useRef(formIdentityKey);
  const isFormIdentityTransitioning = formIdentityKeyRef.current !== formIdentityKey;

  // Keep editable content scoped to the exact user/procedure/date context.
  const formContextKey = formIdentityKey;
  const createEmptyFormState = (key: string) => ({
    key,
    initialized: false,
    mood: '',
    action: '',
    result: '',
    memo: '',
  });
  const [formState, setFormState] = useState(() => createEmptyFormState(formContextKey));
  React.useEffect(() => {
    if (formIdentityKeyRef.current === formIdentityKey) return;
    formIdentityKeyRef.current = formIdentityKey;
    setFormState(createEmptyFormState(formContextKey));
  }, [formContextKey, formIdentityKey]);
  if (formState.key !== formContextKey) {
    setFormState(createEmptyFormState(formContextKey));
  }
  const currentFormState = formState.key === formContextKey ? formState : createEmptyFormState(formContextKey);
  const { mood: selectedMood, action: selectedAction, result: selectedResult, memo: textMemo } = currentFormState;
  const isInitialized = currentFormState.initialized;
  const updateFormState = (updates: Partial<typeof currentFormState>) => {
    setFormState((current) => current.key === formContextKey ? { ...current, ...updates } : current);
  };
  const [showObservations] = useState(true);

  // Restore saved fields only after this exact record query succeeded.
  React.useEffect(() => {
    if (
      !isRecordQueryReady
      || isLoading
      || isUserLoading
      || !resolvedUserId
      || hasMismatchedRecord
      || recordLoadError
      || currentFormState.initialized
    ) return;

    const parsedMemo = record ? parseKioskProcedureMemo(record.memo) : null;
    setFormState((current) => {
      if (current.key !== formContextKey || current.initialized) return current;
      return {
        ...current,
        initialized: true,
        mood: parsedMemo?.mood ?? '',
        action: parsedMemo?.action ?? '',
        result: parsedMemo?.result ?? '',
        memo: parsedMemo?.memo ?? '',
      };
    });
  }, [currentFormState.initialized, formContextKey, hasMismatchedRecord, isLoading, isRecordQueryReady, isUserLoading, record, recordLoadError, resolvedUserId]);

  const isRecordStatusUnknown = Boolean(recordLoadError)
    || !resolvedUserId
    || !isUserResultFresh
    || hasMismatchedRecord
    || !isRecordQueryReady
    || !isInitialized
    || isLoading;
  const isRecordMutationBlocked = isRecordStatusUnknown || isFormIdentityTransitioning;

  const serializeMemo = () => {
    return serializeKioskProcedureMemo({
      mood: selectedMood,
      action: selectedAction,
      result: selectedResult,
      memo: textMemo,
    });
  };

  const handleSave = async () => {
    if (!userId || isUserLoading || !canonicalUserId || !resolvedUserId || isRecordMutationBlocked || isAbsent) return;
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
    if (isUserLoading || !canonicalUserId || !resolvedUserId || isRecordMutationBlocked || isAbsent) return;
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
  if (isUserLoading || isFormIdentityTransitioning || (isLoading && !isInitialized)) {
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
            disabled={!abcSlotId || isAbsent || !isUserResultFresh}
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
            disabled={!isUserResultFresh}
            sx={{ fontWeight: 'bold', borderRadius: 3 }}
          >
            履歴・傾向を見る
          </Button>
          {isCompleted && (
            <Chip label="実施済み" color="success" icon={<CheckCircleOutlineIcon />} sx={{ fontWeight: 'bold' }} />
          )}
          {isRecordStatusUnknown && (
            <Chip label="保存状態未確認" color="error" sx={{ fontWeight: 'bold' }} />
          )}
        </Stack>
      </Box>

      {isAbsent && (
        <Alert
          severity="warning"
          sx={{ mb: 4, borderRadius: 2 }}
          data-testid="kiosk-procedure-detail-absence-alert"
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            本日は欠席として処理されています。
          </Typography>
          <Typography variant="body2">
            欠席日のため、この手順の保存・取消・ABC記録はできません。欠席を解除する場合は、利用者選択画面から操作してください。
          </Typography>
        </Alert>
      )}

      {isUserFreshnessUnconfirmed && (
        <Alert
          severity={status === 'error' ? 'warning' : 'info'}
          sx={{ mb: 3 }}
          data-testid="kiosk-user-freshness-unconfirmed-alert"
        >
          {status === 'error'
            ? '利用者の最新情報を取得できませんでした。表示中の情報はキャッシュで、最新情報は未確認です。'
            : '利用者の最新情報を確認中です。表示中の情報はキャッシュです。'}
        </Alert>
      )}

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

      {isRecordStatusUnknown && (
        <Alert
          severity="error"
          action={(recordLoadError || hasMismatchedRecord) ? (
            <Button color="inherit" size="small" onClick={() => void refreshRecord()}>
              再読み込み
            </Button>
          ) : undefined}
          sx={{ mb: 4, borderRadius: 2, alignItems: 'center' }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {recordLoadError
              ? '実施記録の読み込みに失敗しました'
              : hasMismatchedRecord
                ? '実施記録を確認できません'
              : '実施記録を確認中です'}
          </Typography>
          <Typography variant="body2">
            {recordLoadError || hasMismatchedRecord
              ? '保存済みかどうかを確認できません。再読み込みするまで記録の保存・取消はできません。'
              : '保存状態が確認できるまで、記録の保存・取消はできません。'}
          </Typography>
        </Alert>
      )}

      {record && !isRecordStatusUnknown && (
        <KioskProcedureRecordSummary
          record={record}
          mode="full"
          testId="kiosk-saved-record-summary"
        />
      )}

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
                      onClick={() => updateFormState({ mood: active ? '' : chip })}
                      disabled={isRecordStatusUnknown}
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
                      onClick={() => updateFormState({ action: active ? '' : chip })}
                      disabled={isRecordStatusUnknown}
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
                      onClick={() => updateFormState({ result: active ? '' : chip })}
                      disabled={isRecordStatusUnknown}
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
                onChange={(e) => updateFormState({ memo: e.target.value })}
                disabled={isRecordStatusUnknown}
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
                  disabled={isSaving || isDeleting || isRecordMutationBlocked || isAbsent}
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
                disabled={isSaving || isDeleting || isRecordMutationBlocked || isAbsent}
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
            disabled={isDeleting || isRecordMutationBlocked}
            sx={{ borderRadius: 3, px: 3 }}
          >
            キャンセル
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={isDeleting || isSaving || isRecordStatusUnknown || isAbsent || !resolvedUserId}
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
