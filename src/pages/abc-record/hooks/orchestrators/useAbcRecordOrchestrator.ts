import { useCallback } from 'react';
import { localAbcRecordRepository } from '@/infra/localStorage/localAbcRecordRepository';
import type { AbcRecord } from '@/domain/abc/abcRecord';
import { auditLog } from '@/lib/debugLogger';

export interface AbcRecordOrchestratorDeps {
  onRefresh: () => void;
  setSaving?: (isSaving: boolean) => void;
  showSnack?: (severity: 'success' | 'error', message: string) => void;
}

/**
 * useAbcRecordOrchestrator
 * 
 * ABC記録のミューテーション（更新・削除）を管理する Orchestrator。
 */
export function useAbcRecordOrchestrator(deps: AbcRecordOrchestratorDeps) {
  const { onRefresh, setSaving, showSnack } = deps;

  /**
   * 記録の更新
   */
  const handleUpdateRecord = useCallback(async (id: string, data: Partial<AbcRecord>) => {
    setSaving?.(true);
    try {
      auditLog.info('ABC_RECORD:UPDATE_START', { id });
      
      const updated = await localAbcRecordRepository.update(id, data);
      
      auditLog.info('ABC_RECORD:UPDATE_SUCCESS', { id });
      onRefresh();
      return updated;
    } catch (error) {
      console.error('[AbcRecordOrchestrator] update failed', error);
      showSnack?.('error', '記録の更新に失敗しました。');
      throw error;
    } finally {
      setSaving?.(false);
    }
  }, [onRefresh, setSaving, showSnack]);

  /**
   * 記録の削除
   */
  const handleDeleteRecord = useCallback(async (id: string) => {
    try {
      auditLog.info('ABC_RECORD:DELETE_START', { id });
      
      await localAbcRecordRepository.delete(id);
      
      auditLog.info('ABC_RECORD:DELETE_SUCCESS', { id });
      onRefresh();
    } catch (error) {
      console.error('[AbcRecordOrchestrator] delete failed', error);
      showSnack?.('error', '記録の削除に失敗しました。');
      throw error;
    }
  }, [onRefresh, showSnack]);

  return {
    handleUpdateRecord,
    handleDeleteRecord,
  };
}
