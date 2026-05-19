import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, IconButton, Chip, LinearProgress, Snackbar, Alert, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useNavigate, useParams, useLocation, Link as RouterLink } from 'react-router-dom';
import { appendKioskSearchParams } from '../utils/navigation';
import { useUser, useUsers } from '@/features/users/useUsers';
import { useProcedureData } from '@/features/daily/hooks/useProcedureData';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { formatDateJapanese } from '@/lib/dateFormat';
import { resolveKioskRecordDate } from '../utils/kioskDate';
import { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';
import { normalizeScheduleItemId } from '@/features/daily/utils/normalizeScheduleItemId';
import { useExecutionStore } from '@/features/daily/stores/executionStore';
import { getCurrentExecutionRepositoryKind } from '@/features/daily/repositories/sharepoint/executionRepositoryFactory';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { usePlanningSheetData } from '@/features/planning-sheet/hooks/usePlanningSheetData';
import { useCurrentPlanningSheet } from '@/features/planning-sheet/hooks/useCurrentPlanningSheet';
import { resolveSupportStartDateDetailed } from '@/features/planning-sheet/monitoringSchedule';

export const KioskProcedureListScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams<{ userId: string }>();
  const queryUserIdFromSearch = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get('userId') || params.get('user') || '').trim() || null;
  }, [location.search]);
  const userLookupId = queryUserIdFromSearch || userId || '';
  const numericUserLookupId = Number.isFinite(Number(userLookupId)) ? Number(userLookupId) : undefined;
  const { data: userByNumericId, status: numericUserStatus } = useUser(numericUserLookupId);
  const { data: users, status: usersStatus } = useUsers({ selectMode: 'core' });
  const userByCode = React.useMemo(() => {
    const lookup = String(userLookupId).trim();
    if (!lookup) return null;
    return users.find((candidate) => {
      const candidateUserId = String(candidate.UserID ?? '').trim();
      if (candidateUserId && candidateUserId === lookup) return true;
      return String(candidate.Id ?? '').trim() === lookup;
    }) ?? null;
  }, [userLookupId, users]);
  const user = userByNumericId ?? userByCode;
  const isUserLoading = numericUserLookupId != null
    ? (numericUserStatus === 'loading' || numericUserStatus === 'idle')
    : (usersStatus === 'loading' || usersStatus === 'idle');
  const procedureRepo = useProcedureData();
  const executionRepo = useExecutionData();
  
  const selectedDateIso = React.useMemo(() => resolveKioskRecordDate(location.search), [location.search]);
  const selectedDateStr = formatDateJapanese(selectedDateIso);
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

  const procedures = React.useMemo(() => {
    const queryId = queryUserIdFromSearch || user?.UserID || userId;
    if (!queryId) return [];
    return procedureRepo.getByUser(queryId);
  }, [queryUserIdFromSearch, userId, user?.UserID, procedureRepo]);
  const allPrimaryScheduleKeys = React.useMemo(() => {
    const keys = new Set<string>();
    for (const step of procedures) {
      const idKey = normalizeScheduleItemId(step.id);
      const rowNoKey = normalizeScheduleItemId(step.rowNo);
      if (idKey) keys.add(idKey);
      if (rowNoKey) keys.add(rowNoKey);
    }
    return keys;
  }, [procedures]);

  const targetPlanningSheetId = React.useMemo(() => {
    return procedures?.find((procedure) => procedure.planningSheetId)?.planningSheetId;
  }, [procedures]);

  const planningRepo = usePlanningSheetRepositories();

  const {
    data: planningSheet,
    isLoading: isLoadingPlanningSheet,
  } = usePlanningSheetData(targetPlanningSheetId, planningRepo);

  const queryUserId = queryUserIdFromSearch || user?.UserID || userId || null;
  const {
    currentSheet,
    isLoading: isLoadingCurrentSheet,
  } = useCurrentPlanningSheet(queryUserId, planningRepo);

  const resolvedStartDate = React.useMemo(() => {
    if (planningSheet) {
      return resolveSupportStartDateDetailed(
        planningSheet.supportStartDate,
        user?.ServiceStartDate,
        planningSheet.appliedFrom
      );
    }
    if (currentSheet) {
      return resolveSupportStartDateDetailed(
        currentSheet.supportStartDate,
        user?.ServiceStartDate,
        currentSheet.appliedFrom
      );
    }
    return resolveSupportStartDateDetailed(
      undefined,
      user?.ServiceStartDate,
      undefined
    );
  }, [planningSheet, currentSheet, user?.ServiceStartDate]);
  const supportStartDateLabel = React.useMemo(() => {
    const { date, source } = resolvedStartDate;
    const isLoading = (targetPlanningSheetId && isLoadingPlanningSheet) || isLoadingCurrentSheet;

    if (!date || source === 'none') {
      return isLoading
        ? '支援開始日: 確認中（90日参考）'
        : '支援開始日: 未設定（90日参考）';
    }

    const dateStr = formatDateJapanese(date);
    if (!dateStr) {
      return '支援開始日: 不正な日付（90日参考）';
    }

    switch (source) {
      case 'planning':
        return `支援開始日: ${dateStr}（90日参考・支援計画）`;
      case 'master':
        return `支援開始日: ${dateStr}（90日参考・利用者マスタ）`;
      case 'fallback':
        return `[暫定] 支援開始日: ${dateStr}（90日参考・計画適用日）`;
      default:
        return `支援開始日: ${dateStr}（90日参考）`;
    }
  }, [resolvedStartDate, targetPlanningSheetId, isLoadingPlanningSheet, isLoadingCurrentSheet]);


  const { getRecords: getStoreRecords } = useExecutionStore();
  const storeRecords = getStoreRecords(selectedDateIso || '', user?.UserID || userId || '');
  const executionRepositoryKind = getCurrentExecutionRepositoryKind();
  
  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [showFetchError, setShowFetchError] = useState(false);

  const buildKioskAbcRecordLink = React.useCallback((slotId: string) => {
    if (!deepLinkUserId) return '/abc-record';
    const returnParams = new URLSearchParams({ date: selectedDateIso });
    const params = new URLSearchParams({
      userId: deepLinkUserId,
      source: 'daily-support',
      date: selectedDateIso,
      slotId,
      kiosk: '1',
      returnUrl: `/kiosk/users/${encodeURIComponent(returnRouteUserId)}/procedures?${returnParams.toString()}`,
    });
    return `/abc-record?${params.toString()}`;
  }, [deepLinkUserId, returnRouteUserId, selectedDateIso]);

  // 実施記録の取得
  useEffect(() => {
    const fetchRecords = async () => {
      const queryId = queryUserIdFromSearch || user?.UserID || userId;
      if (!queryId) return;
      try {
        const data = await executionRepo.getRecords(selectedDateIso, queryId);
        setRecords(data);
      } catch (error) {
        console.error('Failed to fetch execution records:', error);
        setShowFetchError(true);
      }
    };
    void fetchRecords();
  }, [queryUserIdFromSearch, userId, user?.UserID, executionRepo, selectedDateIso, location.key, location.search]);

  const hasRecordInput = React.useCallback((record: ExecutionRecord | undefined): boolean => {
    if (!record) return false;
    if (record.status === 'completed' || record.status === 'triggered') return true;
    const unknownRecord = record as unknown as Record<string, unknown>;
    const inputKeys = ['memo', 'note', 'specialNote', 'additionalInfo', 'situation'];
    return inputKeys.some((key) => {
      const value = unknownRecord[key];
      return typeof value === 'string' && value.trim().length > 0;
    });
  }, []);

  // 進捗サマリーの計算
  const totalCount = procedures.length;
  const recordsByScheduleItemId = React.useMemo(() => {
    const map = new Map<string, ExecutionRecord>();

    // In sharepoint mode, treat repository result as source of truth to avoid
    // local-only "記録済み" labels that don't survive across devices.
    const allCandidateRecords =
      executionRepositoryKind === 'local' ? [...storeRecords, ...records] : [...records];
    
    for (const record of allCandidateRecords) {
      const key = normalizeScheduleItemId(record.scheduleItemId);
      if (!key) continue;
      
      const existing = map.get(key);
      // まだ未登録、または新しいレコードが入力済みデータを持っている場合は上書き
      if (!existing || hasRecordInput(record)) {
        map.set(key, record);
      }
    }
    return map;
  }, [executionRepositoryKind, storeRecords, records, hasRecordInput]);
  const getRecordedRecordForProcedure = React.useCallback((procedure: { id?: unknown; rowNo?: unknown }, index: number) => {
    const primaryCandidates = [
      normalizeScheduleItemId(procedure.id),
      normalizeScheduleItemId(procedure.rowNo),
    ].filter(Boolean);
    const matchedRecord = primaryCandidates
      .map((key) => recordsByScheduleItemId.get(key))
      .find((record) => hasRecordInput(record));
    if (matchedRecord) return matchedRecord;

    const indexKey = index.toString();
    const canUseIndexFallback = !allPrimaryScheduleKeys.has(indexKey) || primaryCandidates.includes(indexKey);
    if (!canUseIndexFallback) return undefined;

    const fallbackRecord = recordsByScheduleItemId.get(indexKey);
    if (hasRecordInput(fallbackRecord)) {
      return fallbackRecord;
    }
    return undefined;
  }, [allPrimaryScheduleKeys, hasRecordInput, recordsByScheduleItemId]);
  const recordedRecordsByProcedure = React.useMemo(
    () => procedures.map((procedure, index) => getRecordedRecordForProcedure(procedure, index)),
    [procedures, getRecordedRecordForProcedure]
  );
  const doneCount = recordedRecordsByProcedure.filter((r) => r?.status === 'completed').length;
  const recordedCount = recordedRecordsByProcedure.filter(Boolean).length;
  const progress = totalCount > 0 ? (recordedCount / totalCount) * 100 : 0;

  if (isUserLoading) {
    return <Box sx={{ p: 4 }}>読み込み中...</Box>;
  }

  if (!user) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5">利用者が存在しません</Typography>
        <IconButton onClick={() => navigate(appendKioskSearchParams('/kiosk/users', location.search))} sx={{ mt: 2 }}>
          <ArrowBackIcon /> 戻る
        </IconButton>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダーセクション */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            component={RouterLink}
            to={appendKioskSearchParams('/kiosk/users', location.search)}
            sx={{ mr: 2, bgcolor: 'action.hover' }}
            data-testid="kiosk-procedure-list-back"
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
              {user.FullName} 様
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 0.5 }}>
              <Typography variant="subtitle1" color="text.secondary">
                {selectedDateStr} の支援手順
              </Typography>
              <Typography variant="subtitle1" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                • {supportStartDateLabel}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* 進捗サマリー */}
        <Box sx={{ minWidth: 200, textAlign: 'right' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            実施状況: {recordedCount} / {totalCount}
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 12, borderRadius: 6, mb: 1, bgcolor: 'action.hover' }} 
          />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Chip icon={<CheckCircleIcon />} label={`${doneCount} 完了`} color="success" size="small" variant={doneCount > 0 ? "filled" : "outlined"} sx={{ fontWeight: 'bold' }} />
          </Box>
        </Box>
      </Box>

      {/* 手順一覧 */}
      <Grid container spacing={2}>
        {procedures.map((step, index) => {
          const recordedRecord = recordedRecordsByProcedure[index];
          const isRecorded = Boolean(recordedRecord);
          
          return (
            <Grid key={index} size={12}>
              <Card 
                sx={{ 
                  borderRadius: 3,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  borderLeft: '6px solid',
                  borderLeftColor: 'divider',
                  bgcolor: isRecorded ? 'success.lighter' : 'background.paper',
                  opacity: isRecorded ? 0.8 : 1,
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }
                }}
                data-testid={`kiosk-procedure-card-${index}`}
              >
                <Box
                  onClick={() => navigate(appendKioskSearchParams(`/kiosk/users/${userId}/procedures/${index}`, location.search))}
                  sx={{ p: 2.5, cursor: 'pointer' }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(appendKioskSearchParams(`/kiosk/users/${userId}/procedures/${index}`, location.search));
                    }
                  }}
                >
                  <Grid container alignItems="center" spacing={2}>
                    <Grid size={2} sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: isRecorded ? 'success.main' : 'text.secondary' }}>
                        {step.time}
                      </Typography>
                    </Grid>
                    <Grid size={7}>
                      <Typography variant="h6" sx={{ 
                        fontWeight: 'bold', 
                        mb: 0.5,
                        color: isRecorded ? 'success.dark' : 'text.primary',
                        textDecoration: isRecorded ? 'line-through' : 'none'
                      }}>
                        {step.activity}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {step.instruction}
                      </Typography>
                    </Grid>
                    <Grid size={3} sx={{ textAlign: 'right' }}>
                      <Button
                        size="small"
                        variant="text"
                        onClick={(event) => {
                          event.stopPropagation();
                          const slotId = `${step.time}|${step.activity}`;
                          navigate(buildKioskAbcRecordLink(slotId), {
                            state: {
                              draftBehavior: `${step.time} ${step.activity}の時間帯に問題行動あり`,
                              draftSlotId: slotId,
                            },
                          });
                        }}
                        sx={{ mb: 1, textTransform: 'none' }}
                      >
                        この手順でABC記録
                      </Button>
                      {isRecorded ? (
                        <Chip 
                          icon={<CheckCircleIcon />} 
                          label="記録済み" 
                          color="success"
                          sx={{ borderRadius: 2, fontWeight: 'bold' }}
                        />
                      ) : (
                        <Chip 
                          icon={<AccessTimeIcon />} 
                          label="未実施" 
                          variant="outlined" 
                          sx={{ borderRadius: 2, color: 'text.disabled', borderColor: 'divider' }}
                        />
                      )}
                    </Grid>
                  </Grid>
                </Box>
              </Card>
            </Grid>
          );
        })}
        {procedures.length === 0 && (
          <Grid size={12}>
            <Box sx={{ p: 8, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 4 }}>
              <Typography variant="h6" color="text.secondary">
                支援手順が設定されていません
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>

      <Snackbar
        open={showFetchError}
        autoHideDuration={4000}
        onClose={() => setShowFetchError(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" sx={{ width: '100%' }}>
          記録の取得に失敗しました。再読み込みしてください。
        </Alert>
      </Snackbar>
    </Box>
  );
};
