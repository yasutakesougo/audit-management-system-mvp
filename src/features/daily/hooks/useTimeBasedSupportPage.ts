/**
 * useTimeBasedSupportPage — Extended container hook.
 *
 * Absorbs all page-level state that was NOT already in useTimeBasedSupportRecordPage:
 * - URL param sync (search params, route suppression)
 * - Submit / retry / error handling
 * - IBD summary data
 * - Copy report, procedure save, editor open/close
 * - Snackbar state
 * - User filter
 */
import { useInterventionStore } from '@/features/analysis/stores/interventionStore';
import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import type { ABCRecord } from '@/domain/behavior';
import { recordAbcSyncFailure } from '@/features/daily/domain/abcSyncPolicy';
import { generateDailyReport } from '@/features/daily/domain/generateDailyReport';
import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';
import { toBipOptions } from '@/features/daily/domain/toBipOptions';
import { useBehaviorData } from '@/features/daily/hooks/useBehaviorData';
import { useDailySupportUserFilter } from '@/features/daily/hooks/useDailySupportUserFilter';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { useProcedureData } from '@/features/daily/hooks/useProcedureData';
import type { ProcedureItem } from '@/features/daily/stores/procedureStore';
import {
    makeIdempotencyKey,
    persistDailySubmission,
    type PersistDailyPdcaInput,
} from '@/features/ibd/analysis/pdca/persistDailyPdca';
import {
  addABCRecord,
  getABCRecordsForUser,
  getLatestSPS,
  getSupervisionCounter,
} from '@/features/ibd/core/ibdStore';
import { useUsers } from '@/features/users/useUsers';
import { getEnv } from '@/lib/runtimeEnv';
import { useTimeBasedSupportRecordPage } from '@/pages/hooks/useTimeBasedSupportRecordPage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toLocalDateISO } from '@/utils/getNow';

const ERROR_STORAGE_KEY = 'daily-support-submit-error';

export function useTimeBasedSupportPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  // ── Initial params (stable across renders) ─────────────────────────────
  const initialSearchParams = useRef(new URLSearchParams(location.search)).current;
  const initialDateParam = initialSearchParams.get('date');
  const initialRecordDate =
    initialDateParam && /^\d{4}-\d{2}-\d{2}$/.test(initialDateParam)
      ? new Date(`${initialDateParam}T00:00:00`)
      : new Date();
  const initialParams = useRef({
    userId: initialSearchParams.get('userId') ?? initialSearchParams.get('user') ?? undefined,
    stepKey: initialSearchParams.get('step') ?? undefined,
    unfilledOnly: initialSearchParams.get('unfilled') === '1',
  }).current;

  // ── Core UI state ──────────────────────────────────────────────────────
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('行動記録を保存しました');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [recentRecordsOpen, setRecentRecordsOpen] = useState(false);
  const [submitError, setSubmitError] = useState<Error | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.sessionStorage.getItem(ERROR_STORAGE_KEY);
    return stored ? new Error(stored) : null;
  });
  const recordDate = useMemo(() => initialRecordDate, [initialRecordDate]);
  const targetDate = useMemo(() => recordDate.toISOString().slice(0, 10), [recordDate]);
  const recordPanelRef = useRef<HTMLDivElement>(null);
  const [retryPersist, setRetryPersist] = useState<PersistDailyPdcaInput | null>(null);
  const retryKeyRef = useRef<string | null>(null);

  // ── Repositories \u0026 stores ─────────────────────────────────────────────────
  const procedureRepo = useProcedureData();
  const { repo: behaviorRepo, data: behaviorRecords, error: behaviorError, clearError } =
    useBehaviorData();
  const { data: users } = useUsers();
  const { filter, updateFilter, resetFilter, filteredUsers, hasActiveFilter } =
    useDailySupportUserFilter(users);
  const interventionStore = useInterventionStore();
  const executionStore = useExecutionData();

  // ── Core hook (schedule, step navigation, etc.) ─────────────────────────
  const core = useTimeBasedSupportRecordPage({
    procedureRepo,
    behaviorRepo,
    behaviorRecords,
    initialUserId: initialParams.userId,
    initialStepKey: initialParams.stepKey,
    initialUnfilledOnly: initialParams.unfilledOnly,
  });

  // ── Derived data ───────────────────────────────────────────────────────
  const userInterventionPlans = useMemo(
    () => (core.targetUserId ? interventionStore.getByUserId(core.targetUserId) : []),
    [interventionStore, core.targetUserId],
  );
  const bipOptions = useMemo(() => toBipOptions(userInterventionPlans), [userInterventionPlans]);

  const rawError = submitError ?? behaviorError;
  const displayedError = useMemo(() => {
    if (!rawError) return null;
    if (String(rawError).includes('DailyActivityRecords')) return null;
    return rawError;
  }, [rawError]);

  const selectedUser = useMemo(
    () => users.find((u) => u.UserID === core.targetUserId),
    [users, core.targetUserId],
  );

  const savedObservationsMap = useMemo(() => {
    const map = new Map<string, string>();
    core.recentObservations.forEach((obs) => {
      const key = obs.planSlotKey ?? '';
      if (key && obs.actualObservation) {
        map.set(key, obs.actualObservation.slice(0, 60) + (obs.actualObservation.length > 60 ? '…' : ''));
      }
    });
    return map;
  }, [core.recentObservations]);

  // ── Env constants ──────────────────────────────────────────────────────
  const orgId = getEnv('VITE_FIREBASE_ORG_ID') ?? 'demo-org';
  const actorUserId = getEnv('VITE_FIREBASE_ACTOR_ID') ?? 'demo-actor';
  const actorName = getEnv('VITE_FIREBASE_ACTOR_NAME') ?? undefined;
  const clientVersion = getEnv('VITE_APP_VERSION') ?? 'dev';
  const templateId = 'daily-support.v1';
  const previousSearchRef = useRef(location.search);

  // ── URL sync effects ───────────────────────────────────────────────────
  useEffect(() => {
    if (!initialParams.userId) return;
    if (core.targetUserId) return;
    core.handleUserChange(initialParams.userId);
  }, [core, initialParams.userId]);

  useEffect(() => {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      if (core.targetUserId) {
        nextParams.set('user', core.targetUserId);
        nextParams.set('userId', core.targetUserId);
      } else {
        nextParams.delete('user');
        nextParams.delete('userId');
      }
      const prevStep = prev.get('step') ?? undefined;
      const resolvedStep = core.selectedStepId ?? prevStep ?? initialParams.stepKey;
      if (resolvedStep) {
        nextParams.set('step', resolvedStep);
      } else {
        nextParams.delete('step');
      }
      if (core.showUnfilledOnly) {
        nextParams.set('unfilled', '1');
      } else {
        nextParams.delete('unfilled');
      }
      if (nextParams.toString() === prev.toString()) return prev;
      return nextParams;
    }, { replace: true });
  }, [initialParams.stepKey, core.selectedStepId, setSearchParams, core.showUnfilledOnly, core.targetUserId]);

  useEffect(() => {
    const prevSearch = previousSearchRef.current;
    const nextSearch = location.search;
    if (prevSearch === nextSearch) return;
    if (location.pathname !== '/daily/support') {
      previousSearchRef.current = nextSearch;
      return;
    }
    const prevParams = new URLSearchParams(prevSearch);
    const nextParams = new URLSearchParams(nextSearch);
    const allKeys = new Set<string>([...prevParams.keys(), ...nextParams.keys()]);
    const allowedKeys = new Set(['step', 'user', 'userId', 'date']);
    const onlyAllowedChanged = [...allKeys].every((key) => {
      if (!allowedKeys.has(key)) return prevParams.get(key) === nextParams.get(key);
      return true;
    });
    if (onlyAllowedChanged && typeof window !== 'undefined') {
      const scope = window as typeof window & { __suppressRouteReset__?: boolean };
      scope.__suppressRouteReset__ = true;
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(() => { scope.__suppressRouteReset__ = false; });
      } else {
        window.setTimeout(() => { scope.__suppressRouteReset__ = false; }, 0);
      }
    }
    previousSearchRef.current = nextSearch;
  }, [location.pathname, location.search]);

  // ── Dev: duplicate schedule key warning ─────────────────────────────────
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!core.schedule.length) return;
    const seen = new Set<string>();
    const dups: string[] = [];
    core.schedule.forEach((item) => {
      const key = getScheduleKey(item.time, item.activity);
      if (seen.has(key)) dups.push(key);
      else seen.add(key);
    });
    if (dups.length) {
      console.warn('[daily/support] Duplicate scheduleKey detected:', dups);
    }
  }, [core.schedule]);

  // ── Submit handler ─────────────────────────────────────────────────────
  const handleRecordSubmit = useCallback(
    async (payload: Omit<ABCRecord, 'id' | 'userId'>) => {
      if (!core.targetUserId) return;
      try {
        const savedRecord = await behaviorRepo.add({ ...payload, userId: core.targetUserId });
        let abcSyncWarning = false;
        try {
          // B（BehaviorObservationRepository）を正本導線として同期
          addABCRecord(savedRecord);
        } catch (syncError) {
          abcSyncWarning = true;
          recordAbcSyncFailure(savedRecord, syncError);
          console.warn('[daily/support] A→B ABC sync failed; submit kept as success', syncError);
        }

        const slotKey = payload.planSlotKey;
        if (slotKey) {
          const hasBehaviorIncident = payload.behavior !== '日常記録' && payload.behavior !== '';
          const autoStatus = hasBehaviorIncident ? ('triggered' as const) : ('completed' as const);
          await executionStore.upsertRecord({
            id: `${targetDate}-${core.targetUserId}-${slotKey}`,
            date: targetDate,
            userId: core.targetUserId,
            scheduleItemId: slotKey,
            status: autoStatus,
            triggeredBipIds: [],
            memo: hasBehaviorIncident ? `行動: ${payload.behavior}` : '',
            recordedBy: '',
            recordedAt: new Date().toISOString(),
          });

        }

        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(ERROR_STORAGE_KEY);
        }
        setSubmitError(null);

        const completionRate =
          core.totalSteps > 0
            ? Math.max(0, (core.totalSteps - core.unfilledStepsCount) / core.totalSteps)
            : 0;
        const persistInput: PersistDailyPdcaInput = {
          orgId,
          templateId,
          targetDate,
          targetUserId: core.targetUserId,
          actorUserId,
          actorName,
          type: 'DAILY_SUPPORT_SUBMITTED',
          clientVersion,
          metrics: { completionRate, leadTimeMinutes: 0, unfilledCount: core.unfilledStepsCount },
          submittedAt: new Date(),
          sourceRoute: '/daily/support',
          ref: 'auto:after-submit',
        };
        const idempotencyKey = makeIdempotencyKey(persistInput);
        retryKeyRef.current = `pdca.retry:${orgId}:${idempotencyKey}`;

        try {
          await persistDailySubmission(persistInput);
          if (typeof window !== 'undefined' && retryKeyRef.current) {
            window.localStorage.removeItem(retryKeyRef.current);
          }
          setRetryPersist(null);
          setSnackbarMessage(
            abcSyncWarning
              ? '保存しました（ABC証跡同期で警告あり）。CHECKへ移動します。'
              : '保存しました。CHECKへ移動します。',
          );
          setSnackbarOpen(true);
          const params = new URLSearchParams({ userId: core.targetUserId, date: targetDate });
          window.setTimeout(() => navigate(`/analysis/iceberg-pdca?${params.toString()}`), 300);
        } catch (persistError) {
          const msg = String((persistError as Error | undefined)?.message ?? persistError);
          const alreadyDone =
            msg.toLowerCase().includes('permission') ||
            msg.toLowerCase().includes('denied') ||
            msg.toLowerCase().includes('already exists');
          if (alreadyDone) {
            setSnackbarMessage('保存済みを確認しました。CHECKへ移動します。');
            setSnackbarOpen(true);
            const params = new URLSearchParams({ userId: core.targetUserId, date: targetDate });
            window.setTimeout(() => navigate(`/analysis/iceberg-pdca?${params.toString()}`), 300);
            return;
          }
          if (typeof window !== 'undefined' && retryKeyRef.current) {
            window.localStorage.setItem(retryKeyRef.current, JSON.stringify(persistInput));
          }
          setRetryPersist(persistInput);
          setSubmitError(new Error('Firestore保存に失敗しました。再送できます。'));
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to add behavior');
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(ERROR_STORAGE_KEY, error.message);
        }
        setSubmitError(error);
        console.debug('[handleRecordSubmit] error already in store:', err);
      }
    },
    [actorName, actorUserId, behaviorRepo, clientVersion, core, executionStore, navigate, orgId, targetDate, templateId],
  );

  const handleRetryPersist = useCallback(async () => {
    if (!retryPersist || !core.targetUserId) return;
    try {
      await persistDailySubmission(retryPersist);
      if (typeof window !== 'undefined' && retryKeyRef.current) {
        window.localStorage.removeItem(retryKeyRef.current);
      }
      setRetryPersist(null);
      setSubmitError(null);
      setSnackbarMessage('保存しました。CHECKへ移動します。');
      setSnackbarOpen(true);
      const params = new URLSearchParams({ userId: core.targetUserId, date: targetDate });
      window.setTimeout(() => navigate(`/analysis/iceberg-pdca?${params.toString()}`), 300);
    } catch (persistError) {
      const msg = String((persistError as Error | undefined)?.message ?? persistError);
      setSubmitError(new Error(msg || 'Firestore保存に失敗しました。再送できます。'));
    }
  }, [core.targetUserId, navigate, retryPersist, targetDate]);

  // ── Simple callbacks ───────────────────────────────────────────────────
  const handleErrorClose = useCallback(() => {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(ERROR_STORAGE_KEY);
    clearError();
    setSubmitError(null);
  }, [clearError]);

  const handleSnackbarClose = useCallback(() => setSnackbarOpen(false), []);

  type StepLike = string | ScheduleItem | { scheduleKey?: string; time?: string; activity?: string };
  const normalizeStepKey = (value: StepLike, fallback?: string) => {
    if (typeof value === 'string') return value;
    if ('scheduleKey' in value && value.scheduleKey) return value.scheduleKey;
    if ('time' in value && 'activity' in value && value.time && value.activity) {
      return getScheduleKey(value.time, value.activity);
    }
    return fallback ?? '';
  };

  const handleSelectStepAndScroll = useCallback(
    (step: StepLike, stepId?: string) => {
      const resolvedStepId = normalizeStepKey(step, stepId);
      if (!resolvedStepId) return;
      flushSync(() => {
        core.handleSelectStep(resolvedStepId);
        core.setIsAcknowledged(true);
      });
      if (typeof window === 'undefined') return;
      window.requestAnimationFrame(() => {
        const node = recordPanelRef.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
        if (inView) return;
        node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    },
    [core],
  );

  const handleProcedureSave = useCallback(
    (items: ProcedureItem[]) => {
      if (!core.targetUserId) return;
      procedureRepo.save(core.targetUserId, items);
    },
    [core.targetUserId, procedureRepo],
  );

  const handleEditorOpen = useCallback(() => setIsEditOpen(true), []);
  const handleEditorClose = useCallback(() => setIsEditOpen(false), []);
  const handleAcknowledged = useCallback(() => core.setIsAcknowledged(true), [core]);
  const handleToggleUnfilledOnly = useCallback(() => core.setShowUnfilledOnly((p) => !p), [core]);

  const handleSlotChange = useCallback(
    (next: string) => core.setSelectedStepId(next || null),
    [core],
  );

  const handleCopyReport = useCallback(async () => {
    if (!core.targetUserId || !selectedUser) return;
    const records = await executionStore.getRecords(targetDate, core.targetUserId);
    const report = generateDailyReport({
      date: targetDate,
      userName: selectedUser.FullName,
      schedule: core.schedule,
      records,

      observations: (() => {
        const m = new Map<string, string>();
        core.recentObservations.forEach((o) => {
          if (o.planSlotKey && o.actualObservation) m.set(o.planSlotKey, o.actualObservation);
        });
        return m;
      })(),
    });
    try {
      await navigator.clipboard.writeText(report);
      setSnackbarMessage('📋 日報をクリップボードにコピーしました！');
      setSnackbarOpen(true);
    } catch {
      setSnackbarMessage('クリップボードへのコピーに失敗しました');
      setSnackbarOpen(true);
    }
  }, [core, executionStore, selectedUser, targetDate]);

  // ── IBD summary data ───────────────────────────────────────────────────
  const numericUserId = core.targetUserId ? Number(core.targetUserId.replace(/\D/g, '')) || 0 : 0;
  const latestSPS = useMemo(() => (numericUserId ? getLatestSPS(numericUserId) : undefined), [numericUserId]);
  const supervisionCounter = useMemo(
    () => (numericUserId ? getSupervisionCounter(numericUserId) : undefined),
    [numericUserId],
  );
  const todayAbcCount = useMemo(() => {
    if (!core.targetUserId) return 0;
    const records = getABCRecordsForUser(core.targetUserId);
    const todayStr = toLocalDateISO();
    return records.filter((r) => r.recordedAt?.slice(0, 10) === todayStr).length;
  }, [core.targetUserId]);

  return {
    // Core hook pass-through
    core,

    // Users & filter
    users,
    selectedUser,
    filteredUsers,
    filter,
    updateFilter,
    resetFilter,
    hasActiveFilter,

    // Dates
    recordDate,
    targetDate,

    // Refs
    recordPanelRef,

    // Schedule data
    bipOptions,
    userInterventionPlans,
    savedObservationsMap,

    // UI state
    isEditOpen,
    recentRecordsOpen,
    setRecentRecordsOpen,
    snackbarOpen,
    snackbarMessage,
    displayedError,
    retryPersist,

    // IBD summary
    latestSPS,
    supervisionCounter,
    todayAbcCount,

    // Actions
    handleRecordSubmit,
    handleRetryPersist,
    handleErrorClose,
    handleSnackbarClose,
    handleSelectStepAndScroll,
    handleProcedureSave,
    handleEditorOpen,
    handleEditorClose,
    handleAcknowledged,
    handleToggleUnfilledOnly,
    handleCopyReport,
    handleSlotChange,
  } as const;
}
