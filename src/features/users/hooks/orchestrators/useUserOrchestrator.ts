import { useCallback } from 'react';
import type { UserRepository, UserRepositoryUpdateDto } from '../../domain/UserRepository';
import type { UserEditPageState } from '../view-models/useUserEditPageState';
import { recordAudit, OrchestratorFailureKind } from '@/lib/telemetry/auditLogger';

export interface UserOrchestratorDeps {
  pageState: UserEditPageState;
  repository: UserRepository;
  onSuccess?: (userId: string | number) => void;
  showSnack: (severity: 'success' | 'error' | 'info', message: string) => void;
}

/**
 * useUserOrchestrator
 * 
 * ユーザー情報の更新業務を統合管理する Orchestrator Hook。
 */
export function useUserOrchestrator(deps: UserOrchestratorDeps) {
  const { pageState, repository, onSuccess, showSnack } = deps;
  const { formData, setSaving, setError, reset } = pageState;

  /**
   * プロフィール情報の一括更新を実行
   */
  const handleUpdateProfile = useCallback(async (userId: string | number) => {
    if (pageState.isSaving) return;
    
    const startTime = performance.now();
    setSaving(true);
    setError(null);
    
    try {
      const updated = await repository.update(userId, formData as UserRepositoryUpdateDto);
      
      recordAudit({
        action: 'UPDATE_USER_PROFILE',
        targetId: userId,
        status: 'SUCCESS',
        durationMs: performance.now() - startTime,
        metadata: { fields: Object.keys(formData) }
      });

      showSnack('success', 'ユーザー情報を更新しました');
      reset(updated);
      onSuccess?.(userId);
    } catch (e) {
      const durationMs = performance.now() - startTime;
      const message = e instanceof Error ? e.message : '更新に失敗しました';
      
      // Failure Taxonomy に基づく分類
      let kind = OrchestratorFailureKind.UNKNOWN;
      if (message.includes('409') || message.includes('ETag')) kind = OrchestratorFailureKind.CONFLICT;
      if (message.includes('validation')) kind = OrchestratorFailureKind.VALIDATION;

      recordAudit({
        action: 'UPDATE_USER_PROFILE',
        targetId: userId,
        status: 'FAILURE',
        durationMs,
        error: { kind, message, stack: e instanceof Error ? e.stack : undefined }
      });

      setError(message);
      showSnack('error', `更新に失敗しました: ${message}`);
    } finally {
      setSaving(false);
    }
  }, [formData, pageState.isSaving, repository, setSaving, setError, reset, showSnack, onSuccess]);

  /**
   * 受給者証情報に特化した更新を実行
   */
  const handleApplyBenefitChange = useCallback(async (
    userId: string | number, 
    benefitData: Pick<UserRepositoryUpdateDto, 'RecipientCertNumber' | 'GrantMunicipality'>
  ) => {
    const startTime = performance.now();
    setSaving(true);
    try {
      const updated = await repository.update(userId, benefitData);
      
      recordAudit({
        action: 'APPLY_BENEFIT_CHANGE',
        targetId: userId,
        status: 'SUCCESS',
        durationMs: performance.now() - startTime,
        metadata: { ...benefitData }
      });

      showSnack('success', '受給者証情報を更新しました');
      reset(updated);
    } catch (e) {
      const durationMs = performance.now() - startTime;
      const message = e instanceof Error ? e.message : '受給者証情報の更新に失敗しました';
      
      recordAudit({
        action: 'APPLY_BENEFIT_CHANGE',
        targetId: userId,
        status: 'FAILURE',
        durationMs,
        error: { 
          kind: message.includes('409') ? OrchestratorFailureKind.CONFLICT : OrchestratorFailureKind.UNKNOWN,
          message 
        }
      });

      showSnack('error', message);
    } finally {
      setSaving(false);
    }
  }, [repository, setSaving, reset, showSnack]);

  return {
    handleUpdateProfile,
    handleApplyBenefitChange,
    isSaving: pageState.isSaving,
    isDirty: pageState.isDirty,
    error: pageState.error
  };
}
