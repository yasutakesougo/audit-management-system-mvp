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
import { useUserAuthz } from '@/auth/useUserAuthz';
import { canAccess } from '@/auth/roles';

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
  const { role } = useUserAuthz();
  const isSimpleMode = role === 'viewer' || (!canAccess(role, 'reception') && !canAccess(role, 'admin'));

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('記録が完了しました');
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

        // Feedback Logic
        if (isSimpleMode) {
          if (unfilledStepsCount === 0) {
            setSnackbarMessage('本日の入力はすべて完了しています。お疲れ様でした。');
          } else {
            setSnackbarMessage('記録を保存しました。本日の内容は反映されています。');
          }
        } else {
          setSnackbarMessage('保存しました。CHECKへ移動します。');
        }

        setSnackbarOpen(true);
        const params = new URLSearchParams({ userId: targetUserId, date: targetDate });
        window.setTimeout(() => {
          if (isSimpleMode) {
            navigate('/today');
          } else {
            navigate(`/analysis/iceberg-pdca?${params.toString()}`);
          }
        }, 300);
      } catch (persistError) {
        const msg = String((persistError as Error | undefined)?.message ?? persistError);
        const idempotentAlreadyDone =
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('denied') ||
          msg.toLowerCase().includes('already exists');
        if (idempotentAlreadyDone) {
          setSnackbarMessage('保存済みを確認しました。');
          setSnackbarOpen(true);
          window.setTimeout(() => {
            if (isSimpleMode) {
              navigate('/today');
            } else {
              const params = new URLSearchParams({ userId: targetUserId, date: targetDate });
              navigate(`/analysis/iceberg-pdca?${params.toString()}`);
            }
          }, 300);
          return;
        }
        if (typeof window !== 'undefined' && retryKeyRef.current) {
          window.localStorage.setItem(retryKeyRef.current, JSON.stringify(persistInput));
        }
        setRetryPersist(persistInput);
        setSubmitError(new Error('サーバーへの保存に失敗しました。再試行できます。'));
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
    isSimpleMode,
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
      setSnackbarMessage('保存しました。');
      setSnackbarOpen(true);
      window.setTimeout(() => {
        if (isSimpleMode) {
          navigate('/today');
        } else {
          const params = new URLSearchParams({ userId: targetUserId, date: targetDate });
          navigate(`/analysis/iceberg-pdca?${params.toString()}`);
        }
      }, 300);
    } catch (persistError) {
      const msg = String((persistError as Error | undefined)?.message ?? persistError);
      setSubmitError(new Error(msg || 'サーバーへの保存に失敗しました。再試行できます。'));
    }
  }, [navigate, retryPersist, isSimpleMode, targetUserId, targetDate]);

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
