import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardActionArea, IconButton, Chip, LinearProgress, Snackbar, Alert } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useNavigate, useParams, useLocation, Link as RouterLink } from 'react-router-dom';
import { appendKioskSearchParams } from '../utils/navigation';
import { useUser } from '@/features/users/useUsers';
import { useProcedureData } from '@/features/daily/hooks/useProcedureData';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { formatDateJapanese } from '@/lib/dateFormat';
import { resolveKioskRecordDate } from '../utils/kioskDate';
import { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';
import { normalizeScheduleItemId } from '@/features/daily/utils/normalizeScheduleItemId';
import { useExecutionStore } from '@/features/daily/stores/executionStore';
import { getCurrentExecutionRepositoryKind } from '@/features/daily/repositories/sharepoint/executionRepositoryFactory';

export const KioskProcedureListScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams<{ userId: string }>();
  const { data: user, status } = useUser(userId || '');
  const isUserLoading = status === 'loading' || status === 'idle';
  const procedureRepo = useProcedureData();
  const executionRepo = useExecutionData();
  
  const selectedDateIso = React.useMemo(() => resolveKioskRecordDate(location.search), [location.search]);
  const selectedDateStr = formatDateJapanese(selectedDateIso);

  const procedures = React.useMemo(() => {
    if (!userId) return [];
    return procedureRepo.getByUser(userId);
  }, [userId, procedureRepo]);
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

  const { getRecords: getStoreRecords } = useExecutionStore();
  const storeRecords = getStoreRecords(selectedDateIso || '', userId || '');
  const executionRepositoryKind = getCurrentExecutionRepositoryKind();
  
  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [showFetchError, setShowFetchError] = useState(false);

  // 実施記録の取得
  useEffect(() => {
    const fetchRecords = async () => {
      if (!userId) return;
      try {
        const data = await executionRepo.getRecords(selectedDateIso, userId);
        setRecords(data);
      } catch (error) {
        console.error('Failed to fetch execution records:', error);
        setShowFetchError(true);
      }
    };
    void fetchRecords();
  }, [userId, executionRepo, selectedDateIso, location.key, location.search]);

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
            <Typography variant="subtitle1" color="text.secondary">
              {selectedDateStr} の支援手順
            </Typography>
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
                  borderLeftColor: step.isKey ? 'primary.main' : 'divider',
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
                <CardActionArea 
                  onClick={() => navigate(appendKioskSearchParams(`/kiosk/users/${userId}/procedures/${index}`, location.search))}
                  sx={{ p: 2.5 }}
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
                </CardActionArea>
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
