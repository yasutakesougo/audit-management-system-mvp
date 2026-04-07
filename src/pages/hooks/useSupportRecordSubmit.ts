/**
 * useSupportRecordSubmit — 行動記録の保存 + PDCA永続化ロジック
 *
 * TimeBasedSupportRecordPage の handleRecordSubmit, handleRetryPersist を抽出 (#766)
 */
import type { ABCRecord } from '@/domain/behavior';
import type { BehaviorRepository, ExecutionRecordRepository } from '@/features/daily';
import {
    makeIdempotencyKey,
    persistDailySubmission,
    type PersistDailyPdcaInput,
} from '@/features/ibd/analysis/pdca/persistDailyPdca';
import { auditLog } from '@/lib/debugLogger';
import { getEnv } from '@/lib/runtimeEnv';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ERROR_STORAGE_KEY = 'daily-support-submit-error';

export type UseSupportRecordSubmitArgs = {
  behaviorRepo: BehaviorRepository;
  executionStore: ExecutionRecordRepository;
  targetUserId: string;
  targetDate: string;
  totalSteps: number;
  unfilledStepsCount: number;
};

export function useSupportRecordSubmit({
  behaviorRepo,
  executionStore,
  targetUserId,
  targetDate,
  totalSteps,
  unfilledStepsCount,
}: UseSupportRecordSubmitArgs) {
  const navigate = useNavigate();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('行動記録を保存しました');
  const [submitError, setSubmitError] = useState<Error | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.sessionStorage.getItem(ERROR_STORAGE_KEY);
    return stored ? new Error(stored) : null;
  });
  const [retryPersist, setRetryPersist] = useState<PersistDailyPdcaInput | null>(null);
  const retryKeyRef = useRef<string | null>(null);

  const orgId = getEnv('VITE_FIREBASE_ORG_ID') ?? 'demo-org';
  const actorUserId = getEnv('VITE_FIREBASE_ACTOR_ID') ?? 'demo-actor';
  const actorName = getEnv('VITE_FIREBASE_ACTOR_NAME') ?? undefined;
  const clientVersion = getEnv('VITE_APP_VERSION') ?? 'dev';
  const templateId = 'daily-support.v1';

  const handleRecordSubmit = useCallback(async (payload: Omit<ABCRecord, 'id' | 'userId'>) => {
    if (!targetUserId) return;
    try {
      await behaviorRepo.add({
        ...payload,
        userId: targetUserId,
      });

      const slotKey = payload.planSlotKey;
      if (slotKey) {
        const hasBehaviorIncident = payload.behavior !== '日常記録' && payload.behavior !== '';
        const autoStatus = hasBehaviorIncident ? 'triggered' as const : 'completed' as const;
        await executionStore.upsertRecord({
          id: `${targetDate}-${targetUserId}-${slotKey}`,
          date: targetDate,
          userId: targetUserId,
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
      const completionRate = totalSteps > 0
        ? Math.max(0, (totalSteps - unfilledStepsCount) / totalSteps)
        : 0;
      const persistInput: PersistDailyPdcaInput = {
        orgId,
        templateId,
        targetDate,
        targetUserId,
        actorUserId,
        actorName,
        type: 'DAILY_SUPPORT_SUBMITTED',
        clientVersion,
        metrics: {
          completionRate,
          leadTimeMinutes: 0,
          unfilledCount: unfilledStepsCount,
        },
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
        setSnackbarMessage('保存しました。CHECKへ移動します。');
        setSnackbarOpen(true);
        const params = new URLSearchParams({ userId: targetUserId, date: targetDate });
        window.setTimeout(() => {
          navigate(`/analysis/iceberg-pdca?${params.toString()}`);
        }, 300);
      } catch (persistError) {
        const msg = String((persistError as Error | undefined)?.message ?? persistError);
        const idempotentAlreadyDone =
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('denied') ||
          msg.toLowerCase().includes('already exists');
        if (idempotentAlreadyDone) {
          setSnackbarMessage('保存済みを確認しました。CHECKへ移動します。');
          setSnackbarOpen(true);
          const params = new URLSearchParams({ userId: targetUserId, date: targetDate });
          window.setTimeout(() => {
            navigate(`/analysis/iceberg-pdca?${params.toString()}`);
          }, 300);
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
      auditLog.debug('support-record-submit', 'error_already_in_store', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [
    actorName,
    actorUserId,
    behaviorRepo,
    clientVersion,
    executionStore,
    navigate,
    orgId,
    targetDate,
    targetUserId,
    templateId,
    totalSteps,
    unfilledStepsCount,
  ]);

  const handleRetryPersist = useCallback(async () => {
    if (!retryPersist || !targetUserId) return;
    try {
      await persistDailySubmission(retryPersist);
      if (typeof window !== 'undefined' && retryKeyRef.current) {
        window.localStorage.removeItem(retryKeyRef.current);
      }
      setRetryPersist(null);
      setSubmitError(null);
      setSnackbarMessage('保存しました。CHECKへ移動します。');
      setSnackbarOpen(true);
      const params = new URLSearchParams({ userId: targetUserId, date: targetDate });
      window.setTimeout(() => {
        navigate(`/analysis/iceberg-pdca?${params.toString()}`);
      }, 300);
    } catch (persistError) {
      const msg = String((persistError as Error | undefined)?.message ?? persistError);
      setSubmitError(new Error(msg || 'Firestore保存に失敗しました。再送できます。'));
    }
  }, [navigate, retryPersist, targetDate, targetUserId]);

  const handleSnackbarClose = useCallback(() => {
    setSnackbarOpen(false);
  }, []);

  return {
    snackbarOpen,
    snackbarMessage,
    submitError,
    retryPersist,
    handleRecordSubmit,
    handleRetryPersist,
    handleSnackbarClose,
    setSubmitError,
  };
}
