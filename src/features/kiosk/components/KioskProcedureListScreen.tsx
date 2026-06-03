import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, IconButton, Chip, LinearProgress, Snackbar, Alert, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useNavigate, useParams, useLocation, Link as RouterLink } from 'react-router-dom';
import { appendKioskSearchParams } from '../utils/navigation';
import { useUser } from '@/features/users/useUsers';
import { useUsersQuery } from '@/features/users/hooks/useUsersQuery';
import { isSharePointThrottleError, isThrottleCircuitOpen, getSharePointThrottleCircuitBreakerState } from '@/lib/sp';
import { useProcedureData } from '@/features/daily/hooks/useProcedureData';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { formatDateJapanese } from '@/lib/dateFormat';
import { resolveKioskRecordDate } from '../utils/kioskDate';
import { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';
import {
  buildExecutionUserIdCandidates,
  normalizeScheduleItemId,
  extractProcedureRowKey,
} from '@/features/daily/utils/normalizeExecutionLookup';
import { useExecutionStore } from '@/features/daily/stores/executionStore';
import { matchExecutionRecordsToProcedures } from '../domain/executionRecordMatching';
import { isKioskRecordDebugEnabled } from '@/lib/debug/kioskRecordDebug';

import { getCurrentExecutionRepositoryKind } from '@/features/daily/repositories/sharepoint/executionRepositoryFactory';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { usePlanningSheetData } from '@/features/planning-sheet/hooks/usePlanningSheetData';
import { useCurrentPlanningSheet } from '@/features/planning-sheet/hooks/useCurrentPlanningSheet';
import { resolveSupportStartDateDetailed } from '@/features/planning-sheet/monitoringSchedule';
import { resolveProcedureUserQueryCandidates } from '../utils/resolveProcedureUserQuery';
import { isAuthRequiredError } from '@/lib/errors';

const buildProcedureMatchKeys = (
  procedure: { id?: unknown; rowNo?: unknown },
  index: number,
): string[] => {
  const keys = new Set<string>();
  const push = (value: string) => {
    if (value) keys.add(value);
  };

  const idKey = normalizeScheduleItemId(procedure.id);
  const rowNoKey = normalizeScheduleItemId(procedure.rowNo);
  const rowNoVal = extractProcedureRowKey(procedure.rowNo);
  const idRowVal = extractProcedureRowKey(procedure.id);
  const indexPlusOne = String(index + 1);

  push(idKey);
  push(rowNoKey);
  push(rowNoVal);
  push(idRowVal);

  // Add prefixed candidates based on rowNo or indexPlusOne
  const rowCandidates = [rowNoKey, rowNoVal, indexPlusOne].filter(Boolean);
  for (const rc of rowCandidates) {
    push(`procedure-${rc}`);
    push(`slot-${rc}`);
    push(`slot_${rc}`);
    push(`step-${rc}`);
  }

  return Array.from(keys);
};

const buildProcedureLookupKeys = (procedure: { id?: unknown; rowNo?: unknown }, index: number): string[] => {
  const keys = new Set<string>();
  const push = (value: string) => {
    if (value) keys.add(value);
  };

  const rowNoKey = normalizeScheduleItemId(procedure.rowNo);
  const idKey = normalizeScheduleItemId(procedure.id);
  const rowNoVal = extractProcedureRowKey(procedure.rowNo);
  const idRowVal = extractProcedureRowKey(procedure.id);
  const indexPlusOne = String(index + 1);

  push(rowNoVal);
  push(idRowVal);
  push(rowNoKey);
  push(idKey);

  // Add prefixed candidates for robust SharePoint lookup
  const rowCandidates = [rowNoKey, rowNoVal, indexPlusOne].filter(Boolean);
  for (const rc of rowCandidates) {
    push(`procedure-${rc}`);
    push(`slot-${rc}`);
    push(`slot_${rc}`);
    push(`step-${rc}`);
  }

  return Array.from(keys);
};

const buildRecordMatchKeys = (record: ExecutionRecord): string[] => {
  const keys = new Set<string>();
  const scheduleItemId = normalizeScheduleItemId(record.scheduleItemId);
  if (scheduleItemId) keys.add(scheduleItemId);
  const rowKey = extractProcedureRowKey(scheduleItemId);
  if (rowKey) keys.add(rowKey);
  return Array.from(keys);
};

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
  const {
    data: userByNumericId,
    status: numericUserStatus,
    error: numericUserError,
  } = useUser(numericUserLookupId);
  const {
    data: users,
    status: usersStatus,
    error: usersError,
  } = useUsersQuery({ selectMode: 'core' });
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
  const isUserAuthRequired = React.useMemo(
    () => isAuthRequiredError(numericUserError) || isAuthRequiredError(usersError),
    [numericUserError, usersError],
  );
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
    const queryId = resolveProcedureUserQueryCandidates(user, userId, queryUserIdFromSearch);
    if (!queryId) return [];
    return procedureRepo.getByUser(queryId);
  }, [queryUserIdFromSearch, userId, user, procedureRepo]);
  const allPrimaryScheduleKeys = React.useMemo(() => {
    const keys = new Set<string>();
    for (const step of procedures) {
      const idKey = normalizeScheduleItemId(step.id);
      const rowNoKey = normalizeScheduleItemId(step.rowNo);
      if (idKey) keys.add(idKey);
      if (rowNoKey) keys.add(rowNoKey);
      const idRowKey = extractProcedureRowKey(step.id);
      const rowNoRowKey = extractProcedureRowKey(step.rowNo);
      if (idRowKey) keys.add(idRowKey);
      if (rowNoRowKey) keys.add(rowNoRowKey);
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

  const queryUserId = resolveProcedureUserQueryCandidates(user, userId, queryUserIdFromSearch) || null;
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
  const executionUserIdCandidates = React.useMemo(
    () => buildExecutionUserIdCandidates(queryUserIdFromSearch, user?.UserID, userId),
    [queryUserIdFromSearch, user?.UserID, userId],
  );
  const storeRecords = React.useMemo(() => {
    const deduped = new Map<string, ExecutionRecord>();
    for (const candidateUserId of executionUserIdCandidates) {
      for (const record of getStoreRecords(selectedDateIso || '', candidateUserId)) {
        const key = `${record.date}|${record.userId}|${record.scheduleItemId}|${record.id ?? ''}`;
        deduped.set(key, record);
      }
    }
    return Array.from(deduped.values());
  }, [executionUserIdCandidates, getStoreRecords, selectedDateIso]);
  const executionRepositoryKind = getCurrentExecutionRepositoryKind();

  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [hasFetchedRecords, setHasFetchedRecords] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [showFetchError, setShowFetchError] = useState(false);
  const procedureLookupThrottleKeyRef = React.useRef('');

  const [isThrottleActive, setIsThrottleActive] = useState(() => isThrottleCircuitOpen());
  const [throttleRemaining, setThrottleRemaining] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  // Monitor circuit breaker status and remaining cooldown seconds (read-only)
  useEffect(() => {
    const checkThrottle = () => {
      const active = isThrottleCircuitOpen();
      setIsThrottleActive(active);
      if (active) {
        const state = getSharePointThrottleCircuitBreakerState();
        setThrottleRemaining(Math.max(0, Math.ceil(state.remainingMs / 1000)));
      } else {
        setThrottleRemaining(0);
      }
    };

    checkThrottle();
    const timer = setInterval(checkThrottle, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  // When breaker closes, automatically reset states and trigger a fresh fetch
  const prevThrottleActiveRef = React.useRef(isThrottleActive);
  useEffect(() => {
    if (!isThrottleActive && prevThrottleActiveRef.current) {
      setFetchFailed(false);
      setHasFetchedRecords(false);
      setShowFetchError(false);
      setRecords([]);
      setRetryCount((prev) => prev + 1);
    }
    prevThrottleActiveRef.current = isThrottleActive;
  }, [isThrottleActive]);

  // Synchronously reset records state when the active user or date changes
  // to prevent rendering stale records from the previous context.
  const currentQueryId = executionUserIdCandidates.join('|');
  const [prevQueryId, setPrevQueryId] = useState<string>('');
  const [prevDate, setPrevDate] = useState<string>('');

  if (currentQueryId !== prevQueryId || selectedDateIso !== prevDate) {
    setPrevQueryId(currentQueryId);
    setPrevDate(selectedDateIso);
    setRecords([]);
    setHasFetchedRecords(false);
    setFetchFailed(false);
    procedureLookupThrottleKeyRef.current = '';
  }

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
    if (isUserLoading) return;

    let active = true;
    const fetchRecords = async () => {
      const dateStr = selectedDateIso;
      if (!dateStr) return;
      if (isThrottleCircuitOpen()) {
        console.warn('[Kiosk] Circuit breaker is open. Aborting execution record fetch to suppress storm.');
        if (active) {
          setShowFetchError(false);
          setIsThrottleActive(true);
          setFetchFailed(true);
          setHasFetchedRecords(true);
        }
        return;
      }
      const isSharePoint = executionRepositoryKind === 'sharepoint';
      // Deduplicate user IDs that would produce the same SharePoint query candidates.
      // If not SharePoint, we keep all candidates to support local mock/Zustand stores.
      const queryUserIds = isSharePoint
        ? (() => {
            const canonicalize = (id: string) => {
              const clean = id.replace(/^u-/i, '').replace(/^u/i, '').replace(/-/g, '').trim();
              const num = parseInt(clean, 10);
              return Number.isNaN(num) ? clean.toLowerCase() : String(num);
            };
            const seen = new Set<string>();
            return executionUserIdCandidates.filter((id) => {
              const canonical = canonicalize(id);
              if (seen.has(canonical)) return false;
              seen.add(canonical);
              return true;
            });
          })()
        : executionUserIdCandidates;

      const results = await Promise.allSettled(
        queryUserIds.map((candidateUserId) =>
          executionRepo.getRecords(dateStr, candidateUserId),
        ),
      );
      const successfulBatches = results
        .filter((result): result is PromiseFulfilledResult<ExecutionRecord[]> => result.status === 'fulfilled')
        .map((result) => result.value);
      const failedResults = results.filter((result) => result.status === 'rejected');

      if (successfulBatches.length === 0) {
        const error = failedResults[0]?.reason ?? new Error('No execution record fetches completed');
        if (active) {
          console.error('Failed to fetch execution records:', error);
          if (isSharePointThrottleError(error)) {
            setShowFetchError(false);
            setIsThrottleActive(true);
          } else {
            setShowFetchError(true);
          }
          setFetchFailed(true);
          setHasFetchedRecords(true);
        }
        return;
      }

      if (failedResults.length > 0) {
        console.warn('Some execution record lookups failed:', failedResults.map((result) => result.reason));
      }

      const deduped = new Map<string, ExecutionRecord>();
      const addRecord = (record: ExecutionRecord) => {
        const key = `${record.date}|${record.userId}|${record.scheduleItemId}|${record.id ?? ''}`;
        deduped.set(key, record);
      };
      for (const record of successfulBatches.flat()) {
        addRecord(record);
      }

      const procedureLookupKey = `${dateStr}|${queryUserIds.join('|')}`;
      const shouldRunProcedureLevelLookup = executionRepositoryKind !== 'sharepoint';

      if (
        shouldRunProcedureLevelLookup &&
        procedures.length > 0 &&
        deduped.size < procedures.length &&
        typeof executionRepo.getRecord === 'function' &&
        procedureLookupThrottleKeyRef.current !== procedureLookupKey
      ) {
        const matchedKeys = new Set<string>();
        for (const record of deduped.values()) {
          for (const key of buildRecordMatchKeys(record)) {
            matchedKeys.add(key);
          }
        }

        let lookupAttempts = 0;
        let abortProcedureLookups = false;
        const maxLookupAttempts = Number.POSITIVE_INFINITY;

        for (let index = 0; index < procedures.length; index += 1) {
          if (!active) {
            abortProcedureLookups = true;
            break;
          }
          const procedureKeys = buildProcedureMatchKeys(procedures[index], index);
          if (procedureKeys.some((key) => matchedKeys.has(key))) continue;

          let foundRecord: ExecutionRecord | undefined;
          const lookupKeys = buildProcedureLookupKeys(procedures[index], index);
          for (const candidateUserId of queryUserIds) {
            for (const scheduleItemId of lookupKeys) {
              if (!active) {
                abortProcedureLookups = true;
                break;
              }
              if (lookupAttempts >= maxLookupAttempts) {
                abortProcedureLookups = true;
                break;
              }
              lookupAttempts += 1;
              try {
                const record = await executionRepo.getRecord(dateStr, candidateUserId, scheduleItemId);
                if (record) {
                  foundRecord = record;
                  break;
                }
              } catch (error) {
                if (isSharePointThrottleError(error)) {
                  console.warn('Procedure-level execution lookup stopped because SharePoint is throttling:', {
                    userId: candidateUserId,
                    scheduleItemId,
                    error,
                  });
                  procedureLookupThrottleKeyRef.current = procedureLookupKey;
                  abortProcedureLookups = true;
                  break;
                }
                console.warn('Procedure-level execution record lookup failed:', {
                  userId: candidateUserId,
                  scheduleItemId,
                  error,
                });
              }
            }
            if (foundRecord || abortProcedureLookups) break;
          }

          if (foundRecord) {
            addRecord(foundRecord);
            for (const key of buildRecordMatchKeys(foundRecord)) {
              matchedKeys.add(key);
            }
          }

          if (abortProcedureLookups) break;
        }
      }

      const data = Array.from(deduped.values());
      if (active) {
        setRecords(data);
        setHasFetchedRecords(true);
      }
    };
    void fetchRecords();

    return () => {
      active = false;
    };
  }, [
    executionUserIdCandidates,
    isUserLoading,
    executionRepo,
    selectedDateIso,
    executionRepositoryKind,
    allPrimaryScheduleKeys,
    procedures,
    user?.UserID,
    userId,
    location.key,
    location.search,
    retryCount,
  ]);

  const hasRecordInput = React.useCallback((record: ExecutionRecord | undefined): boolean => {
    if (!record) return false;
    if (record.status === 'completed' || record.status === 'triggered' || record.status === 'skipped') return true;
    const unknownRecord = record as unknown as Record<string, unknown>;
    const inputKeys = ['memo', 'note', 'specialNote', 'additionalInfo', 'situation'];
    return inputKeys.some((key) => {
      const value = unknownRecord[key];
      return typeof value === 'string' && value.trim().length > 0;
    });
  }, []);

  // 進捗サマリーの計算
  const totalCount = procedures.length;
  const recordedRecordsByProcedure = React.useMemo(() => {
    const allCandidateRecords =
      executionRepositoryKind === 'sharepoint' && hasFetchedRecords
        ? fetchFailed
          ? [...storeRecords, ...records]
          : [
              ...records,
              ...storeRecords.filter((r) => {
                if (!r.recordedAt) return false;
                try {
                  const ageMs = Date.now() - new Date(r.recordedAt).getTime();
                  return ageMs >= 0 && ageMs < 120 * 1000;
                } catch {
                  return false;
                }
              }),
            ]
        : [...storeRecords, ...records];

    const uniqueRecordsMap = new Map<string, ExecutionRecord>();
    for (const record of allCandidateRecords) {
      const key = `${record.date}|${record.userId}|${record.scheduleItemId}|${record.id ?? ''}`;
      const existing = uniqueRecordsMap.get(key);
      if (!existing || (!hasRecordInput(existing) && hasRecordInput(record))) {
        uniqueRecordsMap.set(key, record);
      }
    }
    const dedupedRecords = Array.from(uniqueRecordsMap.values());

    const matchedRecords = matchExecutionRecordsToProcedures(procedures, dedupedRecords);
    if (isKioskRecordDebugEnabled()) {
      console.debug(`[KioskProcedureList] Matching execution records:`, {
        userId,
        userCanonicalId: user?.UserID,
        candidates: executionUserIdCandidates,
        procedures: procedures.map((p) => ({ id: p.id, rowNo: p.rowNo })),
        dedupedRecords: dedupedRecords.map((r) => ({ id: r.id, userId: r.userId, scheduleItemId: r.scheduleItemId, status: r.status })),
        matchedRecords: matchedRecords.map((r) => (r ? { id: r.id, userId: r.userId, scheduleItemId: r.scheduleItemId, status: r.status } : null)),
      });
    }
    return matchedRecords.map((matchedRecord) => {
      if (matchedRecord && hasRecordInput(matchedRecord)) {
        return matchedRecord;
      }
      return undefined;
    });
  }, [executionRepositoryKind, hasFetchedRecords, fetchFailed, storeRecords, records, procedures, hasRecordInput]);
  const doneCount = recordedRecordsByProcedure.filter((r) => r?.status === 'completed').length;
  const recordedCount = recordedRecordsByProcedure.filter(Boolean).length;
  const progress = totalCount > 0 ? (recordedCount / totalCount) * 100 : 0;

  if (isUserLoading) {
    return <Box sx={{ p: 4 }}>読み込み中...</Box>;
  }

  if (!user && isUserAuthRequired) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Alert
          severity="warning"
          sx={{ mb: 3, textAlign: 'left' }}
          data-testid="kiosk-auth-required-alert"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.sessionStorage.setItem('postLoginRedirect', `${location.pathname}${location.search}`);
                }
                navigate('/login');
              }}
            >
              再ログイン
            </Button>
          }
        >
          Microsoft 365 の認証が必要です。再ログイン後にもう一度お試しください。
        </Alert>
        <IconButton onClick={() => navigate(appendKioskSearchParams('/kiosk/users', location.search))} sx={{ mt: 2 }}>
          <ArrowBackIcon /> 戻る
        </IconButton>
      </Box>
    );
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

      {/* サーキットブレーカー / エラー警告バナー */}
      {(isThrottleActive || fetchFailed) && (
        <Alert
          severity={isThrottleActive ? "warning" : "error"}
          sx={{ mb: 3, borderRadius: 2 }}
          data-testid="kiosk-throttle-alert"
          action={
            <Button
              color="inherit"
              size="small"
              disabled={isThrottleActive}
              onClick={() => {
                setFetchFailed(false);
                setHasFetchedRecords(false);
                setShowFetchError(false);
                setRecords([]);
                setRetryCount((prev) => prev + 1);
              }}
            >
              {isThrottleActive ? `再試行（${throttleRemaining}秒）` : '再試行する'}
            </Button>
          }
        >
          {isThrottleActive ? (
            <>
              SharePointが一時的に混み合っています。
              <br />
              安全のため、サーバーへの再接続を少し待っています。
              <br />
              表示できる範囲のローカル情報を表示しています。
              <br />
              しばらくしてから再試行してください。
            </>
          ) : (
            "一時的な接続エラーが発生しました。再試行ボタンを押してデータを読み込んでください。"
          )}
        </Alert>
      )}

      {/* 手順一覧 */}
      <Grid container spacing={2}>
        {procedures.map((step, index) => {
          const recordedRecord = recordedRecordsByProcedure[index];
          const isRecorded = Boolean(recordedRecord);
          const isLoadFailed = fetchFailed || isThrottleActive;

          let statusType: 'recorded' | 'unrecorded' | 'uncertain' | 'uncertain_local' = 'unrecorded';
          if (isLoadFailed) {
            statusType = isRecorded ? 'uncertain_local' : 'uncertain';
          } else {
            statusType = isRecorded ? 'recorded' : 'unrecorded';
          }

          const borderLeftColor = (() => {
            switch (statusType) {
              case 'recorded': return 'success.main';
              case 'uncertain_local': return 'warning.light';
              case 'uncertain': return 'text.disabled';
              case 'unrecorded':
              default: return 'divider';
            }
          })();

          const bgcolor = (() => {
            switch (statusType) {
              case 'recorded': return 'success.lighter';
              case 'uncertain_local': return 'warning.lighter';
              case 'uncertain': return 'action.hover';
              case 'unrecorded':
              default: return 'background.paper';
            }
          })();

          const opacity = (() => {
            switch (statusType) {
              case 'recorded': return 0.8;
              case 'uncertain_local': return 0.9;
              case 'uncertain': return 0.7;
              case 'unrecorded':
              default: return 1;
            }
          })();

          const textDecoration = statusType === 'recorded' ? 'line-through' : 'none';
          const titleColor = (() => {
            switch (statusType) {
              case 'recorded': return 'success.dark';
              case 'uncertain_local': return 'warning.dark';
              case 'uncertain': return 'text.secondary';
              case 'unrecorded':
              default: return 'text.primary';
            }
          })();

          return (
            <Grid key={index} size={12}>
              <Card
                sx={{
                  borderRadius: 3,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  borderLeft: '6px solid',
                  borderLeftColor: borderLeftColor,
                  bgcolor: bgcolor,
                  opacity: opacity,
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
                      <Typography variant="h5" sx={{
                        fontWeight: 'bold',
                        color: statusType === 'recorded'
                          ? 'success.main'
                          : statusType === 'uncertain_local'
                          ? 'warning.main'
                          : 'text.secondary'
                      }}>
                        {step.time}
                      </Typography>
                    </Grid>
                    <Grid size={7}>
                      <Typography variant="h6" sx={{
                        fontWeight: 'bold',
                        mb: 0.5,
                        color: titleColor,
                        textDecoration: textDecoration
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
                      {(() => {
                        switch (statusType) {
                          case 'recorded':
                            return (
                              <Chip
                                icon={<CheckCircleIcon />}
                                label="記録済み"
                                color="success"
                                sx={{ borderRadius: 2, fontWeight: 'bold' }}
                              />
                            );
                          case 'uncertain_local':
                            return (
                              <Chip
                                icon={<CheckCircleIcon color="warning" />}
                                label="同期状態未確認"
                                color="warning"
                                variant="outlined"
                                sx={{ borderRadius: 2, fontWeight: 'bold' }}
                                data-testid={`kiosk-uncertain-local-chip-${index}`}
                              />
                            );
                          case 'uncertain':
                            return (
                              <Chip
                                label="状態未確認"
                                variant="outlined"
                                color="default"
                                sx={{
                                  borderRadius: 2,
                                  color: 'text.secondary',
                                  borderColor: 'divider',
                                  borderStyle: 'dashed'
                                }}
                                data-testid={`kiosk-uncertain-chip-${index}`}
                              />
                            );
                          case 'unrecorded':
                          default:
                            return (
                              <Chip
                                icon={<AccessTimeIcon />}
                                label="未実施"
                                variant="outlined"
                                sx={{ borderRadius: 2, color: 'text.disabled', borderColor: 'divider' }}
                              />
                            );
                        }
                      })()}
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
