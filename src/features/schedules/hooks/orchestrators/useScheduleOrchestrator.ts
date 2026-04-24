import { useCallback } from 'react';
import type { CreateScheduleInput, ScheduleRepository } from '../../domain/ScheduleRepository';
import { recordAudit, recordResolution, OrchestratorFailureKind } from '@/lib/telemetry/auditLogger';
import { auditRepository } from '@/features/telemetry/repositories/FirestoreAuditRepository';

export interface ScheduleOrchestratorDeps {
  repository: ScheduleRepository;
  onSuccess?: () => void;
  showSnack: (severity: 'success' | 'error' | 'info', message: string) => void;
}

/**
 * useScheduleOrchestrator
 * 
 * スケジュールの作成・移動・削除などの業務アクションを調整する Orchestrator。
 */
export function useScheduleOrchestrator(deps: ScheduleOrchestratorDeps) {
  const { repository, onSuccess, showSnack } = deps;

  /**
   * スケジュールの新規作成
   */
  const handleCreateSchedule = useCallback(async (input: CreateScheduleInput) => {
    const startTime = performance.now();
    try {
      const created = await repository.create(input);
      
      const auditEntry = recordAudit({
        action: 'CREATE_SCHEDULE',
        targetId: (created as { id: string | number }).id,
        status: 'SUCCESS',
        durationMs: performance.now() - startTime,
        metadata: { userId: input.userId }
      });
      await auditRepository.save(auditEntry);

      showSnack('success', 'スケジュールを作成しました');
      onSuccess?.();
      return created;
    } catch (e) {
      const durationMs = performance.now() - startTime;
      const message = e instanceof Error ? e.message : '作成に失敗しました';
      
      const auditEntry = recordAudit({
        action: 'CREATE_SCHEDULE',
        targetId: 'NEW',
        status: 'FAILURE',
        durationMs,
        error: { 
          kind: message.includes('conflict') ? OrchestratorFailureKind.CONFLICT : OrchestratorFailureKind.UNKNOWN,
          message 
        }
      });
      await auditRepository.save(auditEntry);

      showSnack('error', `作成に失敗しました: ${message}`);
      throw e;
    }
  }, [repository, onSuccess, showSnack]);

  /**
   * スケジュールの移動 (ドラッグ&ドロップ等)
   */
  const handleMoveSchedule = useCallback(async (id: string, newDate: string) => {
    const startTime = performance.now();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (repository as any).update({ id, startLocal: newDate });
      
      const auditEntry = recordAudit({
        action: 'MOVE_SCHEDULE',
        targetId: id,
        status: 'SUCCESS',
        durationMs: performance.now() - startTime,
        metadata: { newDate }
      });
      await auditRepository.save(auditEntry);

      showSnack('success', 'スケジュールを移動しました');
      onSuccess?.();
    } catch (e) {
      const durationMs = performance.now() - startTime;
      const message = e instanceof Error ? e.message : '移動に失敗しました';
      
      const auditEntry = recordAudit({
        action: 'MOVE_SCHEDULE',
        targetId: id,
        status: 'FAILURE',
        durationMs,
        error: { 
          kind: message.includes('409') ? OrchestratorFailureKind.CONFLICT : OrchestratorFailureKind.UNKNOWN,
          message 
        }
      });
      await auditRepository.save(auditEntry);

      showSnack('error', `移動に失敗しました: ${message}`);
    }
  }, [repository, onSuccess, showSnack]);

  /**
   * スケジュールの削除
   */
  const handleDeleteSchedule = useCallback(async (id: string | number) => {
    const startTime = performance.now();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (repository as any).remove(id);
      
      const auditEntry = recordAudit({
        action: 'DELETE_SCHEDULE',
        targetId: id,
        status: 'SUCCESS',
        durationMs: performance.now() - startTime
      });
      await auditRepository.save(auditEntry);

      showSnack('success', 'スケジュールを削除しました');
      onSuccess?.();
    } catch (e) {
      const durationMs = performance.now() - startTime;
      const message = e instanceof Error ? e.message : '削除に失敗しました';
      
      const auditEntry = recordAudit({
        action: 'DELETE_SCHEDULE',
        targetId: id,
        status: 'FAILURE',
        durationMs,
        error: { kind: OrchestratorFailureKind.UNKNOWN, message }
      });
      await auditRepository.save(auditEntry);

      showSnack('error', `削除に失敗しました: ${message}`);
    }
  }, [repository, onSuccess, showSnack]);

  /**
   * 失敗したアクションを解決済みにする (管理者用)
   */
  const handleResolveFailure = useCallback(async (auditId: string, resolvedBy: string, note: string) => {
    const entry = recordResolution({ auditId, resolvedBy, note });
    if (entry) {
      if (entry.firestoreId) {
        await auditRepository.resolve({
          firestoreId: entry.firestoreId,
          governanceStatus: entry.governanceStatus!,
          resolution: entry.resolution!
        });
      }
      showSnack('success', '対応を記録しました');
      return true;
    } else {
      showSnack('error', '対応の記録に失敗しました（ログが見つかりません）');
      return false;
    }
  }, [showSnack]);

  return {
    handleCreateSchedule,
    handleMoveSchedule,
    handleDeleteSchedule,
    handleResolveFailure,
  };
}
