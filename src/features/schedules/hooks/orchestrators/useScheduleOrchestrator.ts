import { useCallback } from 'react';
import type { CreateScheduleInput, ScheduleRepository } from '../../domain/ScheduleRepository';
import { recordAudit, OrchestratorFailureKind } from '@/lib/telemetry/auditLogger';

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
      
      recordAudit({
        action: 'CREATE_SCHEDULE',
        targetId: (created as any).id,
        status: 'SUCCESS',
        durationMs: performance.now() - startTime,
        metadata: { userId: input.userId }
      });

      showSnack('success', 'スケジュールを作成しました');
      onSuccess?.();
      return created;
    } catch (e) {
      const durationMs = performance.now() - startTime;
      const message = e instanceof Error ? e.message : '作成に失敗しました';
      
      recordAudit({
        action: 'CREATE_SCHEDULE',
        targetId: 'NEW',
        status: 'FAILURE',
        durationMs,
        error: { 
          kind: message.includes('conflict') ? OrchestratorFailureKind.CONFLICT : OrchestratorFailureKind.UNKNOWN,
          message 
        }
      });

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
      await (repository as any).update({ id, startLocal: newDate });
      
      recordAudit({
        action: 'MOVE_SCHEDULE',
        targetId: id,
        status: 'SUCCESS',
        durationMs: performance.now() - startTime,
        metadata: { newDate }
      });

      showSnack('success', 'スケジュールを移動しました');
      onSuccess?.();
    } catch (e) {
      const durationMs = performance.now() - startTime;
      const message = e instanceof Error ? e.message : '移動に失敗しました';
      
      recordAudit({
        action: 'MOVE_SCHEDULE',
        targetId: id,
        status: 'FAILURE',
        durationMs,
        error: { 
          kind: message.includes('409') ? OrchestratorFailureKind.CONFLICT : OrchestratorFailureKind.UNKNOWN,
          message 
        }
      });

      showSnack('error', `移動に失敗しました: ${message}`);
    }
  }, [repository, onSuccess, showSnack]);

  /**
   * スケジュールの削除
   */
  const handleDeleteSchedule = useCallback(async (id: string | number) => {
    const startTime = performance.now();
    try {
      await (repository as any).remove(id);
      
      recordAudit({
        action: 'DELETE_SCHEDULE',
        targetId: id,
        status: 'SUCCESS',
        durationMs: performance.now() - startTime
      });

      showSnack('success', 'スケジュールを削除しました');
      onSuccess?.();
    } catch (e) {
      const durationMs = performance.now() - startTime;
      const message = e instanceof Error ? e.message : '削除に失敗しました';
      
      recordAudit({
        action: 'DELETE_SCHEDULE',
        targetId: id,
        status: 'FAILURE',
        durationMs,
        error: { kind: OrchestratorFailureKind.UNKNOWN, message }
      });

      showSnack('error', `削除に失敗しました: ${message}`);
    }
  }, [repository, onSuccess, showSnack]);

  return {
    handleCreateSchedule,
    handleMoveSchedule,
    handleDeleteSchedule,
  };
}
